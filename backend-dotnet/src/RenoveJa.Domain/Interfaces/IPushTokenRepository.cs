using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

/// <summary>
/// Repositório de tokens de push.
/// </summary>
public interface IPushTokenRepository
{
    Task<PushToken?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<PushToken>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<List<PushToken>> GetAllByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<PushToken> CreateAsync(PushToken pushToken, CancellationToken cancellationToken = default);

    /// <summary>
    /// Registra ou reativa um token de push. Idempotente: se (user_id, token) já existir,
    /// reativa e retorna; caso contrário, insere.
    /// </summary>
    Task<PushToken> RegisterOrUpdateAsync(PushToken pushToken, CancellationToken cancellationToken = default);
    Task DeleteByTokenAsync(string token, Guid userId, CancellationToken cancellationToken = default);
    Task<bool> UpdateActiveAsync(Guid id, Guid userId, bool active, CancellationToken cancellationToken = default);
    Task SetAllActiveForUserAsync(Guid userId, bool active, CancellationToken cancellationToken = default);
    Task DeactivateByTokenAsync(string token, Guid userId, CancellationToken ct = default);
}
