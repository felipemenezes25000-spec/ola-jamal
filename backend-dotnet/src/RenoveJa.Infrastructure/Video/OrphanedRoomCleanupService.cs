using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Video;

/// <summary>
/// Background service that periodically cleans up Daily.co rooms for consultations
/// that have been cancelled or rejected. If a video room exists in the DB and the
/// associated request is Cancelled/Rejected, the Daily room is deleted.
/// Runs every 10 minutes.
/// </summary>
public sealed class OrphanedRoomCleanupService(
    IServiceScopeFactory scopeFactory,
    PostgresClient postgresClient,
    ILogger<OrphanedRoomCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(10);

    /// <summary>
    /// Finds video rooms where the associated request is cancelled or rejected
    /// and the room was created in the last 48 hours (to avoid scanning the entire table).
    /// </summary>
    private const string OrphanedRoomsSql = """
        SELECT vr.room_name, vr.id AS video_room_id, r.id AS request_id, r.status
        FROM video_rooms vr
        INNER JOIN requests r ON r.id = vr.request_id
        WHERE (
            r.status IN ('cancelled', 'rejected', 'pending_post_consultation', 'completed')
            OR (r.status = 'in_consultation' AND vr.created_at < NOW() - INTERVAL '4 hours')
        )
          AND vr.status != 'ended'
          AND vr.created_at > NOW() - INTERVAL '48 hours'
        LIMIT 50
        """;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("[OrphanedRoomCleanup] Background orphaned room cleanup started (interval: {Interval})", Interval);

        using var timer = new PeriodicTimer(Interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await CleanupOrphanedRoomsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[OrphanedRoomCleanup] Unhandled error during cleanup cycle; will retry next interval");
            }
        }

        logger.LogInformation("[OrphanedRoomCleanup] Background orphaned room cleanup stopped");
    }

    private async Task CleanupOrphanedRoomsAsync(CancellationToken ct)
    {
        var orphanedRooms = await GetOrphanedRoomsAsync(ct);

        if (orphanedRooms.Count == 0)
        {
            logger.LogDebug("[OrphanedRoomCleanup] No orphaned rooms found");
            return;
        }

        logger.LogInformation("[OrphanedRoomCleanup] Found {Count} orphaned room(s) to clean up", orphanedRooms.Count);

        var cleaned = 0;
        var failed = 0;

        foreach (var (roomName, videoRoomId, requestId, status) in orphanedRooms)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var dailyService = scope.ServiceProvider.GetRequiredService<IDailyVideoService>();

                await dailyService.DeleteRoomAsync(roomName, ct);

                // Mark video_room as 'ended' so it won't be picked up again
                await MarkVideoRoomEndedAsync(videoRoomId, ct);

                logger.LogInformation(
                    "[OrphanedRoomCleanup] Deleted orphaned Daily room — RoomName={RoomName} RequestId={RequestId} RequestStatus={RequestStatus} VideoRoomId={VideoRoomId}",
                    roomName, requestId, status, videoRoomId);

                cleaned++;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                failed++;
                logger.LogWarning(ex,
                    "[OrphanedRoomCleanup] Failed to delete orphaned room — RoomName={RoomName} RequestId={RequestId}",
                    roomName, requestId);
            }
        }

        logger.LogInformation(
            "[OrphanedRoomCleanup] Cleanup cycle complete: {Total} total, {Cleaned} cleaned, {Failed} failed",
            orphanedRooms.Count, cleaned, failed);
    }

    private async Task<List<(string RoomName, Guid VideoRoomId, Guid RequestId, string Status)>> GetOrphanedRoomsAsync(CancellationToken ct)
    {
        var results = new List<(string, Guid, Guid, string)>();

        await using var connection = postgresClient.CreateConnectionPublic();
        await connection.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand(OrphanedRoomsSql, connection);
        await using var reader = await cmd.ExecuteReaderAsync(ct);

        while (await reader.ReadAsync(ct))
        {
            var roomName = reader.GetString(0);
            var videoRoomId = reader.GetGuid(1);
            var requestId = reader.GetGuid(2);
            var status = reader.GetString(3);
            results.Add((roomName, videoRoomId, requestId, status));
        }

        return results;
    }

    private async Task MarkVideoRoomEndedAsync(Guid videoRoomId, CancellationToken ct)
    {
        await using var connection = postgresClient.CreateConnectionPublic();
        await connection.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand(
            "UPDATE video_rooms SET status = 'ended', ended_at = NOW() WHERE id = @id",
            connection);
        cmd.Parameters.AddWithValue("id", videoRoomId);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
