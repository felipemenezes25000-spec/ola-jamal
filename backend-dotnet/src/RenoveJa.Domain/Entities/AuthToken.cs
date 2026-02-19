using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

public class AuthToken : Entity
{
    public Guid UserId { get; private set; }
    public string Token { get; private set; }
    public DateTime ExpiresAt { get; private set; }

<<<<<<< HEAD
    private AuthToken() : base()
    {
        Token = null!;
    }
=======
    private AuthToken() : base() { }
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55

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
<<<<<<< HEAD
        return Convert.ToBase64String(Guid.NewGuid().ToByteArray()) +
=======
        return Convert.ToBase64String(Guid.NewGuid().ToByteArray()) + 
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
               Convert.ToBase64String(Guid.NewGuid().ToByteArray());
    }

    public bool IsExpired() => DateTime.UtcNow > ExpiresAt;

    public bool IsValid() => !IsExpired();
}
