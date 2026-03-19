using System.Text.Json;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Domain.ValueObjects;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;
using RenoveJa.Infrastructure.Utils;

namespace RenoveJa.Infrastructure.Repositories;

public class MedicalDocumentRepository(PostgresClient db) : IMedicalDocumentRepository
{
    private const string TableName = "medical_documents";

    public async Task<MedicalDocument?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await db.GetSingleAsync<MedicalDocumentModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<MedicalDocument>> GetByPatientIdAsync(Guid patientId, CancellationToken cancellationToken = default)
    {
        var models = await db.GetAllAsync<MedicalDocumentModel>(
            TableName,
            filter: $"patient_id=eq.{patientId}",
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).Where(d => d != null).Cast<MedicalDocument>().ToList();
    }

    public async Task<List<MedicalDocument>> GetByEncounterIdAsync(Guid encounterId, CancellationToken cancellationToken = default)
    {
        var models = await db.GetAllAsync<MedicalDocumentModel>(
            TableName,
            filter: $"encounter_id=eq.{encounterId}",
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).Where(d => d != null).Cast<MedicalDocument>().ToList();
    }

    public async Task<List<MedicalDocument>> GetByPatientAndTypeAsync(Guid patientId, DocumentType documentType, CancellationToken cancellationToken = default)
    {
        var typeStr = SnakeCaseHelper.ToSnakeCase(documentType.ToString());
        var models = await db.GetAllAsync<MedicalDocumentModel>(
            TableName,
            filter: $"patient_id=eq.{patientId}&document_type=eq.{typeStr}",
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).Where(d => d != null).Cast<MedicalDocument>().ToList();
    }

    public async Task<MedicalDocument?> GetBySourceRequestIdAsync(Guid sourceRequestId, DocumentType documentType, CancellationToken cancellationToken = default)
    {
        var typeStr = SnakeCaseHelper.ToSnakeCase(documentType.ToString());
        var model = await db.GetSingleAsync<MedicalDocumentModel>(
            TableName,
            filter: $"source_request_id=eq.{sourceRequestId}&document_type=eq.{typeStr}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<MedicalDocument> CreateAsync(MedicalDocument document, CancellationToken cancellationToken = default, Guid? sourceRequestId = null, string? signedDocumentUrl = null, string? signatureId = null)
    {
        var model = MapToModel(document);
        if (sourceRequestId.HasValue)
            model.SourceRequestId = sourceRequestId.Value;
        if (!string.IsNullOrEmpty(signedDocumentUrl))
            model.SignedDocumentUrl = signedDocumentUrl;
        if (!string.IsNullOrEmpty(signatureId))
            model.SignatureId = signatureId;
        var created = await db.InsertAsync<MedicalDocumentModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created)!;
    }

    public async Task<MedicalDocument> UpdateAsync(MedicalDocument document, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(document);
        var existing = await db.GetSingleAsync<MedicalDocumentModel>(TableName, filter: $"id=eq.{document.Id}", cancellationToken: cancellationToken);
        if (existing != null)
        {
            model.SourceRequestId = existing.SourceRequestId;
            model.SignedDocumentUrl = existing.SignedDocumentUrl ?? model.SignedDocumentUrl;
            model.SignatureId = existing.SignatureId ?? model.SignatureId;
        }
        var updated = await db.UpdateAsync<MedicalDocumentModel>(
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
                (JsonToList(model.Medications)).Select(m => ParsePrescriptionItem(m, model.Id, model.CreatedAt)).ToList(),
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
                (JsonToList(model.Exams)).Select(e => ExamItem.FromStorage(
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
                model.Medications = ListToJson(rx.Items.Select(SerializePrescriptionItem).ToList());
                model.GeneralInstructions = rx.GeneralInstructions;
                break;
            case ExamOrder ex:
                model.Exams = ListToJson(ex.Items.Select(i => i.Description).ToList());
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

    private static string SerializePrescriptionItem(PrescriptionItem i)
    {
        var parts = new List<string> { i.Drug };
        if (!string.IsNullOrEmpty(i.Posology)) parts.Add(i.Posology);
        if (!string.IsNullOrEmpty(i.Duration)) parts.Add(i.Duration);
        if (!string.IsNullOrEmpty(i.Notes)) parts.Add(i.Notes);
        return parts.Count == 1 ? i.Drug : string.Join("||", parts);
    }

    private static PrescriptionItem ParsePrescriptionItem(string s, Guid docId, DateTime createdAt)
    {
        var parts = s.Split("||", 4, StringSplitOptions.None);
        var drug = parts[0].Trim();
        var posology = parts.Length > 1 && !string.IsNullOrWhiteSpace(parts[1]) ? parts[1].Trim() : null;
        var duration = parts.Length > 2 && !string.IsNullOrWhiteSpace(parts[2]) ? parts[2].Trim() : null;
        var notes = parts.Length > 3 && !string.IsNullOrWhiteSpace(parts[3]) ? parts[3].Trim() : null;
        return PrescriptionItem.FromStorage(Guid.NewGuid(), docId, drug, null, null, posology, duration, null, notes, createdAt);
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
    private static string? ListToJson(List<string>? list) => list == null || list.Count == 0 ? null : JsonSerializer.Serialize(list);
    private static List<string> JsonToList(string? json) { if (string.IsNullOrWhiteSpace(json) || json == "null") return new(); try { return JsonSerializer.Deserialize<List<string>>(json) ?? new(); } catch { return new(); } }

    public async Task<string?> GetSignedDocumentUrlAsync(Guid documentId, CancellationToken cancellationToken = default)
    {
        var model = await db.GetSingleAsync<MedicalDocumentModel>(
            TableName,
            filter: $"id=eq.{documentId}",
            cancellationToken: cancellationToken);
        return model?.SignedDocumentUrl;
    }

    public async Task SetSecurityFieldsAsync(Guid documentId, DateTime? expiresAt, int maxDispenses, string? accessCode, string? verifyCodeHash, CancellationToken cancellationToken = default)
    {
        var updates = new
        {
            expires_at = expiresAt,
            max_dispenses = maxDispenses,
            access_code = accessCode,
            verify_code_hash = verifyCodeHash,
        };
        await db.UpdateAsync<MedicalDocumentModel>(TableName, $"id=eq.{documentId}", updates, cancellationToken);
    }

    public async Task SetSignedDocumentAsync(
        Guid documentId,
        string signedDocumentUrl,
        string? signatureId,
        string documentHash,
        string hashAlgorithm,
        string certificateIdentifier,
        DateTime signedAt,
        bool isValid,
        string? validationResult,
        string? policyOid,
        CancellationToken cancellationToken = default)
    {
        var updates = new
        {
            signed_document_url = signedDocumentUrl,
            signature_id = signatureId,
            signature_hash = documentHash,
            signature_algorithm = hashAlgorithm,
            signature_certificate = certificateIdentifier,
            signed_at = signedAt,
            signature_is_valid = isValid,
            signature_validation_result = validationResult,
            signature_policy_oid = policyOid,
            status = "signed",
        };
        await db.UpdateAsync<MedicalDocumentModel>(TableName, $"id=eq.{documentId}", updates, cancellationToken);
    }

    public async Task<(string? accessCode, string? verifyCodeHash, DateTime? expiresAt, int dispensedCount)?> GetSecurityFieldsAsync(Guid documentId, CancellationToken cancellationToken = default)
    {
        var model = await db.GetSingleAsync<MedicalDocumentModel>(
            TableName,
            filter: $"id=eq.{documentId}",
            cancellationToken: cancellationToken);
        if (model == null) return null;
        return (model.AccessCode, model.VerifyCodeHash, model.ExpiresAt, model.DispensedCount);
    }

    public async Task<Guid?> GetSourceRequestIdAsync(Guid documentId, CancellationToken cancellationToken = default)
    {
        var model = await db.GetSingleAsync<MedicalDocumentModel>(
            TableName,
            filter: $"id=eq.{documentId}",
            cancellationToken: cancellationToken);
        return model?.SourceRequestId;
    }
}
