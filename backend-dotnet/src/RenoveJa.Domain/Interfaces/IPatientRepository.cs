using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

public interface IPatientRepository
{
    Task<Patient?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Patient?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<Patient> CreateAsync(Patient patient, CancellationToken cancellationToken = default);
    Task<Patient> UpdateAsync(Patient patient, CancellationToken cancellationToken = default);
}

