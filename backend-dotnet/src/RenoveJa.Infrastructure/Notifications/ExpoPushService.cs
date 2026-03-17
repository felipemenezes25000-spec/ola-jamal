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
    private readonly ExpoPushReceiptChecker? _receiptChecker;
    private const string ExpoApiUrl = "https://exp.host/--/api/v2/push/send";

    public ExpoPushService(
        IHttpClientFactory httpFactory,
        IPushTokenRepository pushTokenRepository,
        ILogger<ExpoPushService> logger,
        ExpoPushReceiptChecker? receiptChecker = null)
    {
        _httpClient = httpFactory.CreateClient();
        _pushTokenRepository = pushTokenRepository;
        _logger = logger;
        _receiptChecker = receiptChecker;
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
        var allActiveTokens = tokens.Where(t => t.Active).ToList();

        // Filter out web push tokens (JSON subscription objects) — Expo Push API only accepts ExponentPushToken[...] format.
        // TODO: Implement a separate IWebPushSender to handle web push subscription tokens via Web Push Protocol (RFC 8030).
        var activeTokens = allActiveTokens.Where(t => t.Token.StartsWith("ExponentPushToken[")).ToList();
        var skippedWebTokens = allActiveTokens.Count - activeTokens.Count;
        if (skippedWebTokens > 0)
        {
            _logger.LogWarning("Skipped {SkippedCount} non-Expo web push token(s) for user {UserId}. These require a separate web push sender.",
                skippedWebTokens, request.UserId);
        }

        if (activeTokens.Count == 0)
        {
            _logger.LogDebug("No active Expo push tokens for user {UserId} (total active: {TotalActive}, skipped web: {SkippedWeb})",
                request.UserId, allActiveTokens.Count, skippedWebTokens);
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
            var responseBody = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Expo push failed: {StatusCode} {Error}", response.StatusCode, responseBody);
                throw new InvalidOperationException($"Expo API retornou {(int)response.StatusCode}: {responseBody}");
            }

            // Expo retorna 200 mesmo quando tickets individuais falham; parsear para diagnosticar
            var allFailed = false;
            try
            {
                using var doc = JsonDocument.Parse(responseBody);
                if (doc.RootElement.TryGetProperty("data", out var dataArr) && dataArr.ValueKind == JsonValueKind.Array)
                {
                    var idx = 0;
                    var errorCount = 0;
                    foreach (var ticket in dataArr.EnumerateArray())
                    {
                        var status = ticket.TryGetProperty("status", out var s) ? s.GetString() : null;
                        if (status == "error")
                        {
                            errorCount++;
                            var msg = ticket.TryGetProperty("message", out var m) ? m.GetString() : "unknown";
                            var details = ticket.TryGetProperty("details", out var d) ? d.GetRawText() : null;
                            var tokenPreview = idx < activeTokens.Count
                                ? (activeTokens[idx].Token.Length > 40 ? activeTokens[idx].Token[..40] + "..." : activeTokens[idx].Token)
                                : "?";
                            _logger.LogWarning("Expo push ticket error for user {UserId} token[{Idx}]: {Message} | details: {Details} | token: {TokenPreview}",
                                request.UserId, idx, msg, details ?? "null", tokenPreview);
                        }
                        else if (status == "ok" && _receiptChecker != null)
                        {
                            var ticketId = ticket.TryGetProperty("id", out var tid) ? tid.GetString() : null;
                            if (ticketId != null && idx < activeTokens.Count)
                                _receiptChecker.EnqueueTicket(ticketId, activeTokens[idx].Token, request.UserId);
                        }
                        idx++;
                    }
                    allFailed = errorCount > 0 && errorCount == idx;
                }
                if (doc.RootElement.TryGetProperty("errors", out var errArr) && errArr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var err in errArr.EnumerateArray())
                    {
                        var code = err.TryGetProperty("code", out var c) ? c.GetString() : null;
                        var msg = err.TryGetProperty("message", out var m) ? m.GetString() : null;
                        _logger.LogWarning("Expo push request error: {Code} {Message}", code, msg);
                    }
                }
            }
            catch (JsonException) { /* Resposta inesperada; log genérico */ }

            if (allFailed)
                throw new InvalidOperationException("Todos os tokens retornaram erro no Expo Push. Verifique se o token é válido.");

            _logger.LogInformation("Push sent to {Count} tokens for user {UserId} [{Type}]", activeTokens.Count, request.UserId, request.Payload.Type);
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            _logger.LogError(ex, "Failed to send push notification to user {UserId}", request.UserId);
            throw; // re-throw para o caller (test push) saber que falhou
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
            ["ts"] = p.Ts,
            ["targetRole"] = p.TargetRole
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
