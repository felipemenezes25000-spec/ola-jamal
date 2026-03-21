using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
namespace RenoveJa.Application.Services.Notifications;

/// <summary>
/// Background service que envia lembretes de renovacao de receita.
/// Receitas entregues (delivered) que vencem nos proximos 7 dias -> paciente.
/// Cooldown de 7 dias por request para evitar spam.
/// Cooldown usa IMemoryCache como L1 (rapido) e DB como L2 (persistente apos restart).
/// </summary>
public class RenewalReminderService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<RenewalReminderService> _logger;
    private static readonly TimeSpan RunInterval = TimeSpan.FromHours(24);
    private static readonly TimeSpan ReminderCooldown = TimeSpan.FromDays(7);
    private const int DaysAhead = 7;
    private const string NotificationType = "reminder_renewal";

    public RenewalReminderService(IServiceScopeFactory scopeFactory, IMemoryCache cache, ILogger<RenewalReminderService> logger)
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
                    _logger.LogDebug("Database nao configurado, ignorando lembretes de renovacao de receita");
                else
                {
                    _logger.LogError(ex, "Erro ao enviar lembretes de renovacao de receita");
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

        // Receitas legadas (tabela requests)
        var expiring = await requestRepo.GetPrescriptionsExpiringSoonAsync(now, DaysAhead, ct);

        foreach (var req in expiring)
        {
            if (req.RequestType != RequestType.Prescription) continue;

            var cooldownKey = $"reminder_renewal:{req.Id}";

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
                var pushReq = PushNotificationRules.RenewalReminder(req.PatientId, req.Id);
                await dispatcher.SendAsync(pushReq, ct);
                _cache.Set(cooldownKey, true, ReminderCooldown);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar lembrete de renovacao para request {RequestId}", req.Id);
            }
        }

        // Documentos pos-consulta (tabela medical_documents com expires_at)
        try
        {
            var docRepo = scope.ServiceProvider.GetRequiredService<IMedicalDocumentRepository>();
            // TODO: Adicionar metodo GetExpiringDocumentsAsync no IMedicalDocumentRepository
            // Por enquanto, o fluxo de requests cobre o cenario principal
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Medical document expiration check skipped");
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
