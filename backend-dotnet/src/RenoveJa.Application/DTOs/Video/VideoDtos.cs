namespace RenoveJa.Application.DTOs.Video;

public record CreateVideoRoomRequestDto(
    Guid RequestId
);

public record VideoRoomResponseDto(
    Guid Id,
    Guid RequestId,
    string RoomName,
    string? RoomUrl,
    string Status,
    DateTime? StartedAt,
    DateTime? EndedAt,
    int? DurationSeconds,
    DateTime CreatedAt
);
