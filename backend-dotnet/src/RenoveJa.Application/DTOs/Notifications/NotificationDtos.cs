namespace RenoveJa.Application.DTOs.Notifications;

public record NotificationResponseDto(
    Guid Id,
    Guid UserId,
    string Title,
    string Message,
    string NotificationType,
    bool Read,
    Dictionary<string, object>? Data,
    DateTime CreatedAt
);
