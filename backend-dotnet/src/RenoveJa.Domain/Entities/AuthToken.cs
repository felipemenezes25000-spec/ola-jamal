using System.Security.Cryptography;
using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

public class AuthToken : Entity
{
    public Guid UserId { get; private set; }
    public string Token { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public string? RefreshToken { get; private set; }
    public DateTime? RefreshTokenExpiresAt { get; private set; }

    private AuthToken() : base()
    {
        Token = null!;
    }

    private AuthToken(
        Guid id,
        Guid userId,
        string token,
        DateTime expiresAt,
        string? refreshToken = null,
        DateTime? refreshTokenExpiresAt = null,
        DateTime? createdAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        UserId = userId;
        Token = token;
        ExpiresAt = expiresAt;
        RefreshToken = refreshToken;
        RefreshTokenExpiresAt = refreshTokenExpiresAt;
    }

    /// <summary>
    /// Creates a new auth token with an associated refresh token.
    /// Access token expires in <paramref name="expirationDays"/> days (default 30).
    /// Refresh token expires in <paramref name="refreshExpirationDays"/> days (default 30).
    /// </summary>
    public static AuthToken Create(Guid userId, int expirationDays = 30, int refreshExpirationDays = 30)
    {
        if (userId == Guid.Empty)
            throw new DomainException("User ID is required");

        var token = GenerateToken();
        var refreshToken = GenerateToken();
        var expiresAt = DateTime.UtcNow.AddDays(expirationDays);
        var refreshExpiresAt = DateTime.UtcNow.AddDays(refreshExpirationDays);

        return new AuthToken(
            Guid.NewGuid(),
            userId,
            token,
            expiresAt,
            refreshToken,
            refreshExpiresAt);
    }

    public static AuthToken Reconstitute(
        Guid id,
        Guid userId,
        string token,
        DateTime expiresAt,
        DateTime createdAt,
        string? refreshToken = null,
        DateTime? refreshTokenExpiresAt = null)
    {
        return new AuthToken(id, userId, token, expiresAt, refreshToken, refreshTokenExpiresAt, createdAt);
    }

    /// <summary>
    /// Rotates the refresh token: generates a new access token + new refresh token,
    /// invalidating the old ones. Used during token refresh flow.
    /// </summary>
    public void RotateTokens(int expirationDays = 30, int refreshExpirationDays = 30)
    {
        Token = GenerateToken();
        ExpiresAt = DateTime.UtcNow.AddDays(expirationDays);
        RefreshToken = GenerateToken();
        RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(refreshExpirationDays);
    }

    private static string GenerateToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
    }

    public bool IsExpired() => DateTime.UtcNow > ExpiresAt;

    public bool IsValid() => !IsExpired();

    public bool IsRefreshTokenValid() =>
        !string.IsNullOrEmpty(RefreshToken) &&
        RefreshTokenExpiresAt.HasValue &&
        DateTime.UtcNow <= RefreshTokenExpiresAt.Value;
}
