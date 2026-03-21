using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;

namespace RenoveJa.Infrastructure.Video;

/// <summary>
/// Singleton wrapper around an unbounded <see cref="Channel{Guid}"/> used to
/// enqueue consultation request IDs whose cloud recording must be started.
/// </summary>
public sealed class RecordingStartChannel
{
    private readonly Channel<Guid> _channel = Channel.CreateUnbounded<Guid>(
        new UnboundedChannelOptions { SingleReader = true });

    public ChannelWriter<Guid> Writer => _channel.Writer;
    public ChannelReader<Guid> Reader => _channel.Reader;
}

/// <summary>
/// Background service that reads request IDs from <see cref="RecordingStartChannel"/>
/// and retries starting the Daily.co cloud recording up to 3 times with exponential
/// backoff (10 s, 20 s, 40 s).
/// </summary>
public sealed class BackgroundRecordingStarter(
    RecordingStartChannel channel,
    IServiceScopeFactory scopeFactory,
    ILogger<BackgroundRecordingStarter> logger) : IHostedService, IDisposable
{
    private const int MaxRetries = 3;
    private static readonly TimeSpan[] Delays =
    [
        TimeSpan.FromSeconds(10),
        TimeSpan.FromSeconds(20),
        TimeSpan.FromSeconds(40)
    ];

    private CancellationTokenSource? _cts;
    private Task? _runningTask;

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _runningTask = ProcessQueueAsync(_cts.Token);
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_cts is not null)
        {
            await _cts.CancelAsync();
        }

        if (_runningTask is not null)
        {
            await Task.WhenAny(_runningTask, Task.Delay(Timeout.Infinite, cancellationToken));
        }
    }

    private async Task ProcessQueueAsync(CancellationToken ct)
    {
        await foreach (var requestId in channel.Reader.ReadAllAsync(ct))
        {
            await StartRecordingWithRetriesAsync(requestId, ct);
        }
    }

    private async Task StartRecordingWithRetriesAsync(Guid requestId, CancellationToken ct)
    {
        for (var attempt = 0; attempt < MaxRetries; attempt++)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                await Task.Delay(Delays[attempt], ct);

                await using var scope = scopeFactory.CreateAsyncScope();
                var dailyConfig = scope.ServiceProvider.GetRequiredService<IOptions<DailyConfig>>().Value;
                var videoService = scope.ServiceProvider.GetRequiredService<IDailyVideoService>();

                var roomName = dailyConfig.GetRoomName(requestId);

                var started = await videoService.StartRecordingAsync(roomName, ct);

                if (started)
                {
                    logger.LogInformation(
                        "Cloud recording started for request {RequestId} (room {RoomName}) on attempt {Attempt}",
                        requestId, roomName, attempt + 1);
                    return;
                }

                logger.LogWarning(
                    "Daily API returned false for recording start on request {RequestId} (attempt {Attempt}/{MaxRetries})",
                    requestId, attempt + 1, MaxRetries);
                // Continue to next retry
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogWarning(
                    ex,
                    "Failed to start cloud recording for request {RequestId} (attempt {Attempt}/{MaxRetries})",
                    requestId, attempt + 1, MaxRetries);
            }
        }

        logger.LogError(
            "Exhausted all {MaxRetries} retries to start cloud recording for request {RequestId}",
            MaxRetries, requestId);
    }

    public void Dispose()
    {
        _cts?.Dispose();
    }
}
