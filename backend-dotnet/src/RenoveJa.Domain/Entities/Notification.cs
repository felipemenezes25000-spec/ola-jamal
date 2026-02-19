using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

public class Notification : Entity
{
    public Guid UserId { get; private set; }
    public string Title { get; private set; }
    public string Message { get; private set; }
    public NotificationType NotificationType { get; private set; }
    public bool Read { get; private set; }
    public Dictionary<string, object>? Data { get; private set; }

    private Notification() : base()
    {
        Title = null!;
        Message = null!;
    }

    private Notification(
        Guid id,
        Guid userId,
        string title,
        string message,
        NotificationType notificationType,
        bool read,
        Dictionary<string, object>? data,
        DateTime? createdAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        UserId = userId;
        Title = title;
        Message = message;
        NotificationType = notificationType;
        Read = read;
        Data = data;
    }

    public static Notification Create(
        Guid userId,
        string title,
        string message,
        NotificationType type = NotificationType.Info,
        Dictionary<string, object>? data = null)
    {
        if (userId == Guid.Empty)
            throw new DomainException("User ID is required");

        if (string.IsNullOrWhiteSpace(title))
            throw new DomainException("Title is required");

        if (string.IsNullOrWhiteSpace(message))
            throw new DomainException("Message is required");

        return new Notification(
            Guid.NewGuid(),
            userId,
            title,
            message,
            type,
            false,
            data);
    }

    public static Notification Reconstitute(
        Guid id,
        Guid userId,
        string title,
        string message,
        string notificationType,
        bool read,
        Dictionary<string, object>? data,
        DateTime createdAt)
    {
        return new Notification(
            id,
            userId,
            title,
            message,
            Enum.Parse<NotificationType>(notificationType, true),
            read,
            data,
            createdAt);
    }

    public void MarkAsRead()
    {
        Read = true;
    }
}
