using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

public class PushToken : Entity
{
    public Guid UserId { get; private set; }
    public string Token { get; private set; }
    public string DeviceType { get; private set; }
    public bool Active { get; private set; }

    private PushToken() : base()
    {
        Token = null!;
        DeviceType = null!;
    }

    private PushToken(
        Guid id,
        Guid userId,
        string token,
        string deviceType,
        bool active,
        DateTime? createdAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        UserId = userId;
        Token = token;
        DeviceType = deviceType;
        Active = active;
    }

    public static PushToken Create(Guid userId, string token, string? deviceType = null)
    {
        if (userId == Guid.Empty)
            throw new DomainException("User ID is required");

        if (string.IsNullOrWhiteSpace(token))
            throw new DomainException("Token is required");

        return new PushToken(
            Guid.NewGuid(),
            userId,
            token,
            deviceType ?? "unknown",
            true);
    }

    public static PushToken Reconstitute(
        Guid id,
        Guid userId,
        string token,
        string deviceType,
        bool active,
        DateTime createdAt)
    {
        return new PushToken(id, userId, token, deviceType, active, createdAt);
    }

    public void Deactivate()
    {
        Active = false;
    }

    public void Activate()
    {
        Active = true;
    }
}
