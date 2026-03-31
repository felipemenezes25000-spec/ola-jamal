using System.Net;
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

    /// <summary>Verifica se uma sala existe no Daily.co. Retorna true se existir.</summary>
    Task<bool> RoomExistsAsync(string roomName, CancellationToken ct = default);

    /// <summary>Deleta uma gravação do Daily.co pelo recordingId (idempotente).</summary>
    Task DeleteRecordingAsync(string recordingId, CancellationToken ct = default);
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

    private const string DailyApiBaseUrl = "https://api.daily.co/v1/";

    // --- Circuit breaker state (static — shared across scoped DI instances) ---
    private const int CircuitBreakerThreshold = 5;
    private static readonly TimeSpan CircuitBreakerCooldown = TimeSpan.FromSeconds(30);
    private static int _consecutiveFailures;
    private static DateTime _circuitOpenedAt = DateTime.MinValue;
    private static bool _halfOpenAttemptInProgress;
    private static readonly object _cbLock = new();

    public DailyVideoService(
        HttpClient httpClient,
        IOptions<DailyConfig> config,
        ILogger<DailyVideoService> logger)
    {
        _httpClient = httpClient;
        _config = config.Value;
        _logger = logger;

        if (_httpClient.BaseAddress == null)
            _httpClient.BaseAddress = new Uri(DailyApiBaseUrl);
    }

    /// <summary>Creates an HttpRequestMessage with per-request Authorization header (thread-safe).</summary>
    private HttpRequestMessage CreateRequest(HttpMethod method, string requestUri, HttpContent? content = null)
    {
        var request = new HttpRequestMessage(method, requestUri) { Content = content };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _config.ApiKey);
        return request;
    }

    /// <summary>Throws if circuit breaker is open (Daily considered down).</summary>
    private void ThrowIfCircuitOpen()
    {
        lock (_cbLock)
        {
            if (_consecutiveFailures < CircuitBreakerThreshold)
                return;

            var elapsed = DateTime.UtcNow - _circuitOpenedAt;
            if (elapsed < CircuitBreakerCooldown)
            {
                _logger.LogWarning("[DailyCircuitBreaker] Circuit OPEN — {Failures} consecutive failures, cooldown {Remaining:F0}s remaining.",
                    _consecutiveFailures, (CircuitBreakerCooldown - elapsed).TotalSeconds);
                throw new InvalidOperationException(
                    $"Daily.co circuit breaker open ({_consecutiveFailures} consecutive failures). Retry after {(CircuitBreakerCooldown - elapsed).TotalSeconds:F0}s.");
            }

            if (_halfOpenAttemptInProgress)
            {
                _logger.LogWarning("[DailyCircuitBreaker] Half-open probe already in progress — rejecting.");
                throw new InvalidOperationException("Daily.co circuit breaker half-open probe in progress. Try again shortly.");
            }

            _halfOpenAttemptInProgress = true;
            _logger.LogInformation("[DailyCircuitBreaker] Half-open — allowing probe request.");
        }
    }

    /// <summary>Record a successful call — resets circuit breaker.</summary>
    private void RecordSuccess()
    {
        lock (_cbLock)
        {
            _halfOpenAttemptInProgress = false;
            if (_consecutiveFailures > 0)
            {
                _logger.LogInformation("[DailyCircuitBreaker] Circuit CLOSED — recovered after {Failures} failures.", _consecutiveFailures);
                _consecutiveFailures = 0;
            }
        }
    }

    /// <summary>Record a failed call — may trip circuit breaker.</summary>
    private void RecordFailure()
    {
        lock (_cbLock)
        {
            if (_halfOpenAttemptInProgress)
            {
                _circuitOpenedAt = DateTime.UtcNow;
                _halfOpenAttemptInProgress = false;
                _logger.LogWarning("[DailyCircuitBreaker] Half-open probe failed — reopening circuit with fresh cooldown.");
                return;
            }

            _consecutiveFailures++;
            if (_consecutiveFailures >= CircuitBreakerThreshold)
            {
                _circuitOpenedAt = DateTime.UtcNow;
                _logger.LogError("[DailyCircuitBreaker] Circuit OPEN — {Failures} consecutive failures. Blocking for {Cooldown}s.",
                    _consecutiveFailures, CircuitBreakerCooldown.TotalSeconds);
            }
        }
    }

    /// <summary>Checks if an HTTP status code is transient (worth retrying).</summary>
    private static bool IsTransientError(HttpStatusCode statusCode)
        => statusCode is HttpStatusCode.RequestTimeout
            or HttpStatusCode.TooManyRequests
            or HttpStatusCode.InternalServerError
            or HttpStatusCode.BadGateway
            or HttpStatusCode.ServiceUnavailable
            or HttpStatusCode.GatewayTimeout;

    public async Task<DailyRoomResult> CreateRoomAsync(
        string roomName,
        int maxParticipants = 2,
        int expiryMinutes = 120,
        CancellationToken ct = default)
    {
        ThrowIfCircuitOpen();

        const int maxRetries = 3;
        var retryDelays = new[] { 500, 1500, 3000 }; // ms — exponential backoff

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

        for (var attempt = 0; attempt < maxRetries; attempt++)
        {
            try
            {
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                using var request = CreateRequest(HttpMethod.Post, "rooms", content);
                var response = await _httpClient.SendAsync(request, ct);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync(ct);

                    // 409 Conflict ou 400 com "already exists" — sala já existe no Daily, reutilizar
                    var isRoomExists = response.StatusCode == HttpStatusCode.Conflict
                        || (response.StatusCode == HttpStatusCode.BadRequest
                            && errorBody.Contains("already exists", StringComparison.OrdinalIgnoreCase));

                    if (isRoomExists)
                    {
                        RecordSuccess();
                        _logger.LogInformation("Daily room {RoomName} already exists, fetching it", roomName);
                        return await GetRoomAsync(roomName, ct);
                    }

                    // Retry only on transient errors
                    if (IsTransientError(response.StatusCode) && attempt < maxRetries - 1)
                    {
                        RecordFailure();
                        _logger.LogWarning("Daily API transient error creating room (attempt {Attempt}/{Max}): {Status} {Body}",
                            attempt + 1, maxRetries, response.StatusCode, errorBody);
                        await Task.Delay(retryDelays[attempt], ct);
                        continue;
                    }

                    RecordFailure();
                    _logger.LogError("Daily API error creating room — RoomName={RoomName} Status={Status} Body={Body} MaxParticipants={MaxParticipants} ExpiryMinutes={ExpiryMinutes}",
                        roomName, response.StatusCode, errorBody, maxParticipants, expiryMinutes);
                    throw new InvalidOperationException($"Daily API error: {response.StatusCode} — {errorBody}");
                }

                var result = await JsonSerializer.DeserializeAsync<DailyRoomResponse>(
                    await response.Content.ReadAsStreamAsync(ct), JsonOptions, ct);

                RecordSuccess();
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
            catch (HttpRequestException ex) when (attempt < maxRetries - 1)
            {
                RecordFailure();
                _logger.LogWarning(ex, "Daily API network error creating room (attempt {Attempt}/{Max})", attempt + 1, maxRetries);
                await Task.Delay(retryDelays[attempt], ct);
            }
            catch (TaskCanceledException ex) when (!ct.IsCancellationRequested && attempt < maxRetries - 1)
            {
                RecordFailure();
                _logger.LogWarning(ex, "Daily API timeout creating room (attempt {Attempt}/{Max})", attempt + 1, maxRetries);
                await Task.Delay(retryDelays[attempt], ct);
            }
        }

        // Should not reach here, but safety net
        RecordFailure();
        throw new InvalidOperationException($"Failed to create Daily room {roomName} after {maxRetries} attempts.");
    }

    public async Task DeleteRoomAsync(string roomName, CancellationToken ct = default)
    {
        ThrowIfCircuitOpen();

        using var request = CreateRequest(HttpMethod.Delete, $"rooms/{roomName}");
        var response = await _httpClient.SendAsync(request, ct);

        if (response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            RecordSuccess();
            _logger.LogInformation("Daily room deleted (or not found): {RoomName}", roomName);
            return;
        }

        var errorBody = await response.Content.ReadAsStringAsync(ct);
        if (IsTransientError(response.StatusCode))
            RecordFailure();
        _logger.LogWarning("Daily API error deleting room {RoomName}: {Status} {Body}", roomName, response.StatusCode, errorBody);
    }

    public async Task DeleteRecordingAsync(string recordingId, CancellationToken ct = default)
    {
        ThrowIfCircuitOpen();

        using var request = CreateRequest(HttpMethod.Delete, $"recordings/{recordingId}");
        var response = await _httpClient.SendAsync(request, ct);

        if (response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            RecordSuccess();
            _logger.LogInformation("Daily recording deleted: {RecordingId}", recordingId);
            return;
        }

        var errorBody = await response.Content.ReadAsStringAsync(ct);
        if (IsTransientError(response.StatusCode))
            RecordFailure();
        _logger.LogWarning("Daily API error deleting recording {RecordingId}: {Status} {Body}", recordingId, response.StatusCode, errorBody);
    }

    public async Task<string> CreateMeetingTokenAsync(
        string roomName,
        string userId,
        string userName,
        bool isOwner = false,
        int? ejectAfterSeconds = null,
        CancellationToken ct = default)
    {
        ThrowIfCircuitOpen();

        var requestId = Guid.NewGuid().ToString("N")[..8]; // correlation id for debugging
        var tokenExpiryUnix = DateTimeOffset.UtcNow.AddHours(2).ToUnixTimeSeconds();

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
            ["exp"] = tokenExpiryUnix,
        };

        if (ejectAfterSeconds.HasValue)
            properties["eject_after_elapsed"] = ejectAfterSeconds.Value;

        var body = new { properties };
        var json = JsonSerializer.Serialize(body, JsonOptions);

        const int maxRetries = 3;
        var retryDelays = new[] { 500, 1500, 3000 };
        string token = null!;

        for (var attempt = 0; attempt < maxRetries; attempt++)
        {
            try
            {
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                using var request = CreateRequest(HttpMethod.Post, "meeting-tokens", content);
                var response = await _httpClient.SendAsync(request, ct);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync(ct);

                    if (IsTransientError(response.StatusCode) && attempt < maxRetries - 1)
                    {
                        RecordFailure();
                        _logger.LogWarning(
                            "Daily API transient error creating token (attempt {Attempt}/{Max}): {Status} {Body} — CorrelationId={CorrelationId}",
                            attempt + 1, maxRetries, response.StatusCode, errorBody, requestId);
                        await Task.Delay(retryDelays[attempt], ct);
                        continue;
                    }

                    RecordFailure();
                    _logger.LogError(
                        "Daily API error creating token: {Status} {Body} — RequestId={CorrelationId} RoomName={RoomName} UserId={UserId}",
                        response.StatusCode, errorBody, requestId, roomName, userId);
                    throw new InvalidOperationException($"Daily meeting token error: {response.StatusCode}");
                }

                var result = await JsonSerializer.DeserializeAsync<DailyTokenResponse>(
                    await response.Content.ReadAsStreamAsync(ct), JsonOptions, ct);

                RecordSuccess();
                token = result!.Token;
                break;
            }
            catch (HttpRequestException ex) when (attempt < maxRetries - 1)
            {
                RecordFailure();
                _logger.LogWarning(ex, "Daily API network error creating token (attempt {Attempt}/{Max}) — CorrelationId={CorrelationId}",
                    attempt + 1, maxRetries, requestId);
                await Task.Delay(retryDelays[attempt], ct);
            }
            catch (TaskCanceledException ex) when (!ct.IsCancellationRequested && attempt < maxRetries - 1)
            {
                RecordFailure();
                _logger.LogWarning(ex, "Daily API timeout creating token (attempt {Attempt}/{Max}) — CorrelationId={CorrelationId}",
                    attempt + 1, maxRetries, requestId);
                await Task.Delay(retryDelays[attempt], ct);
            }
        }

        if (token == null)
        {
            RecordFailure();
            throw new InvalidOperationException($"Failed to create Daily meeting token after {maxRetries} attempts.");
        }

        // Bug fix #1: Validate token expiry before returning to client.
        // Decode the JWT payload (second segment) to verify exp claim is fresh.
        var thresholdMinutes = _config.TokenRefreshThresholdMinutes > 0 ? _config.TokenRefreshThresholdMinutes : 5;
        if (!ValidateTokenExpiry(token, thresholdMinutes, out var expiresAt))
        {
            _logger.LogWarning(
                "Daily token near expiry or expired (ExpiresAt={ExpiresAt}), regenerating — CorrelationId={CorrelationId} RoomName={RoomName} UserId={UserId}",
                expiresAt, requestId, roomName, userId);

            // Regenerate with a fresh exp
            properties["exp"] = DateTimeOffset.UtcNow.AddHours(2).ToUnixTimeSeconds();
            var retryBody = new { properties };
            var retryJson = JsonSerializer.Serialize(retryBody, JsonOptions);
            var retryContent = new StringContent(retryJson, Encoding.UTF8, "application/json");
            using var retryRequest = CreateRequest(HttpMethod.Post, "meeting-tokens", retryContent);
            var retryResponse = await _httpClient.SendAsync(retryRequest, ct);
            if (!retryResponse.IsSuccessStatusCode)
            {
                var retryError = await retryResponse.Content.ReadAsStringAsync(ct);
                _logger.LogError(
                    "Daily API error on token regeneration: {Status} {Body} — CorrelationId={CorrelationId} RoomName={RoomName} UserId={UserId}",
                    retryResponse.StatusCode, retryError, requestId, roomName, userId);
                throw new InvalidOperationException($"Daily meeting token regeneration error: {retryResponse.StatusCode}");
            }

            var retryResult = await JsonSerializer.DeserializeAsync<DailyTokenResponse>(
                await retryResponse.Content.ReadAsStreamAsync(ct), JsonOptions, ct);
            token = retryResult!.Token;
        }

        _logger.LogInformation(
            "Daily meeting token created — CorrelationId={CorrelationId} RoomName={RoomName} UserId={UserId} IsOwner={IsOwner}",
            requestId, roomName, userId, isOwner);
        return token;
    }

    /// <summary>
    /// Validates that a Daily JWT token's exp claim is at least <paramref name="thresholdMinutes"/> in the future.
    /// Returns false if token is expired or close to expiry.
    /// </summary>
    private static bool ValidateTokenExpiry(string token, int thresholdMinutes, out DateTimeOffset expiresAt)
    {
        expiresAt = DateTimeOffset.MinValue;
        try
        {
            var parts = token.Split('.');
            if (parts.Length < 2) return false;

            // Pad base64url to standard base64
            var payload = parts[1];
            payload = payload.Replace('-', '+').Replace('_', '/');
            switch (payload.Length % 4)
            {
                case 2: payload += "=="; break;
                case 3: payload += "="; break;
            }

            var jsonBytes = Convert.FromBase64String(payload);
            using var doc = JsonDocument.Parse(jsonBytes);
            if (doc.RootElement.TryGetProperty("exp", out var expProp) && expProp.ValueKind == JsonValueKind.Number)
            {
                var exp = expProp.GetInt64();
                expiresAt = DateTimeOffset.FromUnixTimeSeconds(exp);
                var remaining = expiresAt - DateTimeOffset.UtcNow;
                return remaining.TotalMinutes >= thresholdMinutes;
            }

            return false; // no exp claim
        }
        catch
        {
            return false; // malformed token — treat as expired
        }
    }

    public async Task<IReadOnlyList<DailyRecordingInfo>> ListRecordingsByRoomAsync(string roomName, CancellationToken ct = default)
    {
        using var request = CreateRequest(HttpMethod.Get, $"recordings?room_name={Uri.EscapeDataString(roomName)}&limit=100");
        var response = await _httpClient.SendAsync(request, ct);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Daily API error listing recordings — RoomName={RoomName} Status={Status} Body={Body}", roomName, response.StatusCode, errorBody);
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
        using var request = CreateRequest(HttpMethod.Get, url);
        var response = await _httpClient.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Daily API error getting recording access link — RecordingId={RecordingId} Status={Status} Body={Body}", recordingId, response.StatusCode, errorBody);
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
        ThrowIfCircuitOpen();

        var body = new { type = "cloud", layout = new { preset = "default" } };
        var json = JsonSerializer.Serialize(body, JsonOptions);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        try
        {
            using var request = CreateRequest(HttpMethod.Post, $"rooms/{Uri.EscapeDataString(roomName)}/recordings/start", content);
            var response = await _httpClient.SendAsync(request, ct);

            if (response.IsSuccessStatusCode)
            {
                RecordSuccess();
                _logger.LogInformation("[Daily] Gravação iniciada — RoomName={RoomName}", roomName);
                return true;
            }

            var errorBody = await response.Content.ReadAsStringAsync(ct);
            if (IsTransientError(response.StatusCode))
                RecordFailure();
            _logger.LogWarning("[Daily] Falha ao iniciar gravação — RoomName={RoomName} Status={Status} Body={Body}", roomName, response.StatusCode, errorBody);
            return false;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            RecordFailure();
            _logger.LogWarning(ex, "[Daily] Network/timeout error starting recording — RoomName={RoomName}", roomName);
            return false;
        }
    }

    public async Task<bool> RoomExistsAsync(string roomName, CancellationToken ct = default)
    {
        try
        {
            using var request = CreateRequest(HttpMethod.Get, $"rooms/{Uri.EscapeDataString(roomName)}");
            var response = await _httpClient.SendAsync(request, ct);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Daily] Error checking room existence — RoomName={RoomName}", roomName);
            return false;
        }
    }

    private async Task<DailyRoomResult> GetRoomAsync(string roomName, CancellationToken ct)
    {
        using var request = CreateRequest(HttpMethod.Get, $"rooms/{roomName}");
        var response = await _httpClient.SendAsync(request, ct);
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
