using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.Video;

/// <summary>
/// Enfileira o requestId no <see cref="RecordingStartChannel"/> para que o
/// <see cref="BackgroundRecordingStarter"/> inicie a gravação com retry e backoff,
/// dando tempo para os participantes entrarem na sala.
/// </summary>
public sealed class StartConsultationRecordingService(
    RecordingStartChannel channel) : IStartConsultationRecording
{
    public Task StartRecordingAsync(Guid requestId, CancellationToken ct = default)
    {
        channel.Writer.TryWrite(requestId);
        return Task.CompletedTask;
    }
}
