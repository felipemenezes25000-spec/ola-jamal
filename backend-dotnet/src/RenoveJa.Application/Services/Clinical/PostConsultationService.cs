using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Clinical;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Clinical;

/// <summary>
/// Orquestra a emissão em lote de documentos pós-consulta:
/// 1. Valida acesso e recupera request/encounter
/// 2. Enriquece o Encounter com dados clínicos (compliance CFM 1.638/2002)
/// 3. Cria documentos (Prescription, ExamOrder, MedicalReport/Certificate)
/// 4. Gera PDFs via PrescriptionPdfService (1 PDF por documento)
/// 5. Assina tudo com ICP-Brasil (PAdES)
/// 6. Notifica paciente
/// </summary>
public class PostConsultationService(
    IClinicalRecordService clinicalRecordService,
    IRequestRepository requestRepository,
    IEncounterRepository encounterRepository,
    IMedicalDocumentRepository medicalDocumentRepository,
    IDoctorRepository doctorRepository,
    IUserRepository userRepository,
    IDocumentSecurityService documentSecurityService,
    IPrescriptionPdfService prescriptionPdfService,
    IDigitalCertificateService digitalCertificateService,
    IOptions<VerificationConfig> verificationConfig,
    DuplicateDocumentGuard duplicateGuard,
    IPushNotificationDispatcher pushDispatcher,
    IRequestEventsPublisher requestEventsPublisher,
    IAuditService auditService,
    ILogger<PostConsultationService> logger) : IPostConsultationService
{
    /// <summary>Extract only the ICD-10 code portion (e.g. "J06.9") from a string
    /// that may contain a description like "J06.9 — Infecção aguda". Truncates to 20 chars max.</summary>
    private static string? SanitizeIcd10(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var m = Regex.Match(raw, @"[A-Z]\d{2}(?:\.\d{1,2})?", RegexOptions.IgnoreCase);
        var code = m.Success ? m.Value.ToUpperInvariant() : raw.Trim();
        return code.Length > 20 ? code[..20] : code;
    }

    public async Task<PostConsultationEmitResponse> EmitDocumentsAsync(
        Guid doctorUserId,
        PostConsultationEmitRequest request,
        CancellationToken cancellationToken = default)
    {
        // Sanitizar ICD-10 codes antes de qualquer persistência
        request = request with { MainIcd10Code = SanitizeIcd10(request.MainIcd10Code) };
        if (request.MedicalCertificate != null)
            request = request with { MedicalCertificate = request.MedicalCertificate with { Icd10Code = SanitizeIcd10(request.MedicalCertificate.Icd10Code) } };
        if (request.Referral != null)
            request = request with { Referral = request.Referral with { Icd10Code = SanitizeIcd10(request.Referral.Icd10Code) } };

        // ── 1. Validar request e acesso ──
        var medicalRequest = await requestRepository.GetByIdAsync(request.RequestId, cancellationToken)
            ?? throw new InvalidOperationException("Request not found");

        // requests.doctor_id deve ser o user id do médico; em dados legados/race pode divergir do encounter.
        // Fonte de verdade para quem realizou a teleconsulta: encounters.practitioner_id (user id).
        if (!await CanDoctorEmitPostConsultationAsync(medicalRequest, doctorUserId, request.RequestId, cancellationToken))
            throw new UnauthorizedAccessException(
                "Apenas o médico que realizou esta consulta pode emitir e assinar os documentos. " +
                "Verifique se está logado na conta correta ou se o pedido foi atribuído a outro profissional.");

        if (medicalRequest.RequestType != RequestType.Consultation)
            throw new InvalidOperationException("Post-consultation documents can only be emitted for consultations");

        // ── 1b. Validar certificado digital ativo ──
        var doctorProfile = await doctorRepository.GetByUserIdAsync(doctorUserId, cancellationToken);
        if (doctorProfile == null)
            throw new InvalidOperationException("Perfil de médico não encontrado.");
        if (doctorProfile.ActiveCertificateId == null)
            throw new InvalidOperationException("Nenhum certificado digital ativo. Faça upload do certificado A1 na tela de Certificado.");

        // ── 1c. Validar senha do certificado ANTES de criar documentos ──
        if (string.IsNullOrWhiteSpace(request.CertificatePassword))
            throw new InvalidOperationException("Senha do certificado digital é obrigatória para assinar documentos.");

        var passwordOk = await digitalCertificateService.ValidateCertificatePasswordAsync(
            doctorProfile.ActiveCertificateId.Value, request.CertificatePassword, cancellationToken);
        if (!passwordOk)
            throw new InvalidOperationException("Senha do certificado digital incorreta. Verifique e tente novamente.");

        // ── 2. Obter paciente (patients.id) e obter ou criar Encounter ──
        // requests.patient_id é user id; encounters.patient_id deve ser patients(id) — evita FK 23503
        var patient = await clinicalRecordService.EnsurePatientFromUserAsync(
            medicalRequest.PatientId, cancellationToken);

        var encounter = await encounterRepository.GetBySourceRequestIdAsync(request.RequestId, cancellationToken);

        if (encounter == null)
        {
            encounter = await clinicalRecordService.StartEncounterAsync(
                patient.Id, doctorUserId, EncounterType.Teleconsultation,
                channel: "web", reason: "Consulta por vídeo", sourceRequestId: request.RequestId, cancellationToken: cancellationToken);
        }
        else if (encounter.PatientId != patient.Id)
        {
            // Encounter antigo pode ter patient_id = user id (bug histórico). Corrigir antes do UPDATE.
            await encounterRepository.UpdatePatientIdAsync(encounter.Id, patient.Id, cancellationToken);
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

        // ── 3a. Verificar se já foram emitidos documentos para este encounter ──
        var existingDocs = await medicalDocumentRepository.GetByEncounterIdAsync(encounter.Id, cancellationToken);
        if (existingDocs.Count > 0)
        {
            // Documentos já emitidos — garantir consulta finalizada e retornar os existentes sem duplicar
            if (medicalRequest.Status != RequestStatus.ConsultationFinished)
            {
                medicalRequest.MarkConsultationFinished();
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
            }
            logger.LogInformation(
                "Post-consultation emit already done for encounter {EncounterId}: {Count} documents exist. Returning existing.",
                encounter.Id, existingDocs.Count);

            return new PostConsultationEmitResponse
            {
                EncounterId = encounter.Id,
                PrescriptionId = existingDocs.FirstOrDefault(d => d.DocumentType == DocumentType.Prescription)?.Id,
                ExamOrderId = existingDocs.FirstOrDefault(d => d.DocumentType == DocumentType.ExamOrder)?.Id,
                MedicalCertificateId = existingDocs.FirstOrDefault(d => d.DocumentType == DocumentType.MedicalCertificate)?.Id,
                ReferralId = existingDocs.FirstOrDefault(d => d.DocumentType == DocumentType.MedicalReport)?.Id,
                DocumentsEmitted = existingDocs.Count,
                DocumentTypes = existingDocs.Select(d => d.DocumentType.ToString()).Distinct().ToList(),
                Message = $"{existingDocs.Count} documento(s) já emitido(s) anteriormente.",
                Warnings = new List<string>(),
            };
        }

        // ── 3b. Validar máximo de 4 documentos ──
        var docCount = 0;
        if (request.Prescription is { Items.Count: > 0 }) docCount++;
        if (request.ExamOrder is { Items.Count: > 0 }) docCount++;
        if (request.MedicalCertificate is { Body.Length: > 0 }) docCount++;
        if (request.Referral is { Reason.Length: > 0 }) docCount++;
        if (docCount > 4)
            throw new InvalidOperationException("Máximo de 4 documentos por pós-consulta: receita, exames, atestado e encaminhamento.");

        // ── 3c. Verificações de duplicidade (medicamentos e atestados) ──
        var warnings = new List<string>();
        var errors = new List<string>();
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
        Guid? referralId = null;

        // Receita
        if (request.Prescription is { Items.Count: > 0 })
        {
            try
            {
                var items = request.Prescription.Items.Select(i =>
                    (i.Drug, i.Concentration, i.Form, i.Posology, i.Duration, i.Quantity, i.Notes));

                var prescription = await clinicalRecordService.CreatePrescriptionAsync(
                    encounter.Id, items, request.Prescription.GeneralInstructions, cancellationToken);
                prescriptionId = prescription.Id;
                emittedTypes.Add("Receita");

                var accessCode = await SetDocumentSecurityAsync(prescription.Id, DocumentType.Prescription,
                    request.Prescription.Type, cancellationToken);
                var signed = await GenerateSignAndPersistPrescriptionPdfAsync(
                    prescription, patient, doctorProfile, request.Prescription, request.CertificatePassword,
                    accessCode, cancellationToken);
                if (!signed)
                    errors.Add("Receita: documento criado, mas PDF/assinatura não concluída. Verifique senha do certificado.");

                logger.LogInformation("Prescription {PrescriptionId} created for encounter {EncounterId}",
                    prescription.Id, encounter.Id);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to emit Receita for encounter {EncounterId}", encounter.Id);
                errors.Add($"Receita: {GetUserFriendlyError(ex)}");
            }
        }

        // Pedido de exames
        if (request.ExamOrder is { Items.Count: > 0 })
        {
            try
            {
                var items = request.ExamOrder.Items.Select(i => (i.Type, i.Code, i.Description));

                var examOrder = await clinicalRecordService.CreateExamOrderAsync(
                    encounter.Id, items, request.ExamOrder.ClinicalJustification,
                    request.ExamOrder.Priority, cancellationToken);
                examOrderId = examOrder.Id;
                emittedTypes.Add("Exames");

                var examAccessCode = await SetDocumentSecurityAsync(examOrder.Id, DocumentType.ExamOrder, null, cancellationToken);
                var signed = await GenerateSignAndPersistExamPdfAsync(
                    examOrder, patient, doctorProfile, request.ExamOrder, request.CertificatePassword,
                    examAccessCode, cancellationToken);
                if (!signed)
                    errors.Add("Exames: documento criado, mas PDF/assinatura não concluída. Verifique senha do certificado.");

                logger.LogInformation("ExamOrder {ExamOrderId} created for encounter {EncounterId}",
                    examOrder.Id, encounter.Id);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to emit Exames for encounter {EncounterId}", encounter.Id);
                errors.Add($"Exames: {GetUserFriendlyError(ex)}");
            }
        }

        // Atestado médico
        if (request.MedicalCertificate is { Body.Length: > 0 })
        {
            try
            {
                var cert = request.MedicalCertificate;
                var icdForDoc = cert.IncludeIcd10 ? cert.Icd10Code : null;

                var report = await clinicalRecordService.CreateMedicalReportAsync(
                    encounter.Id, cert.Body, icdForDoc, cert.LeaveDays, cancellationToken);
                certificateId = report.Id;
                emittedTypes.Add("Atestado");

                var certAccessCode = await SetDocumentSecurityAsync(report.Id, DocumentType.MedicalCertificate, null, cancellationToken);
                var signed = await GenerateSignAndPersistCertificatePdfAsync(
                    report, patient, doctorProfile, request.MedicalCertificate, request.CertificatePassword,
                    certAccessCode, cancellationToken);
                if (!signed)
                    errors.Add("Atestado: documento criado, mas PDF/assinatura não concluída. Verifique senha do certificado.");

                logger.LogInformation("MedicalCertificate {CertificateId} created for encounter {EncounterId}",
                    report.Id, encounter.Id);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to emit Atestado for encounter {EncounterId}", encounter.Id);
                errors.Add($"Atestado: {GetUserFriendlyError(ex)}");
            }
        }

        // Encaminhamento (MedicalReport com leaveDays=null)
        if (request.Referral is { Reason.Length: > 0 })
        {
            try
            {
                var refDto = request.Referral;
                var body = $"Encaminho o(a) paciente para avaliação presencial pelo(a) Dr(a). {refDto.ProfessionalName.Trim()}" +
                    (string.IsNullOrWhiteSpace(refDto.Specialty) ? "" : $" ({refDto.Specialty.Trim()})") +
                    $".\n\nMotivo/Indicação: {refDto.Reason.Trim()}";
                var icdForRef = string.IsNullOrWhiteSpace(refDto.Icd10Code) ? null : refDto.Icd10Code.Trim();

                var referralReport = await clinicalRecordService.CreateMedicalReportAsync(
                    encounter.Id, body, icdForRef, leaveDays: null, cancellationToken);
                referralId = referralReport.Id;
                emittedTypes.Add("Encaminhamento");

                var refAccessCode = await SetDocumentSecurityAsync(referralReport.Id, DocumentType.MedicalReport, null, cancellationToken);
                var signed = await GenerateSignAndPersistCertificatePdfAsync(
                    referralReport, patient, doctorProfile, body, icdForRef, leaveDays: null,
                    request.CertificatePassword, refAccessCode, "encaminhamento", cancellationToken);
                if (!signed)
                    errors.Add("Encaminhamento: documento criado, mas PDF/assinatura não concluída. Verifique senha do certificado.");

                logger.LogInformation("Referral {ReferralId} created for encounter {EncounterId}",
                    referralReport.Id, encounter.Id);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to emit Encaminhamento for encounter {EncounterId}", encounter.Id);
                errors.Add($"Encaminhamento: {GetUserFriendlyError(ex)}");
            }
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
                ["referral_id"] = referralId,
                ["main_icd10"] = request.MainIcd10Code
            },
            cancellationToken: cancellationToken);

        logger.LogInformation(
            "Post-consultation emit completed: {Count} documents for encounter {EncounterId} by doctor {DoctorId}",
            emittedTypes.Count, encounter.Id, doctorUserId);

        // ── 5b. Marcar consulta como finalizada e notificar paciente ──
        if (emittedTypes.Count > 0)
        {
            if (medicalRequest.Status != RequestStatus.ConsultationFinished)
            {
                medicalRequest.MarkConsultationFinished();
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
            }
            await pushDispatcher.SendAsync(
                PushNotificationRules.PostConsultationDocumentsReady(medicalRequest.PatientId, medicalRequest.Id),
                cancellationToken);

            // Notificar via SignalR (ConsultationEnded) para o frontend atualizar em tempo real
            await requestEventsPublisher.NotifyRequestUpdatedAsync(
                medicalRequest.Id,
                medicalRequest.PatientId,
                medicalRequest.DoctorId,
                Helpers.EnumHelper.ToSnakeCase(medicalRequest.Status),
                "Consulta finalizada — documentos emitidos",
                cancellationToken);
        }

        // ── 6. Retornar resposta ──
        var msg = emittedTypes.Count > 0
            ? $"{emittedTypes.Count} documento(s) criado(s) com sucesso: {string.Join(", ", emittedTypes)}."
                + (warnings.Count > 0 ? $" ⚠️ {warnings.Count} aviso(s) de duplicidade." : "")
                + (errors.Count > 0 ? $" ⚠️ {errors.Count} problema(s) em outros documentos." : "")
            : errors.Count > 0
                ? $"Nenhum documento pôde ser emitido. Erros: {string.Join("; ", errors)}"
                : "Nenhum documento solicitado.";

        return new PostConsultationEmitResponse
        {
            EncounterId = encounter.Id,
            PrescriptionId = prescriptionId,
            ExamOrderId = examOrderId,
            MedicalCertificateId = certificateId,
            ReferralId = referralId,
            DocumentsEmitted = emittedTypes.Count,
            DocumentTypes = emittedTypes,
            Message = msg,
            Warnings = warnings,
            Errors = errors,
        };
    }

    private static string GetUserFriendlyError(Exception ex)
    {
        var msg = ex.Message;
        if (msg.Contains("parsing column", StringComparison.OrdinalIgnoreCase))
            return "Erro interno de dados. Contate o suporte.";
        if (msg.Contains("23503") || msg.Contains("foreign key", StringComparison.OrdinalIgnoreCase))
            return "Dados inconsistentes. Tente novamente ou contate o suporte.";
        if (msg.Contains("certificate", StringComparison.OrdinalIgnoreCase) || msg.Contains("senha", StringComparison.OrdinalIgnoreCase))
            return "Verifique a senha do certificado digital.";
        if (msg.Length > 80) return msg[..77] + "...";
        return msg;
    }

    /// <summary>
    /// Define expires_at, max_dispenses e access_code em um documento recém-criado.
    /// Retorna o código de verificação para uso no PDF.
    /// </summary>
    private async Task<string?> SetDocumentSecurityAsync(
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

            return code;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to set security metadata for document {DocId}", documentId);
            return null;
        }
    }

    private string GetVerificationUrl(Guid documentId)
    {
        var frontendBase = (verificationConfig?.Value?.FrontendUrl ?? "").TrimEnd('/');
        if (string.IsNullOrWhiteSpace(frontendBase))
            frontendBase = "https://www.renovejasaude.com.br/verify";
        return $"{frontendBase}/{documentId}";
    }

    private static DateTime GetBrasiliaNow() => BrazilDateTime.Now;

    private static string FormatPatientAddress(Patient patient)
    {
        var parts = new[] { patient.AddressLine1, patient.City, patient.State, patient.ZipCode }
            .Where(p => !string.IsNullOrWhiteSpace(p));
        return string.Join(", ", parts);
    }

    private async Task<(string DoctorName, string DoctorCrm, string DoctorCrmState, string DoctorSpecialty)> GetDoctorPdfInfoAsync(DoctorProfile profile, CancellationToken ct)
    {
        var user = await userRepository.GetByIdAsync(profile.UserId, ct);
        var name = user?.Name?.Trim() ?? "Médico(a)";
        return (name, profile.Crm, profile.CrmState, profile.Specialty);
    }

    private async Task<bool> GenerateSignAndPersistPrescriptionPdfAsync(
        Prescription prescription,
        Patient patient,
        DoctorProfile doctorProfile,
        PrescriptionEmitDto dto,
        string? pfxPassword,
        string? accessCode,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(pfxPassword))
        {
            logger.LogWarning("CertificatePassword não informada — PDF de receita {DocId} não será assinado.", prescription.Id);
            return false;
        }
        if (string.IsNullOrWhiteSpace(accessCode))
        {
            logger.LogWarning("AccessCode não disponível para doc {DocId} — PDF não gerado (evita código incorreto na verificação).", prescription.Id);
            return false;
        }
        var (doctorName, crm, crmState, specialty) = await GetDoctorPdfInfoAsync(doctorProfile, ct);
        var meds = dto.Items.Select(i => $"{i.Drug}" + (string.IsNullOrEmpty(i.Posology) ? "" : $" — {i.Posology}")).ToList();
        var kind = (dto.Type ?? "simples").ToLowerInvariant() switch
        {
            "controlado" or "controlled_special" => PrescriptionKind.ControlledSpecial,
            "antimicrobiano" or "antimicrobial" => PrescriptionKind.Antimicrobial,
            _ => PrescriptionKind.Simple
        };
        var address = FormatPatientAddress(patient);
        var data = new PrescriptionPdfData(
            prescription.Id, patient.Name, patient.Cpf, doctorName, crm, crmState, specialty,
            meds, dto.Type ?? "simples", GetBrasiliaNow(),
            AccessCode: accessCode, VerificationUrl: GetVerificationUrl(prescription.Id), PrescriptionKind: kind,
            AdditionalNotes: dto.GeneralInstructions,
            PatientBirthDate: patient.BirthDate,
            PatientPhone: patient.Phone,
            PatientGender: patient.Sex,
            PatientAddress: string.IsNullOrWhiteSpace(address) ? null : address);
        var result = await prescriptionPdfService.GenerateAsync(data, ct);
        if (!result.Success || result.PdfBytes == null)
        {
            logger.LogError("Falha ao gerar PDF da receita {DocId}: {Error}", prescription.Id, result.ErrorMessage);
            return false;
        }
        var storagePath = Helpers.StoragePaths.DocumentoReceita(patient.Id, prescription.Id);
        var signResult = await digitalCertificateService.SignPdfAsync(
            doctorProfile.ActiveCertificateId!.Value, result.PdfBytes, storagePath, pfxPassword,
            documentTypeHint: "prescription", ct);
        if (!signResult.Success || string.IsNullOrEmpty(signResult.SignedDocumentUrl))
        {
            logger.LogError("Falha ao assinar PDF da receita {DocId}: {Error}", prescription.Id, signResult.ErrorMessage);
            return false;
        }
        await medicalDocumentRepository.SetSignedDocumentAsync(
            prescription.Id, signResult.SignedDocumentUrl, signResult.SignatureId,
            signResult.SignedPdfHash ?? "", "SHA-256", signResult.SignatureId ?? "",
            signResult.SignedAt ?? DateTime.UtcNow, true, null, null, ct);
        return true;
    }

    private async Task<bool> GenerateSignAndPersistExamPdfAsync(
        ExamOrder examOrder,
        Patient patient,
        DoctorProfile doctorProfile,
        ExamOrderEmitDto dto,
        string? pfxPassword,
        string? accessCode,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(pfxPassword))
        {
            logger.LogWarning("CertificatePassword não informada — PDF de exame {DocId} não será assinado.", examOrder.Id);
            return false;
        }
        if (string.IsNullOrWhiteSpace(accessCode))
        {
            logger.LogWarning("AccessCode não disponível para doc {DocId} — PDF não gerado.", examOrder.Id);
            return false;
        }
        var (doctorName, crm, crmState, specialty) = await GetDoctorPdfInfoAsync(doctorProfile, ct);
        var exams = examOrder.Items.Select(i => i.Description).ToList();
        var examAddress = FormatPatientAddress(patient);
        var data = new ExamPdfData(
            examOrder.Id, patient.Name, patient.Cpf, doctorName, crm, crmState, specialty,
            exams, dto.ClinicalJustification, GetBrasiliaNow(),
            AccessCode: accessCode, VerificationUrl: GetVerificationUrl(examOrder.Id),
            PatientBirthDate: patient.BirthDate,
            PatientPhone: patient.Phone,
            PatientAddress: string.IsNullOrWhiteSpace(examAddress) ? null : examAddress);
        var result = await prescriptionPdfService.GenerateExamRequestAsync(data, ct);
        if (!result.Success || result.PdfBytes == null)
        {
            logger.LogError("Falha ao gerar PDF do exame {DocId}: {Error}", examOrder.Id, result.ErrorMessage);
            return false;
        }
        var storagePath = Helpers.StoragePaths.DocumentoExame(patient.Id, examOrder.Id);
        var signResult = await digitalCertificateService.SignPdfAsync(
            doctorProfile.ActiveCertificateId!.Value, result.PdfBytes, storagePath, pfxPassword,
            documentTypeHint: "exam", ct);
        if (!signResult.Success || string.IsNullOrEmpty(signResult.SignedDocumentUrl))
        {
            logger.LogError("Falha ao assinar PDF do exame {DocId}: {Error}", examOrder.Id, signResult.ErrorMessage);
            return false;
        }
        await medicalDocumentRepository.SetSignedDocumentAsync(
            examOrder.Id, signResult.SignedDocumentUrl, signResult.SignatureId,
            signResult.SignedPdfHash ?? "", "SHA-256", signResult.SignatureId ?? "",
            signResult.SignedAt ?? DateTime.UtcNow, true, null, null, ct);
        return true;
    }

    private async Task<bool> GenerateSignAndPersistCertificatePdfAsync(
        MedicalReport report,
        Patient patient,
        DoctorProfile doctorProfile,
        MedicalCertificateEmitDto dto,
        string? pfxPassword,
        string? accessCode,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(pfxPassword))
        {
            logger.LogWarning("CertificatePassword não informada — PDF do atestado {DocId} não será assinado.", report.Id);
            return false;
        }
        if (string.IsNullOrWhiteSpace(accessCode))
        {
            logger.LogWarning("AccessCode não disponível para doc {DocId} — PDF não gerado.", report.Id);
            return false;
        }
        var (doctorName, crm, crmState, specialty) = await GetDoctorPdfInfoAsync(doctorProfile, ct);
        var certType = (dto.CertificateType ?? "afastamento").ToLowerInvariant() switch
        {
            "comparecimento" => "comparecimento",
            "aptidao" => "aptidao",
            _ => "afastamento"
        };
        var data = new MedicalCertificatePdfData(
            report.Id, patient.Name, patient.Cpf, patient.BirthDate, patient.Sex,
            doctorName, crm, crmState, specialty, certType, dto.Body, dto.Icd10Code,
            dto.LeaveDays, dto.LeaveStartDate, dto.LeavePeriod, GetBrasiliaNow(),
            AccessCode: accessCode, VerificationUrl: GetVerificationUrl(report.Id));
        var result = await prescriptionPdfService.GenerateMedicalCertificateAsync(data, ct);
        if (!result.Success || result.PdfBytes == null)
        {
            logger.LogError("Falha ao gerar PDF do atestado {DocId}: {Error}", report.Id, result.ErrorMessage);
            return false;
        }
        var storagePath = Helpers.StoragePaths.DocumentoAtestado(patient.Id, report.Id);
        var signResult = await digitalCertificateService.SignPdfAsync(
            doctorProfile.ActiveCertificateId!.Value, result.PdfBytes, storagePath, pfxPassword,
            documentTypeHint: "atestado", ct);
        if (!signResult.Success || string.IsNullOrEmpty(signResult.SignedDocumentUrl))
        {
            logger.LogError("Falha ao assinar PDF do atestado {DocId}: {Error}", report.Id, signResult.ErrorMessage);
            return false;
        }
        await medicalDocumentRepository.SetSignedDocumentAsync(
            report.Id, signResult.SignedDocumentUrl, signResult.SignatureId,
            signResult.SignedPdfHash ?? "", "SHA-256", signResult.SignatureId ?? "",
            signResult.SignedAt ?? DateTime.UtcNow, true, null, null, ct);
        return true;
    }

    private async Task<bool> GenerateSignAndPersistCertificatePdfAsync(
        MedicalReport report,
        Patient patient,
        DoctorProfile doctorProfile,
        string body,
        string? icd10Code,
        int? leaveDays,
        string? pfxPassword,
        string? accessCode,
        string certificateType,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(pfxPassword))
        {
            logger.LogWarning("CertificatePassword não informada — PDF do encaminhamento {DocId} não será assinado.", report.Id);
            return false;
        }
        if (string.IsNullOrWhiteSpace(accessCode))
        {
            logger.LogWarning("AccessCode não disponível para doc {DocId} — PDF não gerado.", report.Id);
            return false;
        }
        var (doctorName, crm, crmState, specialty) = await GetDoctorPdfInfoAsync(doctorProfile, ct);
        var data = new MedicalCertificatePdfData(
            report.Id, patient.Name, patient.Cpf, patient.BirthDate, patient.Sex,
            doctorName, crm, crmState, specialty, certificateType, body, icd10Code,
            leaveDays, null, null, GetBrasiliaNow(),
            AccessCode: accessCode, VerificationUrl: GetVerificationUrl(report.Id));
        var result = await prescriptionPdfService.GenerateMedicalCertificateAsync(data, ct);
        if (!result.Success || result.PdfBytes == null)
        {
            logger.LogError("Falha ao gerar PDF do encaminhamento {DocId}: {Error}", report.Id, result.ErrorMessage);
            return false;
        }
        var storagePath = Helpers.StoragePaths.DocumentoEncaminhamento(patient.Id, report.Id);
        var signResult = await digitalCertificateService.SignPdfAsync(
            doctorProfile.ActiveCertificateId!.Value, result.PdfBytes, storagePath, pfxPassword,
            documentTypeHint: "encaminhamento", ct);
        if (!signResult.Success || string.IsNullOrEmpty(signResult.SignedDocumentUrl))
        {
            logger.LogError("Falha ao assinar PDF do encaminhamento {DocId}: {Error}", report.Id, signResult.ErrorMessage);
            return false;
        }
        await medicalDocumentRepository.SetSignedDocumentAsync(
            report.Id, signResult.SignedDocumentUrl, signResult.SignatureId,
            signResult.SignedPdfHash ?? "", "SHA-256", signResult.SignatureId ?? "",
            signResult.SignedAt ?? DateTime.UtcNow, true, null, null, ct);
        return true;
    }

    /// <summary>
    /// Autoriza emissão se requests.doctor_id == médico, se o encounter aponta o practitioner,
    /// ou se o médico editou a conduta neste pedido (ConductUpdatedBy — alinha com divergências legadas doctor_id/encounter).
    /// </summary>
    private async Task<bool> CanDoctorEmitPostConsultationAsync(
        MedicalRequest medicalRequest,
        Guid doctorUserId,
        Guid requestId,
        CancellationToken cancellationToken)
    {
        if (medicalRequest.DoctorId == doctorUserId)
            return true;

        if (medicalRequest.ConductUpdatedBy == doctorUserId)
            return true;

        var encounter = await encounterRepository.GetBySourceRequestIdAsync(requestId, cancellationToken);
        return encounter != null && encounter.PractitionerId == doctorUserId;
    }
}
