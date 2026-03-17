using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// Store em memória (IMemoryCache) do estado da sessão de consulta por requestId.
/// Thread-safe por requestId via lock no objeto de estado.
/// Armazena segmentos com timestamp para gerar .txt no formato "Paciente minuto X segundo Y fala".
///
/// TODO(resilience): IMemoryCache é volátil — dados de transcrição são PERDIDOS em deploy/restart ECS.
/// Se uma consulta estiver ativa durante um deploy, toda a transcrição acumulada é perdida.
/// Migrar para Redis (ElastiCache) ou DynamoDB para persistência cross-deploy.
/// Workaround atual: FinishConsultation salva no S3/DB antes do encerramento, mas se o container
/// for encerrado abruptamente (kill signal, OOM, rolling deploy), os dados se perdem.
/// </summary>
public class ConsultationSessionStore : IConsultationSessionStore
{
    private const string KeyPrefix = "consultation_session_";
    private static readonly TimeSpan SessionExpiration = TimeSpan.FromHours(4);

    private readonly IMemoryCache _cache;
    private readonly ILogger<ConsultationSessionStore> _logger;

    public ConsultationSessionStore(IMemoryCache cache, ILogger<ConsultationSessionStore> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    public void EnsureSession(Guid requestId, Guid patientId)
    {
        var key = KeyPrefix + requestId;
        var created = false;
        _cache.GetOrCreate(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = SessionExpiration;
            created = true;
            return new SessionState(patientId);
        });
        if (created)
            _logger.LogInformation("[ConsultationSession] Sessão criada RequestId={RequestId} PatientId={PatientId}", requestId, patientId);
    }

    public void AppendTranscript(Guid requestId, string text, double? startTimeSeconds = null)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            _logger.LogDebug("[ConsultationSession] AppendTranscript ignorado: texto vazio RequestId={RequestId}", requestId);
            return;
        }
        var key = KeyPrefix + requestId;
        if (!_cache.TryGetValue(key, out SessionState? state) || state == null)
        {
            _logger.LogWarning("[ConsultationSession] TRANSCRICAO_PERDIDA: Sessão não encontrada ao append. RequestId={RequestId} textLen={Len}", requestId, text.Length);
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
        lock (state.Lock)
        {
            // Deduplicar overlap: transcrição pode repetir as últimas palavras do chunk anterior
            var existingText = state.TranscriptBuilder.ToString();
            var deduped = DeduplicateOverlap(existingText, trimmed);
            state.TranscriptBuilder.Append(' ').Append(deduped);
            if (!string.IsNullOrWhiteSpace(segmentText))
            {
                state.TranscriptSegments.Add(new TranscriptSegment(speaker, segmentText, receivedAt, startTimeSeconds));
            }
            _logger.LogDebug("[ConsultationSession] Transcript append RequestId={RequestId} totalLen={Len} segments={Count} startTime={StartTime} deduped={Deduped}", requestId, state.TranscriptBuilder.Length, state.TranscriptSegments.Count, startTimeSeconds, deduped != trimmed);
        }
    }

    public void UpdateAnamnesis(Guid requestId, string? anamnesisJson, string? suggestionsJson, string? evidenceJson = null)
    {
        var key = KeyPrefix + requestId;
        if (!_cache.TryGetValue(key, out SessionState? state) || state == null) return;
        lock (state.Lock)
        {
            if (anamnesisJson != null) state.AnamnesisJson = anamnesisJson;
            if (suggestionsJson != null) state.AiSuggestionsJson = suggestionsJson;
            if (evidenceJson != null) state.EvidenceJson = evidenceJson;
        }
    }

    public string GetTranscript(Guid requestId)
    {
        var key = KeyPrefix + requestId;
        if (!_cache.TryGetValue(key, out SessionState? state) || state == null) return string.Empty;
        lock (state.Lock)
        {
            return state.TranscriptBuilder.ToString().Trim();
        }
    }

    public (string? AnamnesisJson, string? SuggestionsJson) GetAnamnesisState(Guid requestId)
    {
        var key = KeyPrefix + requestId;
        if (!_cache.TryGetValue(key, out SessionState? state) || state == null) return (null, null);
        lock (state.Lock)
        {
            return (state.AnamnesisJson, state.AiSuggestionsJson);
        }
    }

    public ConsultationSessionData? GetAndRemove(Guid requestId)
    {
        var key = KeyPrefix + requestId;
        if (!_cache.TryGetValue(key, out SessionState? state) || state == null) return null;
        string transcript;
        IReadOnlyList<TranscriptSegment> segments;
        string? anamnesisJson;
        string? suggestionsJson;
        string? evidenceJson;
        lock (state.Lock)
        {
            transcript = state.TranscriptBuilder.ToString().Trim();
            segments = state.TranscriptSegments.ToList();
            anamnesisJson = state.AnamnesisJson;
            suggestionsJson = state.AiSuggestionsJson;
            evidenceJson = state.EvidenceJson;
        }
        _cache.Remove(key);
        return new ConsultationSessionData(requestId, state.PatientId, transcript, segments, anamnesisJson, suggestionsJson, evidenceJson);
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

    private sealed class SessionState
    {
        public readonly object Lock = new();
        public readonly Guid PatientId;
        public readonly StringBuilder TranscriptBuilder = new();
        public readonly List<TranscriptSegment> TranscriptSegments = new();
        public string? AnamnesisJson;
        public string? AiSuggestionsJson;
        public string? EvidenceJson;

        public SessionState(Guid patientId)
        {
            PatientId = patientId;
        }
    }
}
