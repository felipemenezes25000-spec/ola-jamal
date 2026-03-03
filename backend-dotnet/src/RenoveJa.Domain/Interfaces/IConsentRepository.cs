using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

public interface IConsentRepository
{
    Task<ConsentRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<ConsentRecord>> GetByPatientIdAsync(Guid patientId, CancellationToken cancellationToken = default);
    Task<ConsentRecord> CreateAsync(ConsentRecord consent, CancellationToken cancellationToken = default);
}

