using RenoveJa.Application.DTOs.Video;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Video;

/// <summary>
/// Serviço de salas de vídeo para consultas.
/// </summary>
public interface IVideoService
{
    Task<VideoRoomResponseDto> CreateRoomAsync(CreateVideoRoomRequestDto dto, CancellationToken cancellationToken = default);
    Task<VideoRoomResponseDto> GetRoomAsync(Guid id, CancellationToken cancellationToken = default);
}

/// <summary>
/// Implementação do serviço de vídeo (criar sala, obter sala).
/// </summary>
public class VideoService(
    IVideoRoomRepository videoRoomRepository,
    IRequestRepository requestRepository) : IVideoService
{
    /// <summary>
    /// Cria uma sala de vídeo para uma solicitação de consulta.
    /// </summary>
    public async Task<VideoRoomResponseDto> CreateRoomAsync(
        CreateVideoRoomRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(dto.RequestId, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        var roomName = $"consultation-{request.Id}";
        var videoRoom = VideoRoom.Create(request.Id, roomName);

        videoRoom.SetRoomUrl($"https://meet.renoveja.com/{roomName}");

        videoRoom = await videoRoomRepository.CreateAsync(videoRoom, cancellationToken);

        return MapToDto(videoRoom);
    }

    /// <summary>
    /// Obtém uma sala de vídeo pelo ID.
    /// </summary>
    public async Task<VideoRoomResponseDto> GetRoomAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var videoRoom = await videoRoomRepository.GetByIdAsync(id, cancellationToken);
        if (videoRoom == null)
            throw new KeyNotFoundException("Video room not found");

        return MapToDto(videoRoom);
    }

    private static VideoRoomResponseDto MapToDto(VideoRoom room)
    {
        return new VideoRoomResponseDto(
            room.Id,
            room.RequestId,
            room.RoomName,
            room.RoomUrl,
            room.Status.ToString().ToLowerInvariant(),
            room.StartedAt,
            room.EndedAt,
            room.DurationSeconds,
            room.CreatedAt);
    }
}
