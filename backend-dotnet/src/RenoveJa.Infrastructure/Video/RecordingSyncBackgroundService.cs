using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using RenoveJa.Application.Interfaces;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Video;

/// <summary>
/// Background service that periodically checks for consultations finished in the
/// last 24 hours that have no recording synced to S3 and triggers
/// <see cref="IRecordingSyncService.TrySyncRecordingAsync"/> for each one.
/// Runs every 5 minutes as a safety net for when the Daily.co webhook fails.
/// </summary>
public sealed class RecordingSyncBackgroundService(
    IServiceScopeFactory scopeFactory,
    IOptions<DatabaseConfig> dbConfig,
    ILogger<RecordingSyncBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

    private const string UnsyncedConsultationsSql = """
        SELECT r.id FROM requests r
        LEFT JOIN consultation_anamnesis ca ON ca.request_id = r.id
        WHERE r.request_type = 'consultation'
          AND r.status IN ('completed', 'finished', 'post_consultation')
          AND r.updated_at > NOW() - INTERVAL '24 hours'
          AND (ca.recording_file_url IS NULL OR ca.recording_file_url = '')
        """;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("[RecordingSyncBg] Background recording sync started (interval: {Interval})", Interval);

        using var timer = new PeriodicTimer(Interval);

        // Wait for the first tick before processing (avoids running immediately on startup)
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await SyncUnsyncedRecordingsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[RecordingSyncBg] Unhandled error during sync cycle; will retry next interval");
            }
        }

        logger.LogInformation("[RecordingSyncBg] Background recording sync stopped");
    }

    private async Task SyncUnsyncedRecordingsAsync(CancellationToken ct)
    {
        var requestIds = await GetUnsyncedConsultationIdsAsync(ct);

        if (requestIds.Count == 0)
        {
            logger.LogDebug("[RecordingSyncBg] No unsynced consultations found");
            return;
        }

        logger.LogInformation("[RecordingSyncBg] Found {Count} consultation(s) without recording; starting sync", requestIds.Count);

        var synced = 0;
        var failed = 0;

        foreach (var requestId in requestIds)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var syncService = scope.ServiceProvider.GetRequiredService<IRecordingSyncService>();

                var success = await syncService.TrySyncRecordingAsync(requestId, ct);

                if (success)
                    synced++;
                else
                    failed++;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                failed++;
                logger.LogWarning(ex, "[RecordingSyncBg] Error syncing recording for RequestId={RequestId}", requestId);
            }
        }

        logger.LogInformation(
            "[RecordingSyncBg] Sync cycle complete: {Total} total, {Synced} synced, {Failed} failed/skipped",
            requestIds.Count, synced, failed);
    }

    private async Task<List<Guid>> GetUnsyncedConsultationIdsAsync(CancellationToken ct)
    {
        var connectionString = dbConfig.Value.DatabaseUrl;
        if (string.IsNullOrEmpty(connectionString))
        {
            logger.LogWarning("[RecordingSyncBg] DatabaseUrl is not configured; skipping cycle");
            return [];
        }

        var ids = new List<Guid>();

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand(UnsyncedConsultationsSql, connection);
        await using var reader = await cmd.ExecuteReaderAsync(ct);

        while (await reader.ReadAsync(ct))
        {
            ids.Add(reader.GetGuid(0));
        }

        return ids;
    }
}
