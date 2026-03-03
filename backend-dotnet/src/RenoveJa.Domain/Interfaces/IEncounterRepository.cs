using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Domain.Interfaces;

public interface IEncounterRepository
{
    Task<Encounter?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<Encounter>> GetByPatientIdAsync(Guid patientId, CancellationToken cancellationToken = default);
    Task<List<Encounter>> GetByPractitionerIdAsync(Guid practitionerId, CancellationToken cancellationToken = default);
    Task<List<Encounter>> GetByPatientAndTypeAsync(Guid patientId, EncounterType type, CancellationToken cancellationToken = default);
    Task<Encounter> CreateAsync(Encounter encounter, CancellationToken cancellationToken = default);
    Task<Encounter> UpdateAsync(Encounter encounter, CancellationToken cancellationToken = default);
}

