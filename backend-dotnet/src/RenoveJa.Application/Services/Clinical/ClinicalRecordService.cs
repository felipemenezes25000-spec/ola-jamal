using Microsoft.Extensions.Logging;
using RenoveJa.Application.DTOs.Clinical;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Domain.ValueObjects;

namespace RenoveJa.Application.Services.Clinical;

public class ClinicalRecordService(
    IUserRepository userRepository,
    IPatientRepository patientRepository,
    IEncounterRepository encounterRepository,
    IMedicalDocumentRepository medicalDocumentRepository,
    IRequestService requestService,
    IAuditService auditService,
    ILogger<ClinicalRecordService> logger) : IClinicalRecordService
{
    public async Task<Patient> EnsurePatientFromUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var existing = await patientRepository.GetByUserIdAsync(userId, cancellationToken);
        if (existing is not null)
            return existing;

        var user = await userRepository.GetByIdAsync(userId, cancellationToken)
                   ?? throw new InvalidOperationException("User not found");

        var patient = Patient.CreateFromUser(
            user.Id,
            user.Name,
            user.Cpf,
            user.BirthDate,
            user.Gender,
            socialName: null,
            phone: user.Phone?.Value,
            email: user.Email,
            addressLine1: user.Address ?? user.Street,
            city: user.City,
            state: user.State,
            zipCode: user.PostalCode);

        patient = await patientRepository.CreateAsync(patient, cancellationToken);

        await auditService.LogModificationAsync(
            userId,
            action: "Create",
            entityType: "Patient",
            entityId: patient.Id,
            cancellationToken: cancellationToken);

        return patient;
    }

    public async Task<Encounter> StartEncounterAsync(
        Guid patientId,
        Guid practitionerId,
        EncounterType type,
        string? channel = null,
        string? reason = null,
        Guid? sourceRequestId = null,
        CancellationToken cancellationToken = default)
    {
        var encounter = Encounter.Start(patientId, practitionerId, type, channel: channel, reason: reason);
        encounter = await encounterRepository.CreateAsync(encounter, cancellationToken, sourceRequestId);

        await auditService.LogModificationAsync(
            practitionerId,
            action: "Create",
            entityType: "Encounter",
            entityId: encounter.Id,
            cancellationToken: cancellationToken);

        return encounter;
    }

    public async Task<Encounter> FinalizeEncounterAsync(
        Guid encounterId,
        string? anamnesis = null,
        string? physicalExam = null,
        string? plan = null,
        string? mainIcd10Code = null,
        string? differentialDiagnosis = null,
        string? patientInstructions = null,
        string? redFlags = null,
        string? structuredAnamnesis = null,
        CancellationToken cancellationToken = default)
    {
        var encounter = await encounterRepository.GetByIdAsync(encounterId, cancellationToken)
                       ?? throw new InvalidOperationException("Encounter not found");

        encounter.UpdateClinicalNotes(anamnesis, physicalExam, plan, mainIcd10Code,
            differentialDiagnosis, patientInstructions, redFlags, structuredAnamnesis);
        encounter.FinalizeEncounter();

        encounter = await encounterRepository.UpdateAsync(encounter, cancellationToken);

        await auditService.LogModificationAsync(
            encounter.PractitionerId,
            action: "Update",
            entityType: "Encounter",
            entityId: encounter.Id,
            cancellationToken: cancellationToken);

        return encounter;
    }

    public async Task<Prescription> CreatePrescriptionAsync(
        Guid encounterId,
        IEnumerable<(string Drug, string? Concentration, string? Form, string? Posology, string? Duration, int? Quantity, string? Notes)> items,
        string? generalInstructions,
        CancellationToken cancellationToken = default)
    {
        var encounter = await encounterRepository.GetByIdAsync(encounterId, cancellationToken)
                       ?? throw new InvalidOperationException("Encounter not found");

        var prescription = Prescription.Create(encounter.PatientId, encounter.PractitionerId, encounter.Id, generalInstructions);
        foreach (var item in items)
        {
            prescription.AddItem(
                item.Drug,
                item.Concentration,
                item.Form,
                item.Posology,
                item.Duration,
                item.Quantity,
                item.Notes);
        }

        prescription = (Prescription)await medicalDocumentRepository.CreateAsync(prescription, cancellationToken);

        await auditService.LogModificationAsync(
            encounter.PractitionerId,
            action: "Create",
            entityType: "MedicalDocument",
            entityId: prescription.Id,
            cancellationToken: cancellationToken);

        return prescription;
    }

    public async Task<ExamOrder> CreateExamOrderAsync(
        Guid encounterId,
        IEnumerable<(string Type, string? Code, string Description)> items,
        string? clinicalJustification,
        string? priority,
        CancellationToken cancellationToken = default)
    {
        var encounter = await encounterRepository.GetByIdAsync(encounterId, cancellationToken)
                       ?? throw new InvalidOperationException("Encounter not found");

        var order = ExamOrder.Create(encounter.PatientId, encounter.PractitionerId, encounter.Id, clinicalJustification, priority);
        foreach (var item in items)
        {
            order.AddItem(item.Type, item.Code, item.Description);
        }

        order = (ExamOrder)await medicalDocumentRepository.CreateAsync(order, cancellationToken);

        await auditService.LogModificationAsync(
            encounter.PractitionerId,
            action: "Create",
            entityType: "MedicalDocument",
            entityId: order.Id,
            cancellationToken: cancellationToken);

        return order;
    }

    public async Task<MedicalReport> CreateMedicalReportAsync(
        Guid encounterId,
        string body,
        string? icd10Code,
        int? leaveDays,
        CancellationToken cancellationToken = default)
    {
        var encounter = await encounterRepository.GetByIdAsync(encounterId, cancellationToken)
                       ?? throw new InvalidOperationException("Encounter not found");

        var report = MedicalReport.Create(encounter.PatientId, encounter.PractitionerId, encounter.Id, body, icd10Code, leaveDays);

        report = (MedicalReport)await medicalDocumentRepository.CreateAsync(report, cancellationToken);

        await auditService.LogModificationAsync(
            encounter.PractitionerId,
            action: "Create",
            entityType: "MedicalDocument",
            entityId: report.Id,
            cancellationToken: cancellationToken);

        return report;
    }

    public async Task SignDocumentAsync(
        Guid documentId,
        string documentHash,
        string hashAlgorithm,
        string certificateIdentifier,
        DateTime signedAt,
        bool isValid,
        string? validationResult,
        string? policyOid,
        CancellationToken cancellationToken = default)
    {
        var doc = await medicalDocumentRepository.GetByIdAsync(documentId, cancellationToken)
                  ?? throw new InvalidOperationException("Document not found");

        var signature = SignatureInfo.Create(
            documentHash,
            hashAlgorithm,
            certificateIdentifier,
            signedAt,
            isValid,
            validationResult,
            policyOid);

        doc.ApplySignature(signature);

        await medicalDocumentRepository.UpdateAsync(doc, cancellationToken);

        await auditService.LogModificationAsync(
            null,
            action: "Sign",
            entityType: "MedicalDocument",
            entityId: doc.Id,
            cancellationToken: cancellationToken);
    }

    public async Task<PatientSummaryDto> GetPatientSummaryAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            var user = await userRepository.GetByIdAsync(userId, cancellationToken)
                       ?? throw new InvalidOperationException("User not found");

            var patient = await patientRepository.GetByUserIdAsync(userId, cancellationToken);
            var encounters = patient != null
                ? await encounterRepository.GetByPatientIdAsync(patient.Id, cancellationToken)
                : new List<Encounter>();

            var documents = patient != null
                ? await medicalDocumentRepository.GetByPatientIdAsync(patient.Id, cancellationToken)
                : new List<MedicalDocument>();

            var requests = await requestService.GetUserRequestsAsync(userId, status: null, type: null, cancellationToken);
            var requestsTotal = requests.Count;
            var clinicalTotal = documents.Count + encounters.Count;

            if (documents.Count == 0 && encounters.Count == 0)
            {
                return BuildSummaryFromRequests(userId, user, requests);
            }

            if (requestsTotal > clinicalTotal)
            {
                return BuildSummaryFromRequests(userId, user, requests);
            }

            var now = DateTime.UtcNow.Date;

            var lastConsultation = encounters
                .Where(e => e.Type == EncounterType.Teleconsultation || e.Type == EncounterType.FollowUp)
                .OrderByDescending(e => e.StartedAt)
                .FirstOrDefault();

            int? lastConsultationDaysAgo = null;
            if (lastConsultation is not null)
            {
                var days = (int)(now - lastConsultation.StartedAt.Date).TotalDays;
                lastConsultationDaysAgo = days < 0 ? 0 : days;
            }

            var recentMeds = documents
                .OfType<Prescription>()
                .OrderByDescending(d => d.CreatedAt)
                .Take(10)
                .SelectMany(d => d.Items)
                .Select(i => i.Drug.Trim())
                .Where(m => m.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(20)
                .ToList();

            var recentExams = documents
                .OfType<ExamOrder>()
                .OrderByDescending(d => d.CreatedAt)
                .Take(10)
                .SelectMany(d => d.Items)
                .Select(i => i.Description.Trim())
                .Where(e => e.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(20)
                .ToList();

            return new PatientSummaryDto
            {
                Id = user.Id,
                Identifier = new PatientIdentifierDto { Cpf = user.Cpf ?? string.Empty },
                Name = new PatientNameDto { Full = user.Name, Social = null },
                BirthDate = user.BirthDate?.Date,
                Sex = user.Gender,
                Contact = new PatientContactDto { Phone = user.Phone?.Value, Email = user.Email },
                Address = new PatientAddressDto
                {
                    Line1 = user.Address,
                    City = user.City,
                    State = user.State,
                    ZipCode = user.PostalCode
                },
                Stats = new PatientSummaryStatsDto
                {
                    TotalRequests = documents.Count,
                    TotalPrescriptions = documents.Count(d => d.DocumentType == DocumentType.Prescription),
                    TotalExams = documents.Count(d => d.DocumentType == DocumentType.ExamOrder),
                    TotalConsultations = encounters.Count,
                    LastConsultationDate = lastConsultation?.StartedAt,
                    LastConsultationDaysAgo = lastConsultationDaysAgo
                },
                Medications = recentMeds,
                Exams = recentExams
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Erro ao montar PatientSummary para userId {UserId}", userId);
            throw;
        }
    }

    private PatientSummaryDto BuildSummaryFromRequests(
        Guid userId,
        User user,
        IReadOnlyList<Application.DTOs.Requests.RequestResponseDto> requests)
    {
        var now = DateTime.UtcNow;

        var totalRequests = requests.Count;
        var totalPrescriptions = requests.Count(r => r.RequestType == "prescription");
        var totalExams = requests.Count(r => r.RequestType == "exam");
        var totalConsultations = requests.Count(r => r.RequestType == "consultation");

        var lastConsultation = requests
            .Where(r => r.RequestType == "consultation")
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefault();

        int? lastConsultationDaysAgo = null;
        if (lastConsultation is not null)
        {
            lastConsultationDaysAgo = (int)(now.Date - lastConsultation.CreatedAt.Date).TotalDays;
            if (lastConsultationDaysAgo < 0) lastConsultationDaysAgo = 0;
        }

        var recentMeds = requests
            .Where(r => r.RequestType == "prescription" && r.Medications is { Count: > 0 })
            .OrderByDescending(r => r.CreatedAt)
            .Take(10)
            .SelectMany(r => r.Medications!)
            .Select(m => (m ?? string.Empty).Trim())
            .Where(m => m.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(20)
            .ToList();

        var recentExams = requests
            .Where(r => r.RequestType == "exam" && r.Exams is { Count: > 0 })
            .OrderByDescending(r => r.CreatedAt)
            .Take(10)
            .SelectMany(r => r.Exams!)
            .Select(e => (e ?? string.Empty).Trim())
            .Where(e => e.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(20)
            .ToList();

        return new PatientSummaryDto
        {
            Id = user.Id,
            Identifier = new PatientIdentifierDto { Cpf = user.Cpf ?? string.Empty },
            Name = new PatientNameDto { Full = user.Name, Social = null },
            BirthDate = user.BirthDate?.Date,
            Sex = user.Gender,
            Contact = new PatientContactDto { Phone = user.Phone?.Value, Email = user.Email },
            Address = new PatientAddressDto
            {
                Line1 = user.Address,
                City = user.City,
                State = user.State,
                ZipCode = user.PostalCode
            },
            Stats = new PatientSummaryStatsDto
            {
                TotalRequests = totalRequests,
                TotalPrescriptions = totalPrescriptions,
                TotalExams = totalExams,
                TotalConsultations = totalConsultations,
                LastConsultationDate = lastConsultation?.CreatedAt,
                LastConsultationDaysAgo = lastConsultationDaysAgo
            },
            Medications = recentMeds,
            Exams = recentExams
        };
    }

    private async Task<PatientSummaryDto> BuildSummaryFromRequestsAsync(
        Guid userId,
        User user,
        CancellationToken cancellationToken)
    {
        var requests = await requestService.GetUserRequestsAsync(userId, status: null, type: null, cancellationToken);
        return BuildSummaryFromRequests(userId, user, requests);
    }

    public async Task<IReadOnlyList<EncounterSummaryDto>> GetEncountersByPatientAsync(
        Guid userId,
        int limit = 50,
        int offset = 0,
        CancellationToken cancellationToken = default)
    {
        var patient = await patientRepository.GetByUserIdAsync(userId, cancellationToken);
        List<EncounterSummaryDto> fromClinical = new();

        if (patient != null)
        {
            var encounters = await encounterRepository.GetByPatientIdAsync(patient.Id, cancellationToken);
            fromClinical = encounters
                .OrderByDescending(e => e.StartedAt)
                .Skip(offset)
                .Take(Math.Min(limit, 100))
                .Select(e => new EncounterSummaryDto
                {
                    Id = e.Id,
                    Type = e.Type,
                    StartedAt = e.StartedAt,
                    FinishedAt = e.FinishedAt,
                    MainIcd10Code = e.MainIcd10Code
                })
                .ToList();
        }

        if (fromClinical.Count > 0)
            return fromClinical;

        return await BuildEncountersFromRequestsAsync(userId, limit, offset, cancellationToken);
    }

    public async Task<IReadOnlyList<MedicalDocumentSummaryDto>> GetMedicalDocumentsByPatientAsync(
        Guid userId,
        int limit = 50,
        int offset = 0,
        CancellationToken cancellationToken = default)
    {
        var patient = await patientRepository.GetByUserIdAsync(userId, cancellationToken);
        List<MedicalDocumentSummaryDto> fromClinical = new();

        if (patient != null)
        {
            var documents = await medicalDocumentRepository.GetByPatientIdAsync(patient.Id, cancellationToken);
            fromClinical = documents
                .OrderByDescending(d => d.CreatedAt)
                .Skip(offset)
                .Take(Math.Min(limit, 100))
                .Select(d => new MedicalDocumentSummaryDto
                {
                    Id = d.Id,
                    DocumentType = d.DocumentType,
                    Status = d.Status.ToString().ToLowerInvariant(),
                    CreatedAt = d.CreatedAt,
                    SignedAt = d.SignedAt,
                    EncounterId = d.EncounterId
                })
                .ToList();
        }

        if (fromClinical.Count > 0)
            return fromClinical;

        return await BuildDocumentsFromRequestsAsync(userId, limit, offset, cancellationToken);
    }

    private async Task<IReadOnlyList<EncounterSummaryDto>> BuildEncountersFromRequestsAsync(
        Guid userId,
        int limit,
        int offset,
        CancellationToken cancellationToken)
    {
        var requests = await requestService.GetUserRequestsAsync(userId, status: null, type: null, cancellationToken);
        var ordered = requests
            .OrderByDescending(r => r.CreatedAt)
            .Skip(offset)
            .Take(Math.Min(limit, 100))
            .ToList();

        var result = new List<EncounterSummaryDto>();
        foreach (var r in ordered)
        {
            var type = r.RequestType?.ToLowerInvariant() switch
            {
                "prescription" => EncounterType.PrescriptionRenewal,
                "exam" => EncounterType.ExamOrder,
                "consultation" => EncounterType.Teleconsultation,
                _ => EncounterType.PrescriptionRenewal
            };

            var isFinished = string.Equals(r.Status, "signed", StringComparison.OrdinalIgnoreCase)
                || string.Equals(r.Status, "delivered", StringComparison.OrdinalIgnoreCase)
                || string.Equals(r.Status, "consultation_finished", StringComparison.OrdinalIgnoreCase)
                || string.Equals(r.Status, "rejected", StringComparison.OrdinalIgnoreCase)
                || string.Equals(r.Status, "cancelled", StringComparison.OrdinalIgnoreCase);

            result.Add(new EncounterSummaryDto
            {
                Id = r.Id,
                Type = type,
                StartedAt = r.CreatedAt,
                FinishedAt = isFinished ? (r.SignedAt ?? r.UpdatedAt) : null,
                MainIcd10Code = null
            });
        }

        return result;
    }

    private async Task<IReadOnlyList<MedicalDocumentSummaryDto>> BuildDocumentsFromRequestsAsync(
        Guid userId,
        int limit,
        int offset,
        CancellationToken cancellationToken)
    {
        var requests = await requestService.GetUserRequestsAsync(userId, status: null, type: null, cancellationToken);
        var docRequests = requests
            .Where(r => r.RequestType is "prescription" or "exam")
            .OrderByDescending(r => r.CreatedAt)
            .Skip(offset)
            .Take(Math.Min(limit, 100))
            .ToList();

        var result = new List<MedicalDocumentSummaryDto>();
        foreach (var r in docRequests)
        {
            var docType = r.RequestType?.ToLowerInvariant() switch
            {
                "prescription" => DocumentType.Prescription,
                "exam" => DocumentType.ExamOrder,
                _ => DocumentType.Prescription
            };

            var status = string.Equals(r.Status, "signed", StringComparison.OrdinalIgnoreCase)
                || string.Equals(r.Status, "delivered", StringComparison.OrdinalIgnoreCase)
                ? "signed"
                : "draft";

            result.Add(new MedicalDocumentSummaryDto
            {
                Id = r.Id,
                DocumentType = docType,
                Status = status,
                CreatedAt = r.CreatedAt,
                SignedAt = r.SignedAt,
                EncounterId = null
            });
        }

        return result;
    }
}

