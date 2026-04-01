using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

/// <summary>
/// Repositório de tokens de autenticação.
/// </summary>
public interface IAuthTokenRepository
{
    Task<AuthToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default);
    Task<AuthToken?> GetByRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task<List<AuthToken>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<AuthToken> CreateAsync(AuthToken authToken, CancellationToken cancellationToken = default);
    Task<AuthToken> UpdateAsync(AuthToken authToken, CancellationToken cancellationToken = default);
    /// <summary>
    /// Atomic rotate: atualiza token apenas se refresh_token antigo ainda bater (optimistic concurrency).
    /// Retorna null se outro request já rotacionou (zero rows affected).
    /// </summary>
    Task<AuthToken?> TryRotateAsync(AuthToken authToken, string previousRefreshToken, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    Task DeleteByTokenAsync(string token, CancellationToken cancellationToken = default);
    Task DeleteByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task DeleteExpiredTokensAsync(CancellationToken cancellationToken = default);
}
