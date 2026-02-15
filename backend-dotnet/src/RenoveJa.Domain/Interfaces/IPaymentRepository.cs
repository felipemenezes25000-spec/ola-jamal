using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

public interface IPaymentRepository
{
    Task<Payment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Payment?> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default);
    Task<Payment?> GetByExternalIdAsync(string externalId, CancellationToken cancellationToken = default);
    Task<List<Payment>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<Payment> CreateAsync(Payment payment, CancellationToken cancellationToken = default);
    Task<Payment> UpdateAsync(Payment payment, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
