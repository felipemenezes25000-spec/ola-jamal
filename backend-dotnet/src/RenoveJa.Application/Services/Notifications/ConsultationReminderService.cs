using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
namespace RenoveJa.Application.Services.Notifications;

/// <summary>
/// Background service que envia lembretes de "consulta começando em breve":
/// - Consultas em status Paid/ConsultationReady com updated_at nos últimos 15 min
///   (proxy para "agendadas para breve", já que não há campo scheduled_at).
/// - Notifica paciente e médico via ConsultationStartingSoon.
/// - Cooldown por requestId evita envio duplicado.
/// Roda a cada 5 minutos.
/// </summary>
public class ConsultationReminderService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ConsultationReminderService> _logger;
    private static readonly TimeSpan RunInterval = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan ReminderCooldown = TimeSpan.FromHours(4);

    public ConsultationReminderService(IServiceScopeFactory scopeFactory, IMemoryCache cache, ILogger<ConsultationReminderService> logger)
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
                    _logger.LogDebug("Database não configurado, ignorando lembretes de consulta");
                else
                {
                    _logger.LogError(ex, "Erro ao enviar lembretes de consulta próxima");
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

        // Busca consultas aceitas (Paid/ConsultationReady) com médico atribuído
        var consultations = await requestRepo.GetUpcomingConsultationsAsync(ct);

        var now = DateTime.UtcNow;
        const int reminderWindowMinutes = 15;

        foreach (var req in consultations)
        {
            if (req.DoctorId == null) continue;

            // Usar UpdatedAt como proxy para quando a consulta foi aceita/paga.
            // Se foi atualizada (aceita) nos últimos 15 min, o paciente/médico provavelmente
            // estão prestes a iniciar. Consultas mais antigas já receberam lembrete ou são stale.
            var minutesSinceUpdate = (now - req.UpdatedAt).TotalMinutes;
            if (minutesSinceUpdate > reminderWindowMinutes) continue;

            var cooldownKey = $"consultation_starting:{req.Id}";
            if (_cache.TryGetValue(cooldownKey, out _)) continue;

            try
            {
                var minutesLeft = Math.Max(1, (int)(reminderWindowMinutes - minutesSinceUpdate));

                // Notificar paciente
                var patientNotif = PushNotificationRules.ConsultationStartingSoon(
                    req.PatientId, req.Id, minutesLeft, isDoctor: false);
                await dispatcher.SendAsync(patientNotif, ct);

                // Notificar médico
                var doctorNotif = PushNotificationRules.ConsultationStartingSoon(
                    req.DoctorId.Value, req.Id, minutesLeft, isDoctor: true);
                await dispatcher.SendAsync(doctorNotif, ct);

                _cache.Set(cooldownKey, true, ReminderCooldown);
                _logger.LogInformation(
                    "Lembrete de consulta enviado para request {RequestId} (paciente + médico, ~{MinutesLeft} min)",
                    req.Id, minutesLeft);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar lembrete de consulta para request {RequestId}", req.Id);
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
