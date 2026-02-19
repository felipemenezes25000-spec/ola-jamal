using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

/// <summary>
/// Token de uso único para recuperação de senha. Expira em 1 hora.
/// </summary>
public class PasswordResetToken : Entity
{
    public Guid UserId { get; private set; }
    public string Token { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public bool Used { get; private set; }

<<<<<<< HEAD
    private PasswordResetToken() : base()
    {
        Token = null!;
    }
=======
    private PasswordResetToken() : base() { }
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55

    private PasswordResetToken(
        Guid id,
        Guid userId,
        string token,
        DateTime expiresAt,
        bool used,
        DateTime? createdAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        UserId = userId;
        Token = token;
        ExpiresAt = expiresAt;
        Used = used;
    }

    public static PasswordResetToken Create(Guid userId, int expirationHours = 1)
    {
        if (userId == Guid.Empty)
            throw new DomainException("User ID is required");

        // Token URL-safe (sem =, +, /) para não quebrar filtro PostgREST na query string
        var part1 = Convert.ToBase64String(Guid.NewGuid().ToByteArray()).Replace("+", "-").Replace("/", "_").Replace("=", "");
        var part2 = Convert.ToBase64String(Guid.NewGuid().ToByteArray()).Replace("+", "-").Replace("/", "_").Replace("=", "");
        var token = part1 + part2;

        return new PasswordResetToken(
            Guid.NewGuid(),
            userId,
            token,
            DateTime.UtcNow.AddHours(expirationHours),
            false);
    }

    public static PasswordResetToken Reconstitute(
        Guid id,
        Guid userId,
        string token,
        DateTime expiresAt,
        bool used,
        DateTime createdAt)
    {
        // Garante UTC na comparação: o banco persiste timestamptz em UTC; JSON pode vir com Kind Unspecified
        var expiresAtUtc = expiresAt.Kind == DateTimeKind.Utc
            ? expiresAt
            : DateTime.SpecifyKind(expiresAt, DateTimeKind.Utc);
        return new PasswordResetToken(id, userId, token, expiresAtUtc, used, createdAt);
    }

    /// <summary>Considera expirado só após 1 minuto além de ExpiresAt, para evitar corte no mesmo segundo.</summary>
    public bool IsExpired() => DateTime.UtcNow.AddHours(-3) > ExpiresAt.AddMinutes(1);
    public bool IsValid() => !Used && !IsExpired();

    public void MarkAsUsed()
    {
        Used = true;
    }
}
