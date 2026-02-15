using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
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
        var tokens = await _pushTokenRepository.GetByUserIdAsync(userId, ct);
        var activeTokens = tokens.Where(t => t.Active).ToList();

        if (activeTokens.Count == 0)
        {
            _logger.LogDebug("No active push tokens for user {UserId}", userId);
            return;
        }

        var messages = activeTokens.Select(t => new
        {
            to = t.Token,
            title,
            body,
            data,
            sound = "default"
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
                _logger.LogInformation("Push sent to {Count} tokens for user {UserId}", activeTokens.Count, userId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send push notification to user {UserId}", userId);
        }
    }
}
