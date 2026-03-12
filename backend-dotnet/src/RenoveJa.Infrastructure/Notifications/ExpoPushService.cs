using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.DTOs.Notifications;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
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
        // Se a notificação tem targetRole definido, busca só tokens desse role.
        // Evita envio cruzado quando o mesmo user_id já teve tokens de ambos os roles (ex.: médico que também usa como paciente).
        List<PushToken> tokens;
        var targetRole = request.Payload?.TargetRole;
        if (!string.IsNullOrEmpty(targetRole))
            tokens = await _pushTokenRepository.GetActiveByUserIdAndRoleAsync(request.UserId, targetRole, ct);
        else
            tokens = await _pushTokenRepository.GetByUserIdAsync(request.UserId, ct);
        // Filtrar tokens válidos para Expo: ExponentPushToken[...] ou formato UUID.
        // Tokens Web Push (JSON com "endpoint") são para VAPID — não para a API Expo.
        var activeTokens = tokens
            .Where(t => t.Active && IsExpoToken(t.Token))
            .ToList();

        if (activeTokens.Count == 0)
        {
            _logger.LogDebug("No active Expo push tokens for user {UserId} (web-only tokens are excluded)", request.UserId);
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
                return;
            }

            // Expo retorna 200 mesmo quando tickets individuais falham; parsear para diagnosticar
            try
            {
                using var doc = JsonDocument.Parse(responseBody);
                if (doc.RootElement.TryGetProperty("data", out var dataArr) && dataArr.ValueKind == JsonValueKind.Array)
                {
                    var idx = 0;
                    foreach (var ticket in dataArr.EnumerateArray())
                    {
                        var status = ticket.TryGetProperty("status", out var s) ? s.GetString() : null;
                        if (status == "error")
                        {
                            var msg = ticket.TryGetProperty("message", out var m) ? m.GetString() : "unknown";
                            var details = ticket.TryGetProperty("details", out var d) ? d.GetRawText() : null;
                            var tokenPreview = idx < activeTokens.Count
                                ? (activeTokens[idx].Token.Length > 40 ? activeTokens[idx].Token[..40] + "..." : activeTokens[idx].Token)
                                : "?";
                            _logger.LogWarning("Expo push ticket error for user {UserId} token[{Idx}]: {Message} | details: {Details} | token: {TokenPreview}",
                                request.UserId, idx, msg, details ?? "null", tokenPreview);
                            // DeviceNotRegistered → ReceiptChecker desativa o token
                        }
                        else if (status == "ok" && _receiptChecker != null)
                        {
                            var ticketId = ticket.TryGetProperty("id", out var tid) ? tid.GetString() : null;
                            if (ticketId != null && idx < activeTokens.Count)
                            {
                                _receiptChecker.EnqueueTicket(ticketId, activeTokens[idx].Token, request.UserId);
                            }
                        }
                        idx++;
                    }
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
            catch (JsonException)
            {
                // Resposta inesperada; log genérico
            }

            _logger.LogInformation("Push sent to {Count} tokens for user {UserId} [{Type}]", activeTokens.Count, request.UserId, request.Payload.Type);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send push notification to user {UserId}", request.UserId);
        }
    }

    /// <summary>Token Expo válido começa com "ExponentPushToken[" ou tem formato de token mobile.</summary>
    private static bool IsExpoToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return false;
        // Web Push subscriptions são JSON com chave "endpoint"
        if (token.TrimStart().StartsWith("{")) return false;
        return true;
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
