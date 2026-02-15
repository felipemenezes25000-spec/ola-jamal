using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

public interface IPasswordResetTokenRepository
{
    Task<PasswordResetToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default);
    Task<PasswordResetToken> CreateAsync(PasswordResetToken entity, CancellationToken cancellationToken = default);
    Task UpdateAsync(PasswordResetToken entity, CancellationToken cancellationToken = default);
    Task InvalidateByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
}
