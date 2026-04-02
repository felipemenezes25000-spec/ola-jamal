using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.DTOs.Notifications;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Notifications;

/// <summary>
/// Dispatcher centralizado: deduplicação, preferências por categoria, quiet hours, persistência in-app e envio push conforme spec.
/// </summary>
public class PushNotificationDispatcher : IPushNotificationDispatcher
{
    private readonly IPushNotificationSender _pushSender;
    private readonly INotificationRepository _notificationRepository;
    private readonly IUserPushPreferencesRepository _prefsRepository;
    private readonly IMemoryCache _cache;
    private readonly ILogger<PushNotificationDispatcher> _logger;
    private const int DedupMinutes = 5;

    public PushNotificationDispatcher(
        IPushNotificationSender pushSender,
        INotificationRepository notificationRepository,
        IUserPushPreferencesRepository prefsRepository,
        IMemoryCache cache,
        ILogger<PushNotificationDispatcher> logger)
    {
        _pushSender = pushSender;
        _notificationRepository = notificationRepository;
        _prefsRepository = prefsRepository;
        _cache = cache;
        _logger = logger;
    }

    /// <summary>
    /// Envia push com regras da spec. Deduplica por collapseKey em 5 min. Respeita preferências por categoria e quiet hours. Sempre persiste in-app.
    /// </summary>
    public async Task SendAsync(PushNotificationRequest request, CancellationToken ct = default)
    {
        var prefs = await _prefsRepository.GetOrCreateAsync(request.UserId, ct);

        if (!IsCategoryEnabled(prefs, request.Payload.Category))
        {
            _logger.LogDebug("Push skipped by category preference: {Category} for user {UserId}", request.Payload.Category, request.UserId);
            await PersistInAppOnlyAsync(request, ct);
            return;
        }

        var effectiveChannel = request.Channel;
        if (!request.BypassQuietHours && IsQuietHours(prefs.Timezone))
        {
            effectiveChannel = PushChannel.Quiet;
        }

        var cacheKey = $"push_dedup:{request.Payload.CollapseKey}";
        if (_cache.TryGetValue(cacheKey, out _))
        {
            _logger.LogDebug("Push deduplicated: {CollapseKey}", request.Payload.CollapseKey);
            await PersistInAppOnlyAsync(request, ct);
            return;
        }

        _cache.Set(cacheKey, true, TimeSpan.FromMinutes(DedupMinutes));

        var requestWithChannel = effectiveChannel != request.Channel
            ? request with { Channel = effectiveChannel }
            : request;

        var notification = Domain.Entities.Notification.Create(
            request.UserId,
            request.Title,
            request.Body,
            Domain.Enums.NotificationType.Info,
            BuildNotificationData(request.Payload));
        await _notificationRepository.CreateAsync(notification, ct);
        await _pushSender.SendAsync(requestWithChannel, ct);
    }

    private static bool IsCategoryEnabled(Domain.Entities.UserPushPreferences prefs, PushCategory category)
    {
        return category switch
        {
            PushCategory.Requests => prefs.RequestsEnabled,
            PushCategory.Consultations => prefs.ConsultationsEnabled,
            PushCategory.Reminders => prefs.RemindersEnabled,
            PushCategory.System => true,
            _ => true
        };
    }

    private static readonly TimeZoneInfo BrazilTimeZone = TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");

    private static bool IsQuietHours(string? timezoneId)
    {
        TimeZoneInfo tz;
        try
        {
            tz = !string.IsNullOrWhiteSpace(timezoneId)
                ? TimeZoneInfo.FindSystemTimeZoneById(timezoneId)
                : BrazilTimeZone;
        }
        catch
        {
            tz = BrazilTimeZone;
        }

        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var hour = localNow.Hour;
        return hour >= 22 || hour < 8;
    }

    /// <summary>
    /// Persiste apenas notificação in-app (quando push é deduplicado ou preferência desligada).
    /// </summary>
    public async Task PersistInAppOnlyAsync(PushNotificationRequest request, CancellationToken ct = default)
    {
        var notification = Domain.Entities.Notification.Create(
            request.UserId,
            request.Title,
            request.Body,
            Domain.Enums.NotificationType.Info,
            BuildNotificationData(request.Payload));
        await _notificationRepository.CreateAsync(notification, ct);
    }

    private static Dictionary<string, object?> BuildNotificationData(PushNotificationPayload p)
    {
        var d = new Dictionary<string, object?>
        {
            ["type"] = p.Type,
            ["deepLink"] = p.DeepLink,
            ["requestId"] = p.RequestId,
            ["requestType"] = p.RequestType,
            ["status"] = p.Status,
            ["targetRole"] = p.TargetRole
        };
        if (p.Extra != null)
            foreach (var kv in p.Extra)
                d[kv.Key] = kv.Value;
        return d;
    }
}
