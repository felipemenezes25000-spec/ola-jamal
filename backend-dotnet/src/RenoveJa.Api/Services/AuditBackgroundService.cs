using System.Threading.Channels;
using RenoveJa.Application.Interfaces;
using Sentry;

namespace RenoveJa.Api.Services;

/// <summary>
/// Dados capturados pelo AuditMiddleware para persistir de forma assíncrona.
/// </summary>
public sealed record AuditEntry(
    Guid? UserId,
    string Action,
    string EntityType,
    Guid? EntityId,
    string? IpAddress,
    string? UserAgent,
    string? CorrelationId,
    Dictionary<string, object?>? Metadata);

/// <summary>
/// Canal compartilhado entre o AuditMiddleware (produtor) e o AuditBackgroundService (consumidor).
/// Registrado como Singleton no DI.
/// </summary>
public sealed class AuditChannel
{
    private readonly Channel<AuditEntry> _channel;

    public AuditChannel()
    {
        var options = new BoundedChannelOptions(1000)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false
        };
        _channel = Channel.CreateBounded<AuditEntry>(options);
    }

    public ChannelWriter<AuditEntry> Writer => _channel.Writer;
    public ChannelReader<AuditEntry> Reader => _channel.Reader;
}

/// <summary>
/// Background service que consome audit entries do canal e persiste no banco via IAuditService.
/// Inclui retry com backoff exponencial (3 tentativas) e shutdown graceful.
/// </summary>
public sealed class AuditBackgroundService(
    AuditChannel channel,
    IServiceScopeFactory scopeFactory,
    ILogger<AuditBackgroundService> logger) : BackgroundService
{
    private const int MaxRetries = 3;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("AuditBackgroundService started");

        await foreach (var entry in channel.Reader.ReadAllAsync(stoppingToken))
        {
            await PersistWithRetryAsync(entry, stoppingToken);
        }

        // Shutdown graceful: drenar itens restantes no canal
        logger.LogInformation("AuditBackgroundService draining remaining entries...");
        while (channel.Reader.TryRead(out var remaining))
        {
            await PersistWithRetryAsync(remaining, CancellationToken.None);
        }

        logger.LogInformation("AuditBackgroundService stopped");
    }

    private async Task PersistWithRetryAsync(AuditEntry entry, CancellationToken ct)
    {
        for (var attempt = 1; attempt <= MaxRetries; attempt++)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var auditService = scope.ServiceProvider.GetRequiredService<IAuditService>();

                await auditService.LogAsync(
                    userId: entry.UserId,
                    action: entry.Action,
                    entityType: entry.EntityType,
                    entityId: entry.EntityId,
                    ipAddress: entry.IpAddress,
                    userAgent: entry.UserAgent,
                    correlationId: entry.CorrelationId,
                    metadata: entry.Metadata,
                    cancellationToken: ct);

                return; // success
            }
            catch (Exception ex) when (attempt < MaxRetries)
            {
                var delayMs = (int)Math.Pow(2, attempt) * 100; // 200ms, 400ms
                logger.LogWarning(ex,
                    "Audit persist attempt {Attempt}/{MaxRetries} failed. Retrying in {DelayMs}ms",
                    attempt, MaxRetries, delayMs);
                await Task.Delay(delayMs, ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "Audit persist failed after {MaxRetries} attempts for {Action} on {EntityType}",
                    MaxRetries, entry.Action, entry.EntityType);
                SentrySdk.CaptureException(ex, scope =>
                {
                    scope.SetTag("job", "AuditBackgroundService");
                    scope.SetExtra("action", entry.Action);
                    scope.SetExtra("entityType", entry.EntityType);
                });
            }
        }
    }
}
