using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// Store em memória (IMemoryCache) do estado da sessão de consulta por requestId.
/// Thread-safe por requestId via lock no objeto de estado.
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
        _cache.GetOrCreate(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = SessionExpiration;
            return new SessionState(patientId);
        });
    }

    public void AppendTranscript(Guid requestId, string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return;
        var key = KeyPrefix + requestId;
        if (!_cache.TryGetValue(key, out SessionState? state) || state == null) return;
        lock (state.Lock)
        {
            state.TranscriptBuilder.Append(' ').Append(text.Trim());
        }
    }

    public void UpdateAnamnesis(Guid requestId, string? anamnesisJson, string? suggestionsJson)
    {
        var key = KeyPrefix + requestId;
        if (!_cache.TryGetValue(key, out SessionState? state) || state == null) return;
        lock (state.Lock)
        {
            if (anamnesisJson != null) state.AnamnesisJson = anamnesisJson;
            if (suggestionsJson != null) state.AiSuggestionsJson = suggestionsJson;
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
        string? anamnesisJson;
        string? suggestionsJson;
        lock (state.Lock)
        {
            transcript = state.TranscriptBuilder.ToString().Trim();
            anamnesisJson = state.AnamnesisJson;
            suggestionsJson = state.AiSuggestionsJson;
        }
        _cache.Remove(key);
        return new ConsultationSessionData(requestId, state.PatientId, transcript, anamnesisJson, suggestionsJson);
    }

    private sealed class SessionState
    {
        public readonly object Lock = new();
        public readonly Guid PatientId;
        public readonly StringBuilder TranscriptBuilder = new();
        public string? AnamnesisJson;
        public string? AiSuggestionsJson;

        public SessionState(Guid patientId)
        {
            PatientId = patientId;
        }
    }
}
