using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Domain.ValueObjects;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;
using RenoveJa.Infrastructure.Utils;

namespace RenoveJa.Infrastructure.Repositories;

public class MedicalDocumentRepository(SupabaseClient supabase) : IMedicalDocumentRepository
{
    private const string TableName = "medical_documents";

    public async Task<MedicalDocument?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<MedicalDocumentModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<MedicalDocument>> GetByPatientIdAsync(Guid patientId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<MedicalDocumentModel>(
            TableName,
            filter: $"patient_id=eq.{patientId}",
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).Where(d => d != null).Cast<MedicalDocument>().ToList();
    }

    public async Task<List<MedicalDocument>> GetByEncounterIdAsync(Guid encounterId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<MedicalDocumentModel>(
            TableName,
            filter: $"encounter_id=eq.{encounterId}",
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).Where(d => d != null).Cast<MedicalDocument>().ToList();
    }

    public async Task<List<MedicalDocument>> GetByPatientAndTypeAsync(Guid patientId, DocumentType documentType, CancellationToken cancellationToken = default)
    {
        var typeStr = SnakeCaseHelper.ToSnakeCase(documentType.ToString());
        var models = await supabase.GetAllAsync<MedicalDocumentModel>(
            TableName,
            filter: $"patient_id=eq.{patientId}&document_type=eq.{typeStr}",
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).Where(d => d != null).Cast<MedicalDocument>().ToList();
    }

    public async Task<MedicalDocument> CreateAsync(MedicalDocument document, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(document);
        var created = await supabase.InsertAsync<MedicalDocumentModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created)!;
    }

    public async Task<MedicalDocument> UpdateAsync(MedicalDocument document, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(document);
        var updated = await supabase.UpdateAsync<MedicalDocumentModel>(
            TableName,
            $"id=eq.{document.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated)!;
    }

    private static MedicalDocument? MapToDomain(MedicalDocumentModel model)
    {
        var docType = ParseDocumentType(model.DocumentType);
        var status = ParseDocumentStatus(model.Status);
        SignatureInfo? sig = null;
        if (!string.IsNullOrWhiteSpace(model.SignatureHash) && model.SignedAt.HasValue)
        {
            sig = SignatureInfo.Create(
                model.SignatureHash,
                model.SignatureAlgorithm ?? "SHA-256",
                model.SignatureCertificate ?? "",
                model.SignedAt.Value,
                model.SignatureIsValid ?? false,
                model.SignatureValidationResult,
                model.SignaturePolicyOid);
        }

        return docType switch
        {
            DocumentType.Prescription => Prescription.Reconstitute(
                model.Id,
                model.PatientId,
                model.PractitionerId,
                model.EncounterId,
                model.GeneralInstructions,
                (model.Medications ?? []).Select(m => PrescriptionItem.FromStorage(
                    Guid.NewGuid(),
                    model.Id,
                    m,
                    null, null, null, null, null,
                    null,
                    model.CreatedAt)).ToList(),
                model.PreviousDocumentId,
                sig,
                status,
                model.CreatedAt),
            DocumentType.ExamOrder => ExamOrder.Reconstitute(
                model.Id,
                model.PatientId,
                model.PractitionerId,
                model.EncounterId,
                model.ClinicalJustification,
                model.Priority,
                (model.Exams ?? []).Select(e => ExamItem.FromStorage(
                    Guid.NewGuid(),
                    model.Id,
                    "exam",
                    null,
                    e,
                    model.CreatedAt)).ToList(),
                model.PreviousDocumentId,
                sig,
                status,
                model.CreatedAt),
            DocumentType.MedicalReport => MedicalReport.Reconstitute(
                model.Id,
                model.PatientId,
                model.PractitionerId,
                model.EncounterId,
                model.ReportBody ?? "",
                model.Icd10Code,
                model.LeaveDays,
                model.PreviousDocumentId,
                sig,
                status,
                model.CreatedAt),
            _ => null
        };
    }

    private static MedicalDocumentModel MapToModel(MedicalDocument document)
    {
        var model = new MedicalDocumentModel
        {
            Id = document.Id,
            PatientId = document.PatientId,
            PractitionerId = document.PractitionerId,
            EncounterId = document.EncounterId,
            DocumentType = SnakeCaseHelper.ToSnakeCase(document.DocumentType.ToString()),
            Status = SnakeCaseHelper.ToSnakeCase(document.Status.ToString()),
            PreviousDocumentId = document.PreviousDocumentId,
            CreatedAt = document.CreatedAt
        };

        if (document.Signature != null)
        {
            model.SignatureHash = document.Signature.DocumentHash;
            model.SignatureAlgorithm = document.Signature.HashAlgorithm;
            model.SignatureCertificate = document.Signature.CertificateIdentifier;
            model.SignedAt = document.Signature.SignedAt;
            model.SignatureIsValid = document.Signature.IsValid;
            model.SignatureValidationResult = document.Signature.ValidationResult;
            model.SignaturePolicyOid = document.Signature.PolicyOid;
        }

        switch (document)
        {
            case Prescription rx:
                model.Medications = rx.Items.Select(i => i.Drug).ToList();
                model.GeneralInstructions = rx.GeneralInstructions;
                break;
            case ExamOrder ex:
                model.Exams = ex.Items.Select(i => i.Description).ToList();
                model.ClinicalJustification = ex.ClinicalJustification;
                model.Priority = ex.Priority;
                break;
            case MedicalReport mr:
                model.ReportBody = mr.Body;
                model.Icd10Code = mr.Icd10Code;
                model.LeaveDays = mr.LeaveDays;
                break;
        }

        return model;
    }

    private static DocumentType ParseDocumentType(string? value)
    {
        var v = (value ?? "").Trim().ToLowerInvariant();
        return v switch
        {
            "prescription" => DocumentType.Prescription,
            "exam_order" => DocumentType.ExamOrder,
            "medical_report" => DocumentType.MedicalReport,
            _ => DocumentType.Prescription
        };
    }

    private static DocumentStatus ParseDocumentStatus(string? value)
    {
        var v = (value ?? "").Trim().ToLowerInvariant();
        return v switch
        {
            "signed" => DocumentStatus.Signed,
            "cancelled" => DocumentStatus.Cancelled,
            "superseded" => DocumentStatus.Superseded,
            _ => DocumentStatus.Draft
        };
    }
}
