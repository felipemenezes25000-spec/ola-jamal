namespace RenoveJa.Infrastructure.Data.Models;

/// <summary>Modelo de persistência de notificação (tabela notifications).</summary>
public class NotificationModel
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string NotificationType { get; set; } = "info";
    public bool Read { get; set; }
    public Dictionary<string, object>? Data { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class VideoRoomModel
{
    public Guid Id { get; set; }
    public Guid RequestId { get; set; }
    public string RoomName { get; set; } = string.Empty;
    public string? RoomUrl { get; set; }
    public string Status { get; set; } = "waiting";
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public int? DurationSeconds { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Modelo de persistência de token de push (tabela push_tokens).</summary>
public class PushTokenModel
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public string DeviceType { get; set; } = "unknown";
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}
