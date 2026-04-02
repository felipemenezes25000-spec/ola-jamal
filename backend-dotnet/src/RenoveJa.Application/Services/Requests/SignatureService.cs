using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Exceptions;
using RenoveJa.Application.Helpers;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Application.Validators;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Requests;

/// <summary>
/// Assinatura digital, geração de PDF, validação de conformidade e entrega de documentos.
/// </summary>
public class SignatureService(
    IRequestRepository requestRepository,
    IDoctorRepository doctorRepository,
    IUserRepository userRepository,
    IDigitalCertificateService digitalCertificateService,
    IAiPrescriptionGeneratorService aiPrescriptionGenerator,
    IPrescriptionPdfService prescriptionPdfService,
    IPrescriptionVerifyRepository prescriptionVerifyRepository,
    IDocumentTokenService documentTokenService,
    IStorageService storageService,
    IRequestEventsPublisher requestEventsPublisher,
    IPushNotificationDispatcher pushDispatcher,
    ISignedRequestClinicalSyncService signedRequestClinicalSync,
    INotificationRepository notificationRepository,
    IPushNotificationSender pushNotificationSender,
    IHttpClientFactory httpClientFactory,
    IOptions<ApiConfig> apiConfig,
    ILogger<SignatureService> logger) : ISignatureService
{
    private readonly string _apiBaseUrl = (apiConfig?.Value?.BaseUrl ?? "").Trim();

    private Task PublishRequestUpdatedAsync(MedicalRequest request, string? message = null, CancellationToken cancellationToken = default)
        => requestEventsPublisher.NotifyRequestUpdatedAsync(
            request.Id, request.PatientId, request.DoctorId,
            EnumHelper.ToSnakeCase(request.Status), message, cancellationToken);

    private async Task CreateNotificationAsync(
        Guid userId,
        string title,
        string message,
        CancellationToken cancellationToken,
        Dictionary<string, object?>? data = null,
        string targetRole = "patient")
    {
        var mergedData = data != null ? new Dictionary<string, object?>(data) : new Dictionary<string, object?>();
        mergedData["targetRole"] = targetRole;
        var notification = Notification.Create(userId, title, message, NotificationType.Info, mergedData);
        await notificationRepository.CreateAsync(notification, cancellationToken);
        await pushNotificationSender.SendAsync(userId, title, message, mergedData, cancellationToken);
    }

    public async Task<RequestResponseDto> SignAsync(
        Guid id,
        SignRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        // Só permite assinar se o pedido foi aprovado (status Paid = aprovado no fluxo gratuito)
        if (request.Status != RequestStatus.Paid)
        {
            throw new InvalidOperationException(
                "Apenas solicitações aprovadas podem ser assinadas. O pedido deve ser aprovado pelo médico antes da assinatura.");
        }

        // Se o médico está atribuído, tentar fluxo completo de geração + assinatura
        if (request.DoctorId.HasValue)
        {
            var doctorProfile = await doctorRepository.GetByUserIdAsync(request.DoctorId.Value, cancellationToken);

            if (doctorProfile == null)
                throw new InvalidOperationException("Perfil de médico não encontrado. Complete o cadastro como médico.");

            // 1. Verificar se médico tem certificado válido
            var hasCertificate = await digitalCertificateService.HasValidCertificateAsync(doctorProfile.Id, cancellationToken);
            if (!hasCertificate)
                throw new InvalidOperationException("Certificado digital não encontrado ou inválido. Cadastre um certificado em Configurações.");

            {
                // Senha do PFX obrigatória no fluxo automático de assinatura
                    if (string.IsNullOrWhiteSpace(dto.PfxPassword))
                    {
                        throw new InvalidOperationException(
                            "Senha do certificado digital é obrigatória para assinar. Envie o campo 'pfxPassword' no corpo da requisição.");
                    }

                    var doctorUser = await userRepository.GetByIdAsync(request.DoctorId.Value, cancellationToken);
                    var patientUser = await userRepository.GetByIdAsync(request.PatientId, cancellationToken);
                    var normalizedPfxPassword = dto.PfxPassword?.Trim();

                    byte[]? pdfBytes = null;
                    string? pdfFileName = null;

                    if (request.RequestType == Domain.Enums.RequestType.Prescription)
                    {
                        var medications = request.Medications?.Where(m => !string.IsNullOrWhiteSpace(m)).ToList() ?? new List<string>();
                        if (medications.Count == 0 && !string.IsNullOrWhiteSpace(request.AiExtractedJson))
                            medications = RequestHelpers.ParseMedicationsFromAiJson(request.AiExtractedJson, logger);
                        if (medications.Count == 0)
                        {
                            throw new InvalidOperationException(
                                "A receita deve ter ao menos um medicamento informado para gerar o PDF. Copie a análise da IA e adicione os medicamentos ao aprovar, ou use o botão Reanalisar com IA.");
                        }

                        var kind = request.PrescriptionKind ?? PrescriptionKind.Simple;
                        var validationResult = PrescriptionComplianceValidator.Validate(
                            kind,
                            request.PatientName,
                            patientUser?.Cpf,
                            patientUser?.Address,
                            patientUser?.Gender,
                            patientUser?.BirthDate,
                            medications,
                            doctorUser?.Name ?? request.DoctorName,
                            doctorProfile.Crm,
                            doctorProfile.CrmState,
                            doctorProfile.ProfessionalAddress,
                            doctorProfile.ProfessionalPhone);
                        if (!validationResult.IsValid)
                            throw new PrescriptionValidationException(validationResult.MissingFields, validationResult.Messages);

                        List<PrescriptionMedicationItem>? aiMedItems = null;
                        if (medications.Count == 0 || medications.All(m => m.Trim().Length < 5))
                        {
                            var aiInput = new AiPrescriptionGeneratorInput(
                                PatientName: request.PatientName ?? "Paciente",
                                PatientBirthDate: patientUser?.BirthDate,
                                PatientGender: patientUser?.Gender,
                                Symptoms: request.Symptoms,
                                AiSummaryForDoctor: request.AiSummaryForDoctor,
                                AiExtractedJson: request.AiExtractedJson,
                                DoctorNotes: request.Notes,
                                Kind: kind);
                            aiMedItems = await aiPrescriptionGenerator.GenerateMedicationsAsync(aiInput, cancellationToken);
                        }

                        var pdfData = new PrescriptionPdfData(
                            RequestId: request.Id,
                            PatientName: request.PatientName ?? "Paciente",
                            PatientCpf: patientUser?.Cpf,
                            DoctorName: doctorUser?.Name ?? request.DoctorName ?? "Médico",
                            DoctorCrm: doctorProfile.Crm,
                            DoctorCrmState: doctorProfile.CrmState,
                            DoctorSpecialty: doctorProfile.Specialty,
                            Medications: medications,
                            PrescriptionType: RequestHelpers.PrescriptionTypeToDisplay(request.PrescriptionType) ?? "simples",
                            EmissionDate: RequestHelpers.GetBrazilNow(),
                            AccessCode: request.AccessCode,
                            PrescriptionKind: kind,
                            PatientGender: patientUser?.Gender,
                            PatientPhone: patientUser?.Phone?.Value,
                            PatientAddress: RequestHelpers.FormatPatientAddress(patientUser),
                            PatientBirthDate: patientUser?.BirthDate,
                            MedicationItems: aiMedItems,
                            DoctorAddress: doctorProfile.ProfessionalAddress,
                            DoctorPhone: doctorProfile.ProfessionalPhone,
                            AutoObservation: request.AutoObservation,
                            DoctorConductNotes: request.DoctorConductNotes,
                            IncludeConductInPdf: request.IncludeConductInPdf);

                        var pdfResult = await prescriptionPdfService.GenerateAsync(pdfData, cancellationToken);
                        if (pdfResult.Success && pdfResult.PdfBytes != null)
                        {
                            pdfBytes = pdfResult.PdfBytes;
                            pdfFileName = Helpers.StoragePaths.ReceitaAssinada(request.PatientId, request.Id);
                        }
                        else
                            throw new InvalidOperationException("Falha ao gerar PDF da receita. " + (pdfResult.ErrorMessage ?? "Verifique os dados da receita e tente novamente."));
                    }
                    else if (request.RequestType == Domain.Enums.RequestType.Exam)
                    {
                        if (string.IsNullOrWhiteSpace(patientUser?.Cpf))
                            throw new InvalidOperationException(
                                "CPF do paciente é obrigatório em todas as solicitações de exame. O paciente deve completar o cadastro com CPF antes da assinatura.");

                        var exams = request.Exams?.Where(e => !string.IsNullOrWhiteSpace(e)).ToList() ?? new List<string>();
                        if (exams.Count == 0)
                            exams = new List<string> { "Exames conforme solicitação médica" };

                        var examPdfData = new ExamPdfData(
                            RequestId: request.Id,
                            PatientName: request.PatientName ?? "Paciente",
                            PatientCpf: patientUser?.Cpf,
                            DoctorName: doctorUser?.Name ?? request.DoctorName ?? "Médico",
                            DoctorCrm: doctorProfile.Crm,
                            DoctorCrmState: doctorProfile.CrmState,
                            DoctorSpecialty: doctorProfile.Specialty,
                            Exams: exams,
                            Notes: request.Notes,
                            EmissionDate: RequestHelpers.GetBrazilNow(),
                            AccessCode: request.AccessCode,
                            PatientBirthDate: patientUser?.BirthDate,
                            PatientPhone: patientUser?.Phone?.Value,
                            PatientAddress: RequestHelpers.FormatPatientAddress(patientUser),
                            DoctorAddress: doctorProfile.ProfessionalAddress,
                            DoctorPhone: doctorProfile.ProfessionalPhone,
                            ClinicalIndication: request.Symptoms,
                            AutoObservation: request.AutoObservation,
                            DoctorConductNotes: request.DoctorConductNotes,
                            IncludeConductInPdf: request.IncludeConductInPdf);

                        var pdfResult = await prescriptionPdfService.GenerateExamRequestAsync(examPdfData, cancellationToken);
                        if (pdfResult.Success && pdfResult.PdfBytes != null)
                        {
                            pdfBytes = pdfResult.PdfBytes;
                            pdfFileName = Helpers.StoragePaths.ExameAssinado(request.PatientId, request.Id);
                        }
                        else
                            throw new InvalidOperationException("Falha ao gerar PDF do exame. " + (pdfResult.ErrorMessage ?? "Verifique os dados do pedido e tente novamente."));
                    }

                    if (pdfBytes == null || string.IsNullOrEmpty(pdfFileName))
                        throw new InvalidOperationException(request.RequestType == Domain.Enums.RequestType.Prescription
                            ? "Não foi possível gerar o PDF da receita. Verifique se há ao menos um medicamento informado."
                            : "Não foi possível gerar o PDF do exame. Verifique se há ao menos um exame informado.");

                    var certInfo = await digitalCertificateService.GetActiveCertificateAsync(doctorProfile.Id, cancellationToken);
                    if (certInfo == null)
                        throw new InvalidOperationException("Certificado ativo não encontrado. Cadastre ou reative um certificado em Configurações.");

                    var documentTypeHint = request.RequestType == Domain.Enums.RequestType.Exam ? "exam" : "prescription";
                    var signResult = await digitalCertificateService.SignPdfAsync(
                                certInfo.Id,
                                pdfBytes,
                                pdfFileName, // storage path completo, ex.: pedidos/{id}/receita/assinado/receita-{id}.pdf
                                normalizedPfxPassword,
                                documentTypeHint,
                                cancellationToken);

                            if (signResult.Success)
                            {
                                request.Sign(signResult.SignedDocumentUrl!, signResult.SignatureId!);
                                request = await requestRepository.UpdateAsync(request, cancellationToken);

                                // Registra na tabela 'prescriptions' para o fluxo Verify v2 (QR Code)
                                if (request.RequestType == Domain.Enums.RequestType.Prescription ||
                                    request.RequestType == Domain.Enums.RequestType.Exam)
                                {
                                    try
                                    {
                                        var accessCode = request.AccessCode ?? RequestHelpers.GenerateAccessCode(request.Id);
                                        var pdfPath = pdfFileName; // já é path completo
                                        var emissionDate = DateTime.UtcNow;
                                        var verifyRecord = new PrescriptionVerifyRecord(
                                            Id: request.Id,
                                            VerifyCodeHash: RequestHelpers.ComputeSha256(accessCode),
                                            PdfStoragePath: pdfPath,
                                            PatientInitials: RequestHelpers.GetInitials(request.PatientName),
                                            PrescriberCrmUf: doctorProfile.CrmState,
                                            PrescriberCrmLast4: RequestHelpers.GetLast4(doctorProfile.Crm),
                                            IssuedAt: emissionDate,
                                            IssuedDateStr: emissionDate.ToString("dd/MM/yyyy"),
                                            PdfHash: signResult.SignedPdfHash);
                                        await prescriptionVerifyRepository.UpsertAsync(verifyRecord, cancellationToken);
                                    }
                                    catch (Exception ex)
                                    {
                                        logger.LogError(ex, "Falha ao registrar documento {RequestId} no verify (não bloqueia a resposta)", request.Id);
                                    }
                                }

                                await pushDispatcher.SendAsync(PushNotificationRules.Signed(request.PatientId, request.Id, request.RequestType), cancellationToken);
                                await PublishRequestUpdatedAsync(request, "Documento assinado", cancellationToken);

                                await signedRequestClinicalSync.SyncSignedRequestAsync(
                                    request,
                                    signResult.SignedDocumentUrl!,
                                    signResult.SignatureId!,
                                    signResult.SignedAt ?? DateTime.UtcNow,
                                    certInfo.Id,
                                    certInfo.SubjectName,
                                    cancellationToken);

                                return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
                            }

                    // Propaga a mensagem amigável vinda do serviço de certificado sem duplicar prefixos.
                    var signErrorMessage = signResult.ErrorMessage;
                    if (string.IsNullOrWhiteSpace(signErrorMessage))
                    {
                        signErrorMessage = "Não foi possível assinar o PDF. Verifique a senha do certificado digital e tente novamente.";
                    }

                    throw new InvalidOperationException(signErrorMessage);
                }
            }

        // Fallback: aceitar URL externa apenas se o médico fornecer explicitamente
        if (string.IsNullOrWhiteSpace(dto.SignedDocumentUrl))
        {
            var msg = request.RequestType == Domain.Enums.RequestType.Prescription
                ? "Não foi possível gerar/assinar o PDF. Verifique: (1) médico tem certificado digital válido, (2) receita tem ao menos um medicamento informado."
                : request.RequestType == Domain.Enums.RequestType.Exam
                    ? "Não foi possível gerar/assinar o PDF. Verifique: (1) médico tem certificado digital válido, (2) pedido de exame tem ao menos um exame informado."
                    : "Assinatura requer fluxo específico. Entre em contato com o suporte.";
            throw new InvalidOperationException(msg);
        }

        var signedDocumentUrl = dto.SignedDocumentUrl.Trim();
        var signatureId = !string.IsNullOrWhiteSpace(dto.SignatureData) ? dto.SignatureData : Guid.NewGuid().ToString();

        request.Sign(signedDocumentUrl, signatureId);
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        await pushDispatcher.SendAsync(PushNotificationRules.Signed(request.PatientId, request.Id, request.RequestType), cancellationToken);
        await PublishRequestUpdatedAsync(request, "Documento assinado", cancellationToken);
        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }

    public async Task<(bool IsValid, IReadOnlyList<string> MissingFields, IReadOnlyList<string> Messages)> ValidatePrescriptionAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");
        if (request.RequestType != RequestType.Prescription && request.RequestType != RequestType.Exam)
            throw new InvalidOperationException("Apenas solicitações de receita ou exame podem ser validadas.");
        var isDoctor = request.DoctorId == userId;
        var isPatient = request.PatientId == userId;
        if (!isDoctor && !isPatient)
            throw new UnauthorizedAccessException("Somente o médico ou paciente podem validar a receita ou exame.");

        var doctorProfile = request.DoctorId.HasValue ? await doctorRepository.GetByUserIdAsync(request.DoctorId.Value, cancellationToken) : null;
        var doctorUser = request.DoctorId.HasValue ? await userRepository.GetByIdAsync(request.DoctorId.Value, cancellationToken) : null;
        var patientUser = await userRepository.GetByIdAsync(request.PatientId, cancellationToken);

        if (request.RequestType == RequestType.Prescription)
        {
            var medications = request.Medications?.Where(m => !string.IsNullOrWhiteSpace(m)).ToList() ?? new List<string>();
            if (medications.Count == 0 && !string.IsNullOrWhiteSpace(request.AiExtractedJson))
                medications = RequestHelpers.ParseMedicationsFromAiJson(request.AiExtractedJson, logger);

            var kind = request.PrescriptionKind ?? PrescriptionKind.Simple;
            var result = PrescriptionComplianceValidator.Validate(
                kind,
                request.PatientName,
                patientUser?.Cpf,
                patientUser?.Address,
                patientUser?.Gender,
                patientUser?.BirthDate,
                medications,
                doctorUser?.Name ?? request.DoctorName,
                doctorProfile?.Crm,
                doctorProfile?.CrmState,
                doctorProfile?.ProfessionalAddress,
                doctorProfile?.ProfessionalPhone);
            return (result.IsValid, result.MissingFields, result.Messages);
        }

        var exams = request.Exams?.Where(e => !string.IsNullOrWhiteSpace(e)).ToList() ?? new List<string>();
        var examResult = PrescriptionComplianceValidator.ValidateExam(
            request.PatientName,
            patientUser?.Cpf,
            exams,
            doctorUser?.Name ?? request.DoctorName,
            doctorProfile?.Crm,
            doctorProfile?.CrmState,
            doctorProfile?.ProfessionalAddress,
            doctorProfile?.ProfessionalPhone);
        return (examResult.IsValid, examResult.MissingFields, examResult.Messages);
    }

    public async Task<byte[]?> GetPrescriptionPdfPreviewAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) return null;
        if (request.RequestType != RequestType.Prescription) return null;
        var isDoctor = request.DoctorId == userId;
        var isPatient = request.PatientId == userId;
        if (!isDoctor && !isPatient) return null;

        var medications = request.Medications?.Where(m => !string.IsNullOrWhiteSpace(m)).ToList() ?? new List<string>();
        if (medications.Count == 0 && !string.IsNullOrWhiteSpace(request.AiExtractedJson))
            medications = RequestHelpers.ParseMedicationsFromAiJson(request.AiExtractedJson, logger);
        // Não retornar null quando não há medicamentos: o PrescriptionPdfService gera um PDF com placeholder
        // para o médico sempre ver o preview da receita na tela de edição.

        var doctorProfile = request.DoctorId.HasValue ? await doctorRepository.GetByUserIdAsync(request.DoctorId.Value, cancellationToken) : null;
        var doctorUser = request.DoctorId.HasValue ? await userRepository.GetByIdAsync(request.DoctorId.Value, cancellationToken) : null;
        var patientUser = await userRepository.GetByIdAsync(request.PatientId, cancellationToken);

        var kind = request.PrescriptionKind ?? PrescriptionKind.Simple;

        List<PrescriptionMedicationItem>? aiMedItems2 = null;
        if (medications.Count == 0 || medications.All(m => m.Trim().Length < 5))
        {
            var aiInput2 = new AiPrescriptionGeneratorInput(
                PatientName: request.PatientName ?? "Paciente",
                PatientBirthDate: patientUser?.BirthDate,
                PatientGender: patientUser?.Gender,
                Symptoms: request.Symptoms,
                AiSummaryForDoctor: request.AiSummaryForDoctor,
                AiExtractedJson: request.AiExtractedJson,
                DoctorNotes: request.Notes,
                Kind: kind);
            aiMedItems2 = await aiPrescriptionGenerator.GenerateMedicationsAsync(aiInput2, cancellationToken);
        }

        var pdfData = new PrescriptionPdfData(
            request.Id,
            request.PatientName ?? "Paciente",
            patientUser?.Cpf,
            doctorUser?.Name ?? request.DoctorName ?? "Médico",
            doctorProfile?.Crm ?? "CRM",
            doctorProfile?.CrmState ?? "SP",
            doctorProfile?.Specialty ?? "Clínica Geral",
            medications,
            RequestHelpers.PrescriptionTypeToDisplay(request.PrescriptionType) ?? "simples",
            BrazilDateTime.Now,
            AdditionalNotes: request.Notes,
            PrescriptionKind: kind,
            PatientGender: patientUser?.Gender,
            PatientPhone: patientUser?.Phone?.Value,
            PatientAddress: RequestHelpers.FormatPatientAddress(patientUser),
            PatientBirthDate: patientUser?.BirthDate,
            MedicationItems: aiMedItems2,
            DoctorAddress: doctorProfile?.ProfessionalAddress,
            DoctorPhone: doctorProfile?.ProfessionalPhone,
            AutoObservation: request.AutoObservation,
            DoctorConductNotes: request.DoctorConductNotes,
            IncludeConductInPdf: request.IncludeConductInPdf);

        var result = await prescriptionPdfService.GenerateAsync(pdfData, cancellationToken);
        return result.Success ? result.PdfBytes : null;
    }

    /// <summary>
    /// Gera preview do PDF de pedido de exame para o médico visualizar antes de assinar.
    /// </summary>
    public async Task<byte[]?> GetExamPdfPreviewAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) return null;
        if (request.RequestType != RequestType.Exam) return null;
        var isDoctor = request.DoctorId == userId;
        var isPatient = request.PatientId == userId;
        if (!isDoctor && !isPatient) return null;

        var exams = request.Exams?.Where(e => !string.IsNullOrWhiteSpace(e)).ToList() ?? new List<string>();
        if (exams.Count == 0)
            exams = new List<string> { "Exames conforme solicitação médica" };

        var doctorProfile = request.DoctorId.HasValue ? await doctorRepository.GetByUserIdAsync(request.DoctorId.Value, cancellationToken) : null;
        var doctorUser = request.DoctorId.HasValue ? await userRepository.GetByIdAsync(request.DoctorId.Value, cancellationToken) : null;
        var patientUser = await userRepository.GetByIdAsync(request.PatientId, cancellationToken);

        var examPdfData = new ExamPdfData(
            RequestId: request.Id,
            PatientName: request.PatientName ?? "Paciente",
            PatientCpf: patientUser?.Cpf,
            DoctorName: doctorUser?.Name ?? request.DoctorName ?? "Médico",
            DoctorCrm: doctorProfile?.Crm ?? "CRM",
            DoctorCrmState: doctorProfile?.CrmState ?? "SP",
            DoctorSpecialty: doctorProfile?.Specialty ?? "Clínica Geral",
            Exams: exams,
            Notes: request.Notes,
            EmissionDate: BrazilDateTime.Now,
            AccessCode: request.AccessCode,
            PatientBirthDate: patientUser?.BirthDate,
            PatientPhone: patientUser?.Phone?.Value,
            PatientAddress: RequestHelpers.FormatPatientAddress(patientUser),
            DoctorAddress: doctorProfile?.ProfessionalAddress,
            DoctorPhone: doctorProfile?.ProfessionalPhone,
            ClinicalIndication: request.Symptoms,
            AutoObservation: request.AutoObservation,
            DoctorConductNotes: request.DoctorConductNotes,
            IncludeConductInPdf: request.IncludeConductInPdf);

        var result = await prescriptionPdfService.GenerateExamRequestAsync(examPdfData, cancellationToken);
        return result.Success ? result.PdfBytes : null;
    }

    /// <summary>
    /// Paciente marca o documento como entregue (Signed → Delivered) ao baixar/abrir o PDF.
    /// </summary>
    public async Task<RequestResponseDto> MarkDeliveredAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        if (request.PatientId != userId)
            throw new UnauthorizedAccessException("Only the patient can mark the document as delivered");

        request.Deliver();
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        await PublishRequestUpdatedAsync(request, "Documento recebido", cancellationToken);
        // Notifica o médico que o paciente recebeu/baixou o documento
        if (request.DoctorId.HasValue)
        {
            var tipoDoc = request.RequestType == RequestType.Prescription ? "receita" : "pedido de exame";
            await CreateNotificationAsync(
                request.DoctorId.Value,
                "Documento Recebido",
                $"O paciente {request.PatientName ?? "paciente"} recebeu o {tipoDoc}.",
                cancellationToken,
                new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() },
                targetRole: "doctor");
        }

        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }

    /// <summary>
    /// Obtém bytes do PDF assinado. Paciente ou médico atribuído ao atendimento.
    /// </summary>
    public async Task<byte[]?> GetSignedDocumentAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null || string.IsNullOrWhiteSpace(request.SignedDocumentUrl))
            return null;

        var isPatient = request.PatientId == userId;
        var isDoctor = request.DoctorId.HasValue && request.DoctorId.Value == userId;
        if (!isPatient && !isDoctor)
            return null;

        try
        {
            return await DownloadSignedDocumentAsync(request.SignedDocumentUrl, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falha ao buscar PDF assinado para request {RequestId}", id);
            return null;
        }
    }

    /// <summary>
    /// Obtém bytes do PDF assinado via token temporário (para links abertos em navegador sem Bearer).
    /// </summary>
    public async Task<byte[]?> GetSignedDocumentByTokenAsync(Guid id, string? token, CancellationToken cancellationToken = default)
    {
        if (!documentTokenService.ValidateDocumentToken(token, id))
            return null;

        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null || string.IsNullOrWhiteSpace(request.SignedDocumentUrl))
            return null;

        try
        {
            return await DownloadSignedDocumentAsync(request.SignedDocumentUrl, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falha ao buscar PDF assinado (token) para request {RequestId}", id);
            return null;
        }
    }

    /// <summary>
    /// Baixa o PDF assinado: path (Storage) ou URL (legado/externo).
    /// Path: storageService.DownloadAsync. URL: DownloadFromStorageUrlAsync ou HTTP fallback.
    /// </summary>
    private async Task<byte[]?> DownloadSignedDocumentAsync(string refOrUrl, CancellationToken cancellationToken)
    {
        var trimmed = refOrUrl.Trim();

        // Caso novo: PATH (ex.: signed/abc.pdf) — bucket pode ser privado
        if (!trimmed.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            return await storageService.DownloadAsync(trimmed, cancellationToken);

        // Caso legado: URL — tenta nosso storage primeiro (service_role), senão HTTP
        var bytes = await storageService.DownloadFromStorageUrlAsync(trimmed, cancellationToken);
        if (bytes != null) return bytes;

        using var client = httpClientFactory.CreateClient();
        return await client.GetByteArrayAsync(trimmed, cancellationToken);
    }

    /// <summary>
    /// Obtém bytes de uma imagem de receita ou exame. Valida acesso via token ou Bearer.
    /// </summary>
    public async Task<byte[]?> GetRequestImageAsync(Guid id, string? token, Guid? userId, string imageType, int index, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            return null;

        if (!string.IsNullOrWhiteSpace(token))
        {
            if (!documentTokenService.ValidateDocumentToken(token, id))
                return null;
        }
        else if (userId.HasValue)
        {
            var isPatient = request.PatientId == userId.Value;
            var isAssignedDoctor = request.DoctorId.HasValue && request.DoctorId.Value == userId.Value;
            var isAvailableForDoctor = !request.DoctorId.HasValue || request.DoctorId == Guid.Empty;
            User? user = null;
            if (!isPatient && !isAssignedDoctor && isAvailableForDoctor)
                user = await userRepository.GetByIdAsync(userId.Value, cancellationToken);
            var canAccess = isPatient || isAssignedDoctor || (isAvailableForDoctor && user?.Role == UserRole.Doctor);
            if (!canAccess)
                return null;
        }
        else
        {
            return null;
        }

        List<string> urls;
        if (string.Equals(imageType, "prescription", StringComparison.OrdinalIgnoreCase))
            urls = request.PrescriptionImages;
        else if (string.Equals(imageType, "exam", StringComparison.OrdinalIgnoreCase))
            urls = request.ExamImages;
        else
            return null;

        if (urls == null || index < 0 || index >= urls.Count)
            return null;

        var storageUrl = urls[index];
        return await storageService.DownloadFromStorageUrlAsync(storageUrl, cancellationToken);
    }
}
