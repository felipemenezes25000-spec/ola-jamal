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
/// - ApprovedPendingPayment &gt; 6h → paciente (pagamento pendente)
/// - InReview &gt; 30 min → médico (pedido parado em análise)
/// Evita spam: cada lembrete por request é enviado no máximo 1x a cada 12h.
/// </summary>
public class StaleRequestReminderService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<StaleRequestReminderService> _logger;
    private static readonly TimeSpan PaymentPendingThreshold = TimeSpan.FromHours(6);
    private static readonly TimeSpan InReviewThreshold = TimeSpan.FromMinutes(60);
    private static readonly TimeSpan RunInterval = TimeSpan.FromMinutes(20);
    private static readonly TimeSpan ReminderCooldown = TimeSpan.FromHours(12);

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
                    _logger.LogDebug("Database não configurado, ignorando lembretes de pedidos parados");
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

        var now = DateTime.UtcNow;

        // Pagamento pendente > 6h → paciente
        var paymentCutoff = now - PaymentPendingThreshold;
        var stalePayment = await requestRepo.GetStaleApprovedPendingPaymentAsync(paymentCutoff, ct);
        foreach (var req in stalePayment)
        {
            var cooldownKey = $"reminder_payment:{req.Id}";
            if (_cache.TryGetValue(cooldownKey, out _)) continue;
            try
            {
                var pushReq = PushNotificationRules.ReminderPaymentPending(req.PatientId, req.Id, req.RequestType);
                await dispatcher.SendAsync(pushReq, ct);
                _cache.Set(cooldownKey, true, ReminderCooldown);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar lembrete de pagamento para request {RequestId}", req.Id);
            }
        }

        // InReview > 30 min → médico
        var inReviewCutoff = now - InReviewThreshold;
        var staleInReview = await requestRepo.GetStaleInReviewAsync(inReviewCutoff, ct);
        foreach (var req in staleInReview)
        {
            if (req.DoctorId == null) continue;
            var cooldownKey = $"reminder_inreview:{req.Id}";
            if (_cache.TryGetValue(cooldownKey, out _)) continue;
            try
            {
                var pushReq = PushNotificationRules.ReminderInReviewStale(req.DoctorId.Value, req.Id, req.RequestType);
                await dispatcher.SendAsync(pushReq, ct);
                _cache.Set(cooldownKey, true, ReminderCooldown);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar lembrete de análise para request {RequestId}", req.Id);
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
