using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.DTOs.Notifications;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Infrastructure.Notifications;

public class ExpoPushService : IPushNotificationSender
{
    private readonly HttpClient _httpClient;
    private readonly IPushTokenRepository _pushTokenRepository;
    private readonly ILogger<ExpoPushService> _logger;
    private const string ExpoApiUrl = "https://exp.host/--/api/v2/push/send";

    public ExpoPushService(
        IHttpClientFactory httpFactory,
        IPushTokenRepository pushTokenRepository,
        ILogger<ExpoPushService> logger)
    {
        _httpClient = httpFactory.CreateClient();
        _pushTokenRepository = pushTokenRepository;
        _logger = logger;
    }

    public async Task SendAsync(Guid userId, string title, string body, Dictionary<string, object?>? data = null, CancellationToken ct = default)
    {
        var extra = data != null ? new Dictionary<string, object?>(data) : null;
        var payload = new PushNotificationPayload(
            "legacy",
            extra?.TryGetValue("requestId", out var rid) == true && rid is string s
                ? $"renoveja://request-detail/{s}"
                : "renoveja://",
            PushCategory.System,
            $"legacy_{Guid.NewGuid():N}",
            DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            RequestId: extra?.TryGetValue("requestId", out var r) == true ? r?.ToString() : null,
            Extra: extra);
        var request = new PushNotificationRequest(userId, title, body, payload, PushChannel.Default, true);
        await SendAsync(request, ct);
    }

    public async Task SendAsync(PushNotificationRequest request, CancellationToken ct = default)
    {
        var tokens = await _pushTokenRepository.GetByUserIdAsync(request.UserId, ct);
        var activeTokens = tokens.Where(t => t.Active).ToList();

        if (activeTokens.Count == 0)
        {
            _logger.LogDebug("No active push tokens for user {UserId}", request.UserId);
            return;
        }

        var data = BuildDataDict(request.Payload);
        var channelId = request.Channel == PushChannel.Default ? "default" : "quiet";
        var priority = request.HighPriority ? "default" : "normal";

        var messages = activeTokens.Select(t => new
        {
            to = t.Token,
            title = request.Title,
            body = request.Body,
            data,
            sound = "default",
            priority,
            channelId,
            collapseKey = request.Payload.CollapseKey
        }).ToList();

        try
        {
            var response = await _httpClient.PostAsJsonAsync(ExpoApiUrl, messages, ct);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Expo push failed: {StatusCode} {Error}", response.StatusCode, error);
            }
            else
            {
                _logger.LogInformation("Push sent to {Count} tokens for user {UserId} [{Type}]", activeTokens.Count, request.UserId, request.Payload.Type);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send push notification to user {UserId}", request.UserId);
        }
    }

    private static Dictionary<string, object?> BuildDataDict(PushNotificationPayload p)
    {
        var d = new Dictionary<string, object?>
        {
            ["type"] = p.Type,
            ["deepLink"] = p.DeepLink,
            ["category"] = p.Category.ToString().ToLowerInvariant(),
            ["collapseKey"] = p.CollapseKey,
            ["ts"] = p.Ts
        };
        if (!string.IsNullOrEmpty(p.RequestId)) d["requestId"] = p.RequestId;
        if (!string.IsNullOrEmpty(p.RequestType)) d["requestType"] = p.RequestType;
        if (!string.IsNullOrEmpty(p.Status)) d["status"] = p.Status;
        if (p.Extra != null)
            foreach (var kv in p.Extra)
                d[kv.Key] = kv.Value;
        return d;
    }
}
