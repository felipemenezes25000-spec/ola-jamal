using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

public interface IPaymentAttemptRepository
{
    Task<PaymentAttempt?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<PaymentAttempt?> GetByCorrelationIdAsync(string correlationId, CancellationToken cancellationToken = default);
    Task<List<PaymentAttempt>> GetByPaymentIdAsync(Guid paymentId, CancellationToken cancellationToken = default);
    Task<List<PaymentAttempt>> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default);
    Task<PaymentAttempt> CreateAsync(PaymentAttempt attempt, CancellationToken cancellationToken = default);
    Task<PaymentAttempt> UpdateAsync(PaymentAttempt attempt, CancellationToken cancellationToken = default);
}
