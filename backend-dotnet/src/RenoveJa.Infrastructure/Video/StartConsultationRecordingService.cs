using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.Video;

/// <summary>
/// Inicia gravação cloud no Daily.co quando a consulta é iniciada.
/// Garante que haja gravação de vídeo mesmo se o token do médico não iniciar.
/// </summary>
public sealed class StartConsultationRecordingService(
    IDailyVideoService dailyVideoService,
    IOptions<DailyConfig> dailyConfig) : IStartConsultationRecording
{
    public async Task StartRecordingAsync(Guid requestId, CancellationToken ct = default)
    {
        var roomName = dailyConfig.Value.GetRoomName(requestId);
        await dailyVideoService.StartRecordingAsync(roomName, ct);
    }
}
