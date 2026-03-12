using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

public class PushToken : Entity
{
    public Guid UserId { get; private set; }
    public string Token { get; private set; }
    public string DeviceType { get; private set; }
    public bool Active { get; private set; }
    /// <summary>Role do usuário: "patient" ou "doctor". Usado para filtrar envio por targetRole.</summary>
    public string Role { get; private set; } = "patient";

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
        DateTime? createdAt = null,
        string role = "patient")
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        UserId = userId;
        Token = token;
        DeviceType = deviceType;
        Active = active;
        Role = role;
    }

    public static PushToken Create(Guid userId, string token, string? deviceType = null, string role = "patient")
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
            true,
            role: role);
    }

    public static PushToken Reconstitute(
        Guid id,
        Guid userId,
        string token,
        string deviceType,
        bool active,
        DateTime createdAt,
        string role = "patient")
    {
        return new PushToken(id, userId, token, deviceType, active, createdAt, role);
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
