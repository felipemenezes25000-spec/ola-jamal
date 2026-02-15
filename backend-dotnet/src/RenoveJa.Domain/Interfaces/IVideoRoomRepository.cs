using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

/// <summary>
/// Repositório de salas de vídeo.
/// </summary>
public interface IVideoRoomRepository
{
    Task<VideoRoom?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<VideoRoom?> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default);
    Task<VideoRoom> CreateAsync(VideoRoom videoRoom, CancellationToken cancellationToken = default);
    Task<VideoRoom> UpdateAsync(VideoRoom videoRoom, CancellationToken cancellationToken = default);
}
