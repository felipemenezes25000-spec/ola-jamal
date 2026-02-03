using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

public class VideoRoom : Entity
{
    public Guid RequestId { get; private set; }
    public string RoomName { get; private set; }
    public string? RoomUrl { get; private set; }
    public VideoRoomStatus Status { get; private set; }
    public DateTime? StartedAt { get; private set; }
    public DateTime? EndedAt { get; private set; }
    public int? DurationSeconds { get; private set; }

    private VideoRoom() : base() { }

    private VideoRoom(
        Guid id,
        Guid requestId,
        string roomName,
        string? roomUrl,
        VideoRoomStatus status,
        DateTime? startedAt,
        DateTime? endedAt,
        int? durationSeconds,
        DateTime? createdAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        RequestId = requestId;
        RoomName = roomName;
        RoomUrl = roomUrl;
        Status = status;
        StartedAt = startedAt;
        EndedAt = endedAt;
        DurationSeconds = durationSeconds;
    }

    public static VideoRoom Create(Guid requestId, string roomName)
    {
        if (requestId == Guid.Empty)
            throw new DomainException("Request ID is required");

        if (string.IsNullOrWhiteSpace(roomName))
            throw new DomainException("Room name is required");

        return new VideoRoom(
            Guid.NewGuid(),
            requestId,
            roomName,
            null,
            VideoRoomStatus.Waiting,
            null,
            null,
            null);
    }

    public static VideoRoom Reconstitute(
        Guid id,
        Guid requestId,
        string roomName,
        string? roomUrl,
        string status,
        DateTime? startedAt,
        DateTime? endedAt,
        int? durationSeconds,
        DateTime createdAt)
    {
        return new VideoRoom(
            id,
            requestId,
            roomName,
            roomUrl,
            Enum.Parse<VideoRoomStatus>(status, true),
            startedAt,
            endedAt,
            durationSeconds,
            createdAt);
    }

    public void SetRoomUrl(string roomUrl)
    {
        if (string.IsNullOrWhiteSpace(roomUrl))
            throw new DomainException("Room URL cannot be empty");

        RoomUrl = roomUrl;
    }

    public void Start()
    {
        if (Status != VideoRoomStatus.Waiting)
            throw new DomainException("Room can only be started from waiting status");

        Status = VideoRoomStatus.Active;
        StartedAt = DateTime.UtcNow;
    }

    public void End()
    {
        if (Status != VideoRoomStatus.Active)
            throw new DomainException("Room must be active to end");

        EndedAt = DateTime.UtcNow;
        Status = VideoRoomStatus.Ended;

        if (StartedAt.HasValue)
        {
            DurationSeconds = (int)(EndedAt.Value - StartedAt.Value).TotalSeconds;
        }
    }
}
