using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;

namespace RenoveJa.Infrastructure.Video;

/// <summary>
/// Integração com a API REST do Daily.co para criar salas e gerar meeting tokens.
/// Substitui o WebRTC artesanal via WebView + SignalR signaling.
/// </summary>
public interface IDailyVideoService
{
    /// <summary>Cria uma sala privada no Daily com expiração automática.</summary>
    Task<DailyRoomResult> CreateRoomAsync(string roomName, int maxParticipants = 2, int expiryMinutes = 120, CancellationToken ct = default);

    /// <summary>Deleta uma sala do Daily (idempotente).</summary>
    Task DeleteRoomAsync(string roomName, CancellationToken ct = default);

    /// <summary>Gera um meeting token para um participante específico.</summary>
    Task<string> CreateMeetingTokenAsync(string roomName, string userId, string userName, bool isOwner = false, int? ejectAfterSeconds = null, CancellationToken ct = default);

    /// <summary>Lista gravações de uma sala (room_name = consult-{requestId:N}). Usado para auditoria.</summary>
    Task<IReadOnlyList<DailyRecordingInfo>> ListRecordingsByRoomAsync(string roomName, CancellationToken ct = default);

    /// <summary>Obtém link de download temporário da gravação (GET /recordings/:id/access-link).</summary>
    Task<(string? DownloadLink, long? Expires)> GetRecordingAccessLinkAsync(string recordingId, int validForSecs = 3600, CancellationToken ct = default);

    /// <summary>Inicia gravação cloud na sala via API (POST /rooms/:name/recordings/start). Garante gravação mesmo se o token não iniciar.</summary>
    Task<bool> StartRecordingAsync(string roomName, CancellationToken ct = default);
}

/// <summary>Metadados de uma gravação Daily (para auditoria).</summary>
public record DailyRecordingInfo(
    string Id,
    string RoomName,
    string Status,
    int? DurationSeconds,
    long? StartTs
);

public record DailyRoomResult(
    string Name,
    string Url,
    string Id,
    DateTime CreatedAt,
    DateTime? ExpiresAt
);

/// <summary>
/// Implementação usando HttpClient para chamar a API REST do Daily.co.
/// Docs: https://docs.daily.co/reference/rest-api
/// </summary>
public class DailyVideoService : IDailyVideoService
{
    private readonly HttpClient _httpClient;
    private readonly DailyConfig _config;
    private readonly ILogger<DailyVideoService> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public DailyVideoService(
        HttpClient httpClient,
        IOptions<DailyConfig> config,
        ILogger<DailyVideoService> logger)
    {
        _httpClient = httpClient;
        _config = config.Value;
        _logger = logger;

        _httpClient.BaseAddress = new Uri("https://api.daily.co/v1/");
        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", _config.ApiKey);
    }

    public async Task<DailyRoomResult> CreateRoomAsync(
        string roomName,
        int maxParticipants = 2,
        int expiryMinutes = 120,
        CancellationToken ct = default)
    {
        var expiry = DateTimeOffset.UtcNow.AddMinutes(expiryMinutes).ToUnixTimeSeconds();

        // eject_at_room_exp: quando a sala expira (exp), todos os participantes são ejetados.
        // DefaultRoomExpiryMinutes = 120 (2h). Paciente saindo NÃO encerra a sala — médico permanece.
        var body = new
        {
            name = roomName,
            privacy = "private",
            properties = new
            {
                max_participants = maxParticipants,
                exp = expiry,
                enable_chat = false,
                enable_knocking = false,
                enable_screenshare = false,
                enable_recording = "cloud",
                start_audio_off = false,
                start_video_off = false,
                eject_at_room_exp = true,
                lang = "pt"
            }
        };

        var json = JsonSerializer.Serialize(body, JsonOptions);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync("rooms", content, ct);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(ct);

            // 409 Conflict ou 400 com "already exists" — sala já existe no Daily, reutilizar
            var isRoomExists = response.StatusCode == System.Net.HttpStatusCode.Conflict
                || (response.StatusCode == System.Net.HttpStatusCode.BadRequest
                    && errorBody.Contains("already exists", StringComparison.OrdinalIgnoreCase));

            if (isRoomExists)
            {
                _logger.LogInformation("Daily room {RoomName} already exists, fetching it", roomName);
                return await GetRoomAsync(roomName, ct);
            }

            _logger.LogError("Daily API error creating room: {Status} {Body}", response.StatusCode, errorBody);
            throw new InvalidOperationException($"Daily API error: {response.StatusCode} — {errorBody}");
        }

        var result = await JsonSerializer.DeserializeAsync<DailyRoomResponse>(
            await response.Content.ReadAsStreamAsync(ct), JsonOptions, ct);

        _logger.LogInformation("Daily room created: {RoomName} ({RoomUrl})", result!.Name, result.Url);

        return new DailyRoomResult(
            result.Name,
            result.Url,
            result.Id,
            DateTimeOffset.FromUnixTimeSeconds(result.CreatedAt).UtcDateTime,
            result.Config?.Exp != null
                ? DateTimeOffset.FromUnixTimeSeconds(result.Config.Exp.Value).UtcDateTime
                : null
        );
    }

    public async Task DeleteRoomAsync(string roomName, CancellationToken ct = default)
    {
        var response = await _httpClient.DeleteAsync($"rooms/{roomName}", ct);

        if (response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogInformation("Daily room deleted (or not found): {RoomName}", roomName);
            return;
        }

        var errorBody = await response.Content.ReadAsStringAsync(ct);
        _logger.LogWarning("Daily API error deleting room {RoomName}: {Status} {Body}", roomName, response.StatusCode, errorBody);
    }

    public async Task<string> CreateMeetingTokenAsync(
        string roomName,
        string userId,
        string userName,
        bool isOwner = false,
        int? ejectAfterSeconds = null,
        CancellationToken ct = default)
    {
        var properties = new Dictionary<string, object>
        {
            ["room_name"] = roomName,
            ["user_name"] = userName,
            ["user_id"] = userId,
            ["is_owner"] = isOwner,
            ["enable_recording"] = isOwner ? "cloud" : (object)false,
            ["start_cloud_recording"] = isOwner,
            ["start_audio_off"] = false,
            ["start_video_off"] = false,
        };

        if (ejectAfterSeconds.HasValue)
            properties["eject_after_elapsed"] = ejectAfterSeconds.Value;

        // Token expira em 2 horas
        properties["exp"] = DateTimeOffset.UtcNow.AddHours(2).ToUnixTimeSeconds();

        var body = new { properties };
        var json = JsonSerializer.Serialize(body, JsonOptions);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync("meeting-tokens", content, ct);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("Daily API error creating token: {Status} {Body}", response.StatusCode, errorBody);
            throw new InvalidOperationException($"Daily meeting token error: {response.StatusCode}");
        }

        var result = await JsonSerializer.DeserializeAsync<DailyTokenResponse>(
            await response.Content.ReadAsStreamAsync(ct), JsonOptions, ct);

        _logger.LogInformation("Daily meeting token created for user {UserId} in room {RoomName}", userId, roomName);
        return result!.Token;
    }

    public async Task<IReadOnlyList<DailyRecordingInfo>> ListRecordingsByRoomAsync(string roomName, CancellationToken ct = default)
    {
        var response = await _httpClient.GetAsync($"recordings?room_name={Uri.EscapeDataString(roomName)}&limit=100", ct);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Daily API error listing recordings for room {RoomName}: {Status} {Body}", roomName, response.StatusCode, errorBody);
            return Array.Empty<DailyRecordingInfo>();
        }

        var result = await JsonSerializer.DeserializeAsync<DailyRecordingsListResponse>(
            await response.Content.ReadAsStreamAsync(ct), JsonOptions, ct);

        if (result?.Data == null)
            return Array.Empty<DailyRecordingInfo>();

        return result.Data
            .Select(r => new DailyRecordingInfo(r.Id, r.RoomName ?? roomName, r.Status ?? "unknown", r.Duration, r.StartTs))
            .ToList();
    }

    public async Task<(string? DownloadLink, long? Expires)> GetRecordingAccessLinkAsync(string recordingId, int validForSecs = 3600, CancellationToken ct = default)
    {
        var url = $"recordings/{recordingId}/access-link?valid_for_secs={validForSecs}";
        var response = await _httpClient.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Daily API error getting recording access link {RecordingId}: {Status} {Body}", recordingId, response.StatusCode, errorBody);
            return (null, null);
        }
        using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        var root = doc.RootElement;
        var downloadLink = root.TryGetProperty("download_link", out var dl) ? dl.GetString() : null;
        var expires = root.TryGetProperty("expires", out var ex) && ex.ValueKind == JsonValueKind.Number ? ex.GetInt64() : (long?)null;
        return (downloadLink, expires);
    }

    public async Task<bool> StartRecordingAsync(string roomName, CancellationToken ct = default)
    {
        var body = new { type = "cloud", layout = new { preset = "default" } };
        var json = JsonSerializer.Serialize(body, JsonOptions);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync($"rooms/{Uri.EscapeDataString(roomName)}/recordings/start", content, ct);

        if (response.IsSuccessStatusCode)
        {
            _logger.LogInformation("[Daily] Gravação iniciada na sala {RoomName}", roomName);
            return true;
        }

        var errorBody = await response.Content.ReadAsStringAsync(ct);
        _logger.LogWarning("[Daily] Falha ao iniciar gravação em {RoomName}: {Status} {Body}", roomName, response.StatusCode, errorBody);
        return false;
    }

    private async Task<DailyRoomResult> GetRoomAsync(string roomName, CancellationToken ct)
    {
        var response = await _httpClient.GetAsync($"rooms/{roomName}", ct);
        response.EnsureSuccessStatusCode();

        var result = await JsonSerializer.DeserializeAsync<DailyRoomResponse>(
            await response.Content.ReadAsStreamAsync(ct), JsonOptions, ct);

        return new DailyRoomResult(
            result!.Name,
            result.Url,
            result.Id,
            DateTimeOffset.FromUnixTimeSeconds(result.CreatedAt).UtcDateTime,
            result.Config?.Exp != null
                ? DateTimeOffset.FromUnixTimeSeconds(result.Config.Exp.Value).UtcDateTime
                : null
        );
    }

    // --- Internal DTOs for Daily API responses ---
    // Daily API pode retornar created_at e exp como string (ISO) ou number (Unix) conforme versão.

    private class DailyRoomResponse
    {
        [JsonPropertyName("id")] public string Id { get; set; } = "";
        [JsonPropertyName("name")] public string Name { get; set; } = "";
        [JsonPropertyName("url")] public string Url { get; set; } = "";
        [JsonPropertyName("created_at")]
        [JsonConverter(typeof(DailyTimestampConverter))]
        public long CreatedAt { get; set; }
        [JsonPropertyName("config")] public DailyRoomConfig? Config { get; set; }
    }

    private class DailyRoomConfig
    {
        [JsonPropertyName("exp")]
        [JsonConverter(typeof(DailyNullableTimestampConverter))]
        public long? Exp { get; set; }
    }

    private sealed class DailyTimestampConverter : JsonConverter<long>
    {
        public override long Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Number)
                return reader.GetInt64();
            if (reader.TokenType == JsonTokenType.String)
            {
                var s = reader.GetString();
                if (!string.IsNullOrEmpty(s) && long.TryParse(s, out var unix))
                    return unix;
                if (!string.IsNullOrEmpty(s) && DateTimeOffset.TryParse(s, out var dto))
                    return dto.ToUnixTimeSeconds();
            }
            throw new JsonException($"Cannot convert token type {reader.TokenType} to Unix timestamp");
        }

        public override void Write(Utf8JsonWriter writer, long value, JsonSerializerOptions options) =>
            writer.WriteNumberValue(value);
    }

    private sealed class DailyNullableTimestampConverter : JsonConverter<long?>
    {
        public override long? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null || reader.TokenType == JsonTokenType.None)
                return null;
            if (reader.TokenType == JsonTokenType.Number)
                return reader.GetInt64();
            if (reader.TokenType == JsonTokenType.String)
            {
                var s = reader.GetString();
                if (string.IsNullOrEmpty(s)) return null;
                if (long.TryParse(s, out var unix)) return unix;
                if (DateTimeOffset.TryParse(s, out var dto)) return dto.ToUnixTimeSeconds();
            }
            throw new JsonException($"Cannot convert token type {reader.TokenType} to Unix timestamp");
        }

        public override void Write(Utf8JsonWriter writer, long? value, JsonSerializerOptions options)
        {
            if (value.HasValue) writer.WriteNumberValue(value.Value);
            else writer.WriteNullValue();
        }
    }

    private class DailyTokenResponse
    {
        [JsonPropertyName("token")] public string Token { get; set; } = "";
    }

    private class DailyRecordingsListResponse
    {
        [JsonPropertyName("data")] public List<DailyRecordingItem>? Data { get; set; }
    }

    private class DailyRecordingItem
    {
        [JsonPropertyName("id")] public string Id { get; set; } = "";
        [JsonPropertyName("room_name")] public string? RoomName { get; set; }
        [JsonPropertyName("status")] public string? Status { get; set; }
        [JsonPropertyName("duration")] public int? Duration { get; set; }
        [JsonPropertyName("start_ts")] public long? StartTs { get; set; }
    }
}
