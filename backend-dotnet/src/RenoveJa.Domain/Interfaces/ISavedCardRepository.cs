using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

public interface ISavedCardRepository
{
    Task<SavedCard?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<SavedCard>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<SavedCard> CreateAsync(SavedCard savedCard, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
