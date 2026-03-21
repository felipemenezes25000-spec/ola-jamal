using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;
namespace RenoveJa.Application.Services.Notifications;

/// <summary>
/// Background service que envia lembretes para medicos com certificados digitais proximos do vencimento.
/// Thresholds: 30, 7 e 1 dia(s) antes do vencimento.
/// Cooldown: 24h (evita spam, mas lembra diariamente nos ultimos 7 dias).
/// </summary>
public class CertificateExpiryReminderService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<CertificateExpiryReminderService> _logger;

    private static readonly TimeSpan RunInterval = TimeSpan.FromHours(24);
    private static readonly TimeSpan ReminderCooldown = TimeSpan.FromHours(24);
    private static readonly int[] ThresholdDays = [30, 7, 1];
    private const string NotificationType = "certificate_expiring_soon";
    private const int MaxExpiryDays = 30;

    public CertificateExpiryReminderService(
        IServiceScopeFactory scopeFactory,
        IMemoryCache cache,
        ILogger<CertificateExpiryReminderService> logger)
    {
        _scopeFactory = scopeFactory;
        _cache = cache;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Small initial delay to let the application finish startup
        await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SendRemindersAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                if (IsDatabaseNotConfigured(ex))
                    _logger.LogDebug("Database nao configurado, ignorando lembretes de certificado");
                else
                {
                    _logger.LogError(ex, "Erro ao enviar lembretes de certificado expirando");
                }
            }

            await Task.Delay(RunInterval, stoppingToken);
        }
    }

    private async Task SendRemindersAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var certificateRepo = scope.ServiceProvider.GetRequiredService<ICertificateRepository>();
        var doctorRepo = scope.ServiceProvider.GetRequiredService<IDoctorRepository>();
        var dispatcher = scope.ServiceProvider.GetRequiredService<IPushNotificationDispatcher>();
        var notificationRepo = scope.ServiceProvider.GetRequiredService<INotificationRepository>();

        var now = DateTime.UtcNow;

        // Get all certificates expiring within 30 days
        var expiringCerts = await certificateRepo.GetExpiringAsync(MaxExpiryDays, ct);

        _logger.LogInformation("CertificateExpiryReminder: found {Count} certificates expiring within {Days} days",
            expiringCerts.Count, MaxExpiryDays);

        foreach (var cert in expiringCerts)
        {
            var daysLeft = (int)Math.Ceiling((cert.NotAfter - now).TotalDays);
            if (daysLeft < 0) continue;

            // Only notify at specific thresholds
            var matchedThreshold = GetMatchedThreshold(daysLeft);
            if (matchedThreshold == null) continue;

            var cooldownKey = $"cert_expiry:{cert.Id}:{matchedThreshold}";

            // L1: in-memory check (fast path)
            if (_cache.TryGetValue(cooldownKey, out _)) continue;

            // L2: DB check (survives restarts)
            var since = now - ReminderCooldown;
            var existsInDb = await notificationRepo.ExistsWithDataSinceAsync(
                NotificationType, cert.Id.ToString(), since, ct);
            if (existsInDb)
            {
                _cache.Set(cooldownKey, true, ReminderCooldown);
                continue;
            }

            try
            {
                // Resolve doctor's UserId from DoctorProfileId
                var doctorProfile = await doctorRepo.GetByIdAsync(cert.DoctorProfileId, ct);
                if (doctorProfile == null)
                {
                    _logger.LogWarning("CertificateExpiryReminder: DoctorProfile {ProfileId} not found for certificate {CertId}",
                        cert.DoctorProfileId, cert.Id);
                    continue;
                }

                var pushReq = PushNotificationRules.CertificateExpiringSoon(doctorProfile.UserId, matchedThreshold.Value);
                await dispatcher.SendAsync(pushReq, ct);
                _cache.Set(cooldownKey, true, ReminderCooldown);

                _logger.LogInformation(
                    "CertificateExpiryReminder: notified doctor {UserId} — certificate {CertId} expires in {Days} days",
                    doctorProfile.UserId, cert.Id, daysLeft);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar lembrete de certificado expirando para cert {CertId}", cert.Id);
            }
        }
    }

    /// <summary>
    /// Returns the matched threshold if daysLeft falls within a threshold bucket.
    /// For daysLeft <= 7, we notify daily (threshold = daysLeft).
    /// For daysLeft around 30, we only notify once at 30.
    /// </summary>
    private static int? GetMatchedThreshold(int daysLeft)
    {
        // Last 7 days: notify daily
        if (daysLeft <= 7) return daysLeft;

        // 30-day threshold: notify when between 28 and 30 days
        if (daysLeft >= 28 && daysLeft <= 30) return 30;

        return null;
    }

    private static bool IsDatabaseNotConfigured(Exception ex)
    {
        var msg = ex.Message ?? "";
        return msg.Contains("Host", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("connection string", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("not configured", StringComparison.OrdinalIgnoreCase);
    }
}
