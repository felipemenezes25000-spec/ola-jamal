using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

public class AuthToken : Entity
{
    public Guid UserId { get; private set; }
    public string Token { get; private set; }
    public DateTime ExpiresAt { get; private set; }

    private AuthToken() : base() { }

    private AuthToken(
        Guid id,
        Guid userId,
        string token,
        DateTime expiresAt,
        DateTime? createdAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        UserId = userId;
        Token = token;
        ExpiresAt = expiresAt;
    }

    public static AuthToken Create(Guid userId, int expirationDays = 30)
    {
        if (userId == Guid.Empty)
            throw new DomainException("User ID is required");

        var token = GenerateToken();
        var expiresAt = DateTime.UtcNow.AddDays(expirationDays);

        return new AuthToken(
            Guid.NewGuid(),
            userId,
            token,
            expiresAt);
    }

    public static AuthToken Reconstitute(
        Guid id,
        Guid userId,
        string token,
        DateTime expiresAt,
        DateTime createdAt)
    {
        return new AuthToken(id, userId, token, expiresAt, createdAt);
    }

    private static string GenerateToken()
    {
        return Convert.ToBase64String(Guid.NewGuid().ToByteArray()) + 
               Convert.ToBase64String(Guid.NewGuid().ToByteArray());
    }

    public bool IsExpired() => DateTime.UtcNow > ExpiresAt;

    public bool IsValid() => !IsExpired();
}
