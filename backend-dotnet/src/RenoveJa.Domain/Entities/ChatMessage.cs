using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

public class ChatMessage : Entity
{
    public Guid RequestId { get; private set; }
    public Guid SenderId { get; private set; }
    public string? SenderName { get; private set; }
    public SenderType SenderType { get; private set; }
    public string Message { get; private set; }
    public bool Read { get; private set; }

    private ChatMessage() : base() { }

    private ChatMessage(
        Guid id,
        Guid requestId,
        Guid senderId,
        string? senderName,
        SenderType senderType,
        string message,
        bool read,
        DateTime? createdAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        RequestId = requestId;
        SenderId = senderId;
        SenderName = senderName;
        SenderType = senderType;
        Message = message;
        Read = read;
    }

    public static ChatMessage Create(
        Guid requestId,
        Guid senderId,
        string senderName,
        SenderType senderType,
        string message)
    {
        if (requestId == Guid.Empty)
            throw new DomainException("Request ID is required");

        if (senderId == Guid.Empty)
            throw new DomainException("Sender ID is required");

        if (string.IsNullOrWhiteSpace(message))
            throw new DomainException("Message cannot be empty");

        return new ChatMessage(
            Guid.NewGuid(),
            requestId,
            senderId,
            senderName,
            senderType,
            message,
            false);
    }

    public static ChatMessage Reconstitute(
        Guid id,
        Guid requestId,
        Guid senderId,
        string? senderName,
        string senderType,
        string message,
        bool read,
        DateTime createdAt)
    {
        return new ChatMessage(
            id,
            requestId,
            senderId,
            senderName,
            Enum.Parse<SenderType>(senderType, true),
            message,
            read,
            createdAt);
    }

    public void MarkAsRead()
    {
        Read = true;
    }
}
