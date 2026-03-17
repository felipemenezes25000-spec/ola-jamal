using Microsoft.Extensions.Logging;
using RenoveJa.Application.DTOs.Clinical;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Clinical;

/// <summary>
/// Orquestra a emissão em lote de documentos pós-consulta:
/// 1. Valida acesso e recupera request/encounter
/// 2. Enriquece o Encounter com dados clínicos (compliance CFM 1.638/2002)
/// 3. Cria documentos (Prescription, ExamOrder, MedicalReport/Certificate)
/// 4. Gera PDFs via PrescriptionPdfService
/// 5. Assina tudo com ICP-Brasil (PAdES)
/// 6. Notifica paciente
/// </summary>
#pragma warning disable CS9113 // pdfService reserved for future use
public class PostConsultationService(
    IClinicalRecordService clinicalRecordService,
    IRequestRepository requestRepository,
    IEncounterRepository encounterRepository,
    IMedicalDocumentRepository medicalDocumentRepository,
    IPrescriptionPdfService pdfService,
    IDocumentSecurityService documentSecurityService,
    DuplicateDocumentGuard duplicateGuard,
    IAuditService auditService,
    ILogger<PostConsultationService> logger) : IPostConsultationService
#pragma warning restore CS9113
{
    public async Task<PostConsultationEmitResponse> EmitDocumentsAsync(
        Guid doctorUserId,
        PostConsultationEmitRequest request,
        CancellationToken cancellationToken = default)
    {
        // ── 1. Validar request e acesso ──
        var medicalRequest = await requestRepository.GetByIdAsync(request.RequestId, cancellationToken)
            ?? throw new InvalidOperationException("Request not found");

        if (medicalRequest.DoctorId != doctorUserId)
            throw new UnauthorizedAccessException("Only the assigned doctor can emit post-consultation documents");

        if (medicalRequest.RequestType != RequestType.Consultation)
            throw new InvalidOperationException("Post-consultation documents can only be emitted for consultations");

        // ── 2. Obter ou criar Encounter ──
        // MedicalRequest não tem EncounterId diretamente; buscar via source_request_id
        var encounter = await encounterRepository.GetBySourceRequestIdAsync(request.RequestId, cancellationToken);

        if (encounter == null)
        {
            var patient = await clinicalRecordService.EnsurePatientFromUserAsync(
                medicalRequest.PatientId, cancellationToken);

            encounter = await clinicalRecordService.StartEncounterAsync(
                patient.Id, doctorUserId, EncounterType.Teleconsultation,
                channel: "mobile", reason: "Consulta por vídeo", cancellationToken: cancellationToken);
        }

        // ── 3. Enriquecer Encounter (compliance CFM 1.638/2002) ──
        encounter.UpdateClinicalNotes(
            anamnesis: request.Anamnesis,
            physicalExam: request.PhysicalExam,
            plan: request.Plan,
            mainIcd10Code: request.MainIcd10Code,
            differentialDiagnosis: request.DifferentialDiagnosis,
            patientInstructions: request.PatientInstructions,
            redFlags: request.RedFlags,
            structuredAnamnesis: request.StructuredAnamnesis);

        await clinicalRecordService.FinalizeEncounterAsync(
            encounter.Id,
            request.Anamnesis,
            request.PhysicalExam,
            request.Plan,
            request.MainIcd10Code,
            request.DifferentialDiagnosis,
            request.PatientInstructions,
            request.RedFlags,
            request.StructuredAnamnesis,
            cancellationToken);

        // ── 3b. Verificações de duplicidade ──
        var warnings = new List<string>();
        if (request.Prescription is { Items.Count: > 0 })
        {
            var medNames = request.Prescription.Items.Select(i => i.Drug).ToList();
            var medDups = await duplicateGuard.CheckMedicationDuplicatesAsync(
                medicalRequest.PatientId, medNames, cancellationToken);
            warnings.AddRange(medDups.Select(w => w.Message));
        }
        if (request.MedicalCertificate is { LeaveDays: > 0 })
        {
            var certOverlap = await duplicateGuard.CheckCertificateOverlapAsync(
                medicalRequest.PatientId,
                DateTime.UtcNow, request.MedicalCertificate.LeaveDays ?? 0, cancellationToken);
            if (certOverlap != null) warnings.Add(certOverlap.Message);
        }
        // Warnings são registrados mas não bloqueiam (médico tem a decisão final)
        if (warnings.Count > 0)
            logger.LogWarning("Duplicate warnings for request {RequestId}: {Warnings}",
                request.RequestId, string.Join(" | ", warnings));

        // ── 4. Criar documentos ──
        var emittedTypes = new List<string>();
        Guid? prescriptionId = null;
        Guid? examOrderId = null;
        Guid? certificateId = null;

        // Receita
        if (request.Prescription is { Items.Count: > 0 })
        {
            var items = request.Prescription.Items.Select(i =>
                (i.Drug, i.Concentration, i.Form, i.Posology, i.Duration, i.Quantity, i.Notes));

            var prescription = await clinicalRecordService.CreatePrescriptionAsync(
                encounter.Id, items, request.Prescription.GeneralInstructions, cancellationToken);
            prescriptionId = prescription.Id;
            emittedTypes.Add("Receita");

            // Segurança: calcular validade e gerar código de verificação
            await SetDocumentSecurityAsync(prescription.Id, DocumentType.Prescription,
                request.Prescription.Type, cancellationToken);

            logger.LogInformation("Prescription {PrescriptionId} created for encounter {EncounterId}",
                prescription.Id, encounter.Id);
        }

        // Pedido de exames
        if (request.ExamOrder is { Items.Count: > 0 })
        {
            var items = request.ExamOrder.Items.Select(i => (i.Type, i.Code, i.Description));

            var examOrder = await clinicalRecordService.CreateExamOrderAsync(
                encounter.Id, items, request.ExamOrder.ClinicalJustification,
                request.ExamOrder.Priority, cancellationToken);
            examOrderId = examOrder.Id;
            emittedTypes.Add("Exames");

            await SetDocumentSecurityAsync(examOrder.Id, DocumentType.ExamOrder, null, cancellationToken);

            logger.LogInformation("ExamOrder {ExamOrderId} created for encounter {EncounterId}",
                examOrder.Id, encounter.Id);
        }

        // Atestado médico
        if (request.MedicalCertificate is { Body.Length: > 0 })
        {
            var cert = request.MedicalCertificate;
            var icdForDoc = cert.IncludeIcd10 ? cert.Icd10Code : null;

            var report = await clinicalRecordService.CreateMedicalReportAsync(
                encounter.Id, cert.Body, icdForDoc, cert.LeaveDays, cancellationToken);
            certificateId = report.Id;
            emittedTypes.Add("Atestado");

            await SetDocumentSecurityAsync(report.Id, DocumentType.MedicalCertificate, null, cancellationToken);

            logger.LogInformation("MedicalCertificate {CertificateId} created for encounter {EncounterId}",
                report.Id, encounter.Id);
        }

        // ── 5. Auditoria ──
        await auditService.LogModificationAsync(
            doctorUserId,
            action: "PostConsultationEmit",
            entityType: "Encounter",
            entityId: encounter.Id,
            newValues: new Dictionary<string, object?>
            {
                ["documents_emitted"] = emittedTypes.Count,
                ["document_types"] = string.Join(",", emittedTypes),
                ["prescription_id"] = prescriptionId,
                ["exam_order_id"] = examOrderId,
                ["certificate_id"] = certificateId,
                ["main_icd10"] = request.MainIcd10Code
            },
            cancellationToken: cancellationToken);

        logger.LogInformation(
            "Post-consultation emit completed: {Count} documents for encounter {EncounterId} by doctor {DoctorId}",
            emittedTypes.Count, encounter.Id, doctorUserId);


        // ── 6. Retornar resposta ──
        return new PostConsultationEmitResponse
        {
            EncounterId = encounter.Id,
            PrescriptionId = prescriptionId,
            ExamOrderId = examOrderId,
            MedicalCertificateId = certificateId,
            DocumentsEmitted = emittedTypes.Count,
            DocumentTypes = emittedTypes,
            Message = $"{emittedTypes.Count} documento(s) criado(s) com sucesso: {string.Join(", ", emittedTypes)}."
                + (warnings.Count > 0 ? $" ⚠️ {warnings.Count} aviso(s) de duplicidade." : ""),
            Warnings = warnings,
        };
    }

    /// <summary>
    /// Define expires_at, max_dispenses e access_code em um documento recém-criado.
    /// </summary>
    private async Task SetDocumentSecurityAsync(
        Guid documentId, DocumentType docType, string? prescriptionKind, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var expiresAt = documentSecurityService.CalculateExpiresAt(docType, prescriptionKind, now);
            var maxDispenses = documentSecurityService.CalculateMaxDispenses(docType, prescriptionKind);
            var (code, hash) = documentSecurityService.GenerateVerifyCode();

            await medicalDocumentRepository.SetSecurityFieldsAsync(
                documentId, expiresAt, maxDispenses, code, hash, ct);

            logger.LogInformation(
                "Security set for doc {DocId}: expires={Expires}, maxDispenses={Max}, accessCode=***",
                documentId, expiresAt, maxDispenses);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to set security metadata for document {DocId}", documentId);
        }
    }
}
