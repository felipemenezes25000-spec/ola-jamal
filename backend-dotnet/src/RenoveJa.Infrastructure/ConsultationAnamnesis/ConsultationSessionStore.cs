using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;
using StackExchange.Redis;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// Store em Redis (ElastiCache) do estado da sessão de consulta por requestId.
/// Persiste dados entre deploys/restarts do ECS, resolvendo a perda de transcrições
/// que ocorria com IMemoryCache quando containers eram reciclados.
///
/// Estrutura Redis por sessão (Hash):
///   consultation:session:{requestId} → {
///     patientId, transcript, segments (JSON array),
///     anamnesisJson, aiSuggestionsJson, evidenceJson
///   }
/// TTL: 4 horas (SessionExpiration).
/// </summary>
public class ConsultationSessionStore : IConsultationSessionStore
{
    private const string KeyPrefix = "consultation:session:";
    private static readonly TimeSpan SessionExpiration = TimeSpan.FromHours(4);

    // Hash field names
    private const string FieldPatientId = "patientId";
    private const string FieldTranscript = "transcript";
    private const string FieldSegments = "segments";
    private const string FieldAnamnesisJson = "anamnesisJson";
    private const string FieldAiSuggestionsJson = "aiSuggestionsJson";
    private const string FieldEvidenceJson = "evidenceJson";
    private const string FieldConsultationType = "consultationType";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<ConsultationSessionStore> _logger;

    public ConsultationSessionStore(IConnectionMultiplexer redis, ILogger<ConsultationSessionStore> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    private IDatabase Db => _redis.GetDatabase();

    public void EnsureSession(Guid requestId, Guid patientId)
    {
        try
        {
            var key = KeyPrefix + requestId;
            var db = Db;

            // Only create if doesn't exist yet (HSETNX on patientId field)
            var created = db.HashSet(key, FieldPatientId, patientId.ToString(), When.NotExists);
            if (created)
            {
                // Initialize empty transcript and segments
                db.HashSet(key, new HashEntry[]
                {
                    new(FieldTranscript, string.Empty),
                    new(FieldSegments, "[]"),
                });
                db.KeyExpire(key, SessionExpiration);
                _logger.LogInformation(
                    "[ConsultationSession] Sessão criada RequestId={RequestId} PatientId={PatientId}",
                    requestId, patientId);
            }
            else
            {
                // Refresh TTL on existing session
                db.KeyExpire(key, SessionExpiration);
            }
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogWarning(ex, "[ConsultationSession] Redis indisponível em EnsureSession — sessão não criada. RequestId={RequestId}", requestId);
        }
    }

    public void AppendTranscript(Guid requestId, string text, double? startTimeSeconds = null)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            _logger.LogDebug(
                "[ConsultationSession] AppendTranscript ignorado: texto vazio RequestId={RequestId}",
                requestId);
            return;
        }

        var key = KeyPrefix + requestId;
        IDatabase db;
        try
        {
            db = Db;
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogWarning(ex, "[ConsultationSession] Redis indisponível em AppendTranscript — transcrição perdida. RequestId={RequestId}", requestId);
            return;
        }

        try
        {
        if (!db.KeyExists(key))
        {
            _logger.LogWarning(
                "[ConsultationSession] TRANSCRICAO_PERDIDA: Sessão não encontrada ao append. RequestId={RequestId} textLen={Len}",
                requestId, text.Length);
            return;
        }

        var trimmed = text.Trim();
        var receivedAt = DateTime.UtcNow;
        string speaker;
        string segmentText;

        if (trimmed.StartsWith("[Médico]", StringComparison.OrdinalIgnoreCase))
        {
            speaker = "Médico";
            segmentText = trimmed.Length > 8 ? trimmed[8..].Trim() : string.Empty;
        }
        else if (trimmed.StartsWith("[Paciente]", StringComparison.OrdinalIgnoreCase))
        {
            speaker = "Paciente";
            segmentText = trimmed.Length > 10 ? trimmed[10..].Trim() : string.Empty;
        }
        else
        {
            speaker = "Transcrição";
            segmentText = trimmed;
        }

        // Use a Lua script to atomically read existing transcript, deduplicate, and append.
        // This avoids race conditions without needing distributed locks.
        var luaScript = @"
            local existing = redis.call('HGET', KEYS[1], 'transcript') or ''
            local newText = ARGV[1]
            local segment = ARGV[2]
            local combined = existing .. ' ' .. newText
            redis.call('HSET', KEYS[1], 'transcript', combined)
            if segment ~= '' then
                local segments = redis.call('HGET', KEYS[1], 'segments') or '[]'
                -- Append segment JSON: remove trailing ']', add comma if needed, add new segment, close ']'
                if segments == '[]' then
                    segments = '[' .. segment .. ']'
                else
                    segments = string.sub(segments, 1, #segments - 1) .. ',' .. segment .. ']'
                end
                redis.call('HSET', KEYS[1], 'segments', segments)
            end
            redis.call('EXPIRE', KEYS[1], ARGV[3])
            return #combined
        ";

        // Perform deduplication on client side before sending to Redis
        // (reads existing transcript first)
        var existingTranscript = (string?)db.HashGet(key, FieldTranscript) ?? string.Empty;
        var deduped = DeduplicateOverlap(existingTranscript, trimmed);

        var segmentJson = string.Empty;
        if (!string.IsNullOrWhiteSpace(segmentText))
        {
            var seg = new TranscriptSegmentDto(speaker, segmentText, receivedAt, startTimeSeconds);
            segmentJson = JsonSerializer.Serialize(seg, JsonOptions);
        }

        var result = db.ScriptEvaluate(
            luaScript,
            new RedisKey[] { key },
            new RedisValue[] { deduped, segmentJson, (int)SessionExpiration.TotalSeconds });

        var totalLen = (long)result;

        _logger.LogDebug(
            "[ConsultationSession] Transcript append RequestId={RequestId} totalLen={Len} startTime={StartTime} deduped={Deduped}",
            requestId, totalLen, startTimeSeconds, deduped != trimmed);
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogWarning(ex, "[ConsultationSession] Redis indisponível durante AppendTranscript — transcrição perdida. RequestId={RequestId}", requestId);
        }
    }

    public void UpdateAnamnesis(Guid requestId, string? anamnesisJson, string? suggestionsJson, string? evidenceJson = null)
    {
        try
        {
            var key = KeyPrefix + requestId;
            var db = Db;

            if (!db.KeyExists(key)) return;

            var entries = new List<HashEntry>();
            if (anamnesisJson != null) entries.Add(new HashEntry(FieldAnamnesisJson, anamnesisJson));
            if (suggestionsJson != null) entries.Add(new HashEntry(FieldAiSuggestionsJson, suggestionsJson));
            if (evidenceJson != null) entries.Add(new HashEntry(FieldEvidenceJson, evidenceJson));

            if (entries.Count > 0)
            {
                db.HashSet(key, entries.ToArray());
                db.KeyExpire(key, SessionExpiration);
            }
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogWarning(ex, "[ConsultationSession] Redis indisponível em UpdateAnamnesis. RequestId={RequestId}", requestId);
        }
    }

    public string GetTranscript(Guid requestId)
    {
        try
        {
            var key = KeyPrefix + requestId;
            var transcript = (string?)Db.HashGet(key, FieldTranscript);
            return transcript?.Trim() ?? string.Empty;
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogWarning(ex, "[ConsultationSession] Redis indisponível em GetTranscript — retornando vazio. RequestId={RequestId}", requestId);
            return string.Empty;
        }
    }

    public (string? AnamnesisJson, string? SuggestionsJson) GetAnamnesisState(Guid requestId)
    {
        try
        {
            var key = KeyPrefix + requestId;
            var db = Db;

            if (!db.KeyExists(key)) return (null, null);

            var values = db.HashGet(key, new RedisValue[] { FieldAnamnesisJson, FieldAiSuggestionsJson });
            return ((string?)values[0], (string?)values[1]);
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogWarning(ex, "[ConsultationSession] Redis indisponível em GetAnamnesisState — retornando vazio. RequestId={RequestId}", requestId);
            return (null, null);
        }
    }

    public string? GetEvidenceJson(Guid requestId)
    {
        try
        {
            var key = KeyPrefix + requestId;
            var db = Db;
            if (!db.KeyExists(key)) return null;
            return (string?)db.HashGet(key, FieldEvidenceJson);
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogWarning(ex, "[ConsultationSession] Redis indisponível em GetEvidenceJson — retornando null. RequestId={RequestId}", requestId);
            return null;
        }
    }

    public void SetConsultationType(Guid requestId, string? consultationType)
    {
        if (string.IsNullOrWhiteSpace(consultationType)) return;
        try
        {
            var key = KeyPrefix + requestId;
            Db.HashSet(key, FieldConsultationType, consultationType);
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogWarning(ex, "[ConsultationSession] Redis indisponível em SetConsultationType. RequestId={RequestId}", requestId);
        }
    }

    public string? GetConsultationType(Guid requestId)
    {
        try
        {
            var key = KeyPrefix + requestId;
            return (string?)Db.HashGet(key, FieldConsultationType);
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogWarning(ex, "[ConsultationSession] Redis indisponível em GetConsultationType. RequestId={RequestId}", requestId);
            return null;
        }
    }

    public ConsultationSessionData? GetAndRemove(Guid requestId)
    {
        var key = KeyPrefix + requestId;
        var db = Db;

        HashEntry[] allFields;
        try
        {
            allFields = db.HashGetAll(key);
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogWarning(ex, "[ConsultationSession] Redis indisponível em GetAndRemove — retornando null (dados serão preservados no Redis quando voltar). RequestId={RequestId}", requestId);
            return null;
        }
        if (allFields.Length == 0) return null;

        var dict = allFields.ToDictionary(
            e => (string)e.Name!,
            e => (string?)e.Value) ?? new Dictionary<string, string?>();

        // Remove the key from Redis (best-effort; if this fails, data may be re-processed but that's safer than losing it)
        try { db.KeyDelete(key); }
        catch (RedisConnectionException ex)
        {
            _logger.LogWarning(ex, "[ConsultationSession] Redis indisponível ao deletar sessão em GetAndRemove — dados retornados mas não removidos. RequestId={RequestId}", requestId);
        }

        var patientId = dict.TryGetValue(FieldPatientId, out var pid) && Guid.TryParse(pid, out var parsedPid)
            ? parsedPid
            : Guid.Empty;

        var transcript = dict.GetValueOrDefault(FieldTranscript)?.Trim();

        IReadOnlyList<TranscriptSegment> segments;
        var segmentsJson = dict.GetValueOrDefault(FieldSegments);
        if (!string.IsNullOrWhiteSpace(segmentsJson) && segmentsJson != "[]")
        {
            var dtos = JsonSerializer.Deserialize<List<TranscriptSegmentDto>>(segmentsJson, JsonOptions);
            segments = dtos?.Select(d => new TranscriptSegment(
                d.Speaker, d.Text, d.ReceivedAtUtc, d.StartTimeSeconds)).ToList()
                ?? new List<TranscriptSegment>();
        }
        else
        {
            segments = new List<TranscriptSegment>();
        }

        var anamnesisJson = dict.GetValueOrDefault(FieldAnamnesisJson);
        var suggestionsJson = dict.GetValueOrDefault(FieldAiSuggestionsJson);
        var evidenceJson = dict.GetValueOrDefault(FieldEvidenceJson);

        return new ConsultationSessionData(
            requestId, patientId, transcript, segments,
            anamnesisJson, suggestionsJson, evidenceJson);
    }

    /// <summary>
    /// Remove overlap entre o final do texto existente e o início do novo texto.
    /// Transcrição (Daily.co) frequentemente repete as últimas 2-8 palavras do chunk anterior no início do próximo.
    /// Compara sufixo do existente com prefixo do novo, case-insensitive com tolerância.
    /// </summary>
    private static string DeduplicateOverlap(string existing, string newText)
    {
        if (string.IsNullOrWhiteSpace(existing) || string.IsNullOrWhiteSpace(newText))
            return newText;

        // Remove speaker labels para comparação ([Médico], [Paciente], [Transcrição])
        var existingClean = StripSpeakerLabel(existing);
        var newClean = StripSpeakerLabel(newText);

        var existingWords = existingClean.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var newWords = newClean.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        if (existingWords.Length < 2 || newWords.Length < 2)
            return newText;

        // Tenta encontrar overlap de 2 a 10 palavras (do maior para o menor)
        var maxOverlap = Math.Min(10, Math.Min(existingWords.Length, newWords.Length));
        for (int overlapLen = maxOverlap; overlapLen >= 2; overlapLen--)
        {
            var existingSuffix = existingWords[^overlapLen..];
            var newPrefix = newWords[..overlapLen];

            // Comparação case-insensitive com tolerância de pontuação
            var match = true;
            for (int i = 0; i < overlapLen; i++)
            {
                var a = NormalizeForComparison(existingSuffix[i]);
                var b = NormalizeForComparison(newPrefix[i]);
                if (!string.Equals(a, b, StringComparison.OrdinalIgnoreCase))
                {
                    match = false;
                    break;
                }
            }

            if (match)
            {
                // Preservar speaker label do newText + parte não-repetida
                var speakerLabel = ExtractSpeakerLabel(newText);
                var remainingWords = newWords[overlapLen..];
                if (remainingWords.Length == 0) return string.Empty;
                return string.IsNullOrEmpty(speakerLabel)
                    ? string.Join(' ', remainingWords)
                    : $"{speakerLabel} {string.Join(' ', remainingWords)}";
            }
        }

        return newText;
    }

    private static string StripSpeakerLabel(string text)
    {
        var t = text.TrimStart();
        if (t.StartsWith("[Médico]", StringComparison.OrdinalIgnoreCase)) return t[8..].TrimStart();
        if (t.StartsWith("[Paciente]", StringComparison.OrdinalIgnoreCase)) return t[10..].TrimStart();
        if (t.StartsWith("[Transcrição]", StringComparison.OrdinalIgnoreCase)) return t[13..].TrimStart();
        return t;
    }

    private static string ExtractSpeakerLabel(string text)
    {
        var t = text.TrimStart();
        if (t.StartsWith("[Médico]", StringComparison.OrdinalIgnoreCase)) return "[Médico]";
        if (t.StartsWith("[Paciente]", StringComparison.OrdinalIgnoreCase)) return "[Paciente]";
        if (t.StartsWith("[Transcrição]", StringComparison.OrdinalIgnoreCase)) return "[Transcrição]";
        return string.Empty;
    }

    private static string NormalizeForComparison(string word)
    {
        // Remove pontuação final para tolerância (ex: "dor," vs "dor")
        return word.TrimEnd('.', ',', ';', ':', '!', '?', '"', '\'');
    }

    /// <summary>Internal DTO for JSON serialization of transcript segments in Redis.</summary>
    private sealed record TranscriptSegmentDto(
        string Speaker,
        string Text,
        DateTime ReceivedAtUtc,
        double? StartTimeSeconds = null);
}
