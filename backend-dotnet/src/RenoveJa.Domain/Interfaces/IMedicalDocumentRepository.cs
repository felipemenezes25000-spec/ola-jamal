using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Domain.Interfaces;

public interface IMedicalDocumentRepository
{
    Task<MedicalDocument?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<MedicalDocument>> GetByPatientIdAsync(Guid patientId, CancellationToken cancellationToken = default);
    Task<List<MedicalDocument>> GetByEncounterIdAsync(Guid encounterId, CancellationToken cancellationToken = default);
    Task<List<MedicalDocument>> GetByPatientAndTypeAsync(Guid patientId, DocumentType documentType, CancellationToken cancellationToken = default);
    Task<MedicalDocument> CreateAsync(MedicalDocument document, CancellationToken cancellationToken = default);
    Task<MedicalDocument> UpdateAsync(MedicalDocument document, CancellationToken cancellationToken = default);
}

