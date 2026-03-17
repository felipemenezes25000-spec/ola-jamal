using RenoveJa.Application.DTOs.Clinical;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Application.Interfaces;

public interface IClinicalRecordService
{
    Task<Patient> EnsurePatientFromUserAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<Encounter> StartEncounterAsync(
        Guid patientId,
        Guid practitionerId,
        EncounterType type,
        string? channel = null,
        string? reason = null,
        CancellationToken cancellationToken = default);

    Task<Encounter> FinalizeEncounterAsync(
        Guid encounterId,
        string? anamnesis = null,
        string? physicalExam = null,
        string? plan = null,
        string? mainIcd10Code = null,
        string? differentialDiagnosis = null,
        string? patientInstructions = null,
        string? redFlags = null,
        string? structuredAnamnesis = null,
        CancellationToken cancellationToken = default);

    Task<Prescription> CreatePrescriptionAsync(
        Guid encounterId,
        IEnumerable<(string Drug, string? Concentration, string? Form, string? Posology, string? Duration, int? Quantity, string? Notes)> items,
        string? generalInstructions,
        CancellationToken cancellationToken = default);

    Task<ExamOrder> CreateExamOrderAsync(
        Guid encounterId,
        IEnumerable<(string Type, string? Code, string Description)> items,
        string? clinicalJustification,
        string? priority,
        CancellationToken cancellationToken = default);

    Task<MedicalReport> CreateMedicalReportAsync(
        Guid encounterId,
        string body,
        string? icd10Code,
        int? leaveDays,
        CancellationToken cancellationToken = default);

    Task SignDocumentAsync(
        Guid documentId,
        string documentHash,
        string hashAlgorithm,
        string certificateIdentifier,
        DateTime signedAt,
        bool isValid,
        string? validationResult,
        string? policyOid,
        CancellationToken cancellationToken = default);

    Task<PatientSummaryDto> GetPatientSummaryAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EncounterSummaryDto>> GetEncountersByPatientAsync(
        Guid userId,
        int limit = 50,
        int offset = 0,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<MedicalDocumentSummaryDto>> GetMedicalDocumentsByPatientAsync(
        Guid userId,
        int limit = 50,
        int offset = 0,
        CancellationToken cancellationToken = default);
}

