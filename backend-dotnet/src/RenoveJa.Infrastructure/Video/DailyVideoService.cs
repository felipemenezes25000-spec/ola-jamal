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
}

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

            // 409 = room already exists — fetch existing room
            if (response.StatusCode == System.Net.HttpStatusCode.Conflict)
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

    private class DailyRoomResponse
    {
        [JsonPropertyName("id")] public string Id { get; set; } = "";
        [JsonPropertyName("name")] public string Name { get; set; } = "";
        [JsonPropertyName("url")] public string Url { get; set; } = "";
        [JsonPropertyName("created_at")] public long CreatedAt { get; set; }
        [JsonPropertyName("config")] public DailyRoomConfig? Config { get; set; }
    }

    private class DailyRoomConfig
    {
        [JsonPropertyName("exp")] public long? Exp { get; set; }
    }

    private class DailyTokenResponse
    {
        [JsonPropertyName("token")] public string Token { get; set; } = "";
    }
}
