using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;
using Sentry;

namespace RenoveJa.Application.Services.Notifications;

/// <summary>
/// Background service que envia lembretes para pedidos parados:
/// - InReview > 60 min -> medico (pedido parado em analise)
/// Evita spam: cada lembrete por request e enviado no maximo 1x a cada 12h.
/// Cooldown usa IMemoryCache como L1 (rapido) e DB como L2 (persistente apos restart).
/// </summary>
public class StaleRequestReminderService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<StaleRequestReminderService> _logger;
    private static readonly TimeSpan InReviewThreshold = TimeSpan.FromMinutes(60);
    private static readonly TimeSpan RunInterval = TimeSpan.FromMinutes(20);
    private static readonly TimeSpan ReminderCooldown = TimeSpan.FromHours(12);
    private const string NotificationType = "reminder_in_review_stale";

    public StaleRequestReminderService(IServiceScopeFactory scopeFactory, IMemoryCache cache, ILogger<StaleRequestReminderService> logger)
    {
        _scopeFactory = scopeFactory;
        _cache = cache;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SendRemindersAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                if (IsDatabaseNotConfigured(ex))
                    _logger.LogDebug("Database nao configurado, ignorando lembretes de pedidos parados");
                else
                {
                    _logger.LogError(ex, "Erro ao enviar lembretes de pedidos parados");
                    SentrySdk.CaptureException(ex, scope => scope.SetTag("job", "StaleRequestReminderService"));
                }
            }

            await Task.Delay(RunInterval, stoppingToken);
        }
    }

    private async Task SendRemindersAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var requestRepo = scope.ServiceProvider.GetRequiredService<IRequestRepository>();
        var dispatcher = scope.ServiceProvider.GetRequiredService<IPushNotificationDispatcher>();
        var notificationRepo = scope.ServiceProvider.GetRequiredService<INotificationRepository>();

        var now = DateTime.UtcNow;

        // InReview > 60 min -> medico
        var inReviewCutoff = now - InReviewThreshold;
        var staleInReview = await requestRepo.GetStaleInReviewAsync(inReviewCutoff, ct);
        foreach (var req in staleInReview)
        {
            if (req.DoctorId == null) continue;
            var cooldownKey = $"reminder_inreview:{req.Id}";

            // L1: in-memory check (fast path)
            if (_cache.TryGetValue(cooldownKey, out _)) continue;

            // L2: DB check (survives restarts)
            var since = now - ReminderCooldown;
            var existsInDb = await notificationRepo.ExistsWithDataSinceAsync(
                NotificationType, req.Id.ToString(), since, ct);
            if (existsInDb)
            {
                // Repopulate L1 cache so next iteration skips the DB call
                _cache.Set(cooldownKey, true, ReminderCooldown);
                continue;
            }

            try
            {
                var pushReq = PushNotificationRules.ReminderInReviewStale(req.DoctorId.Value, req.Id, req.RequestType);
                await dispatcher.SendAsync(pushReq, ct);
                _cache.Set(cooldownKey, true, ReminderCooldown);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar lembrete de analise para request {RequestId}", req.Id);
            }
        }
    }

    private static bool IsDatabaseNotConfigured(Exception ex)
    {
        var msg = ex.Message ?? "";
        return msg.Contains("Host", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("connection string", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("not configured", StringComparison.OrdinalIgnoreCase);
    }
}
