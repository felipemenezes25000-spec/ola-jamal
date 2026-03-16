using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.DTOs.Video;
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
/// Serviço de solicitações médicas: receita, exame, consulta, aprovação, rejeição, assinatura e sala de vídeo.
/// </summary>
public class RequestService(
    IRequestRepository requestRepository,
    IUserRepository userRepository,
    IDoctorRepository doctorRepository,
    INotificationRepository notificationRepository,
    IPushNotificationSender pushNotificationSender,
    IPushNotificationDispatcher pushDispatcher,
    IAiReadingService aiReadingService,
    IOptions<ApiConfig> apiConfig,
    IDocumentTokenService documentTokenService,
    IConsultationTimeBankRepository consultationTimeBankRepository,
    IAiConductSuggestionService aiConductSuggestionService,
    IRequestEventsPublisher requestEventsPublisher,
    INewRequestBatchService newRequestBatchService,
    IAuditService auditService,
    IRequestApprovalService requestApprovalService,
    IRequestQueryService requestQueryService,
    IConsultationLifecycleService consultationLifecycleService,
    ISignatureService signatureService,
    ILogger<RequestService> logger) : IRequestService
{
    private readonly string _apiBaseUrl = (apiConfig?.Value?.BaseUrl ?? "").Trim();

    private Task PublishRequestUpdatedAsync(MedicalRequest request, string? message = null, CancellationToken cancellationToken = default)
        => requestEventsPublisher.NotifyRequestUpdatedAsync(
            request.Id,
            request.PatientId,
            request.DoctorId,
            EnumHelper.ToSnakeCase(request.Status),
            message,
            cancellationToken);


    /// <summary>
    /// Cria uma solicitação de receita médica (tipo + foto + medicamentos). Status Submitted.
    /// Serviço gratuito — sem fluxo de pagamento.
    /// </summary>
    public async Task<RequestResponseDto> CreatePrescriptionAsync(
        CreatePrescriptionRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        if (user == null)
            throw new InvalidOperationException("User not found");

        var prescriptionType = RequestHelpers.ParsePrescriptionType(request.PrescriptionType);
        var prescriptionKind = RequestHelpers.ParsePrescriptionKind(request.PrescriptionKind);

        var medications = request.Medications ?? new List<string>();
        await EnforcePrescriptionCooldownAsync(userId, prescriptionKind, prescriptionType, medications, cancellationToken);
        var controlledDuplicateWarning = await BuildControlledDuplicateWarningAsync(userId, prescriptionKind, medications, cancellationToken);

        var medicalRequest = MedicalRequest.CreatePrescription(
            userId,
            user.Name,
            prescriptionType,
            medications,
            request.PrescriptionImages,
            prescriptionKind);

        medicalRequest = await requestRepository.CreateAsync(medicalRequest, cancellationToken) ?? medicalRequest;

        // AutoObservation em update separado — sem transacao atomica.
        // Falha aqui não deve abortar a criação do pedido (o médico pode processar mesmo sem ela).
        try
        {
            var autoObs = RequestHelpers.GenerateAutoObservation(RequestType.Prescription, prescriptionType);
            if (!string.IsNullOrWhiteSpace(controlledDuplicateWarning))
                autoObs = string.IsNullOrWhiteSpace(autoObs) ? controlledDuplicateWarning : $"{autoObs}\n\n{controlledDuplicateWarning}";

            medicalRequest.SetAutoObservation(autoObs);
            medicalRequest = await requestRepository.UpdateAsync(medicalRequest, cancellationToken) ?? medicalRequest;
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Falha ao salvar AutoObservation para receita {RequestId}. Pedido criado sem ela.", medicalRequest.Id);
        }

        try
        {
            await RunPrescriptionAiAndUpdateAsync(medicalRequest, cancellationToken);
        }
        catch (Exception ex)
        {
            if (logger != null)
                logger.LogError(ex, "IA receita: falha inesperada para request {RequestId}. Solicitação criada, mas sem análise. O médico pode usar Reanalisar.", medicalRequest?.Id ?? Guid.Empty);
            // Não relança - a solicitação foi criada com sucesso; o médico pode clicar em "Reanalisar com IA"
        }

        var latest = await requestRepository.GetByIdAsync(medicalRequest!.Id, cancellationToken);
        var req = latest ?? medicalRequest;

        if (req != null && req.Status != RequestStatus.Rejected)
        {
            // Paciente acabou de enviar — push "Pedido enviado" desnecessário
            // await pushDispatcher.SendAsync(PushNotificationRules.Submitted(userId, req.Id, RequestType.Prescription), cancellationToken);
            await NotifyAvailableDoctorsOfNewRequestAsync("receita", req, cancellationToken);
            await requestEventsPublisher.NotifyNewRequestToDoctorsAsync(req.Id, "submitted", "Nova receita na fila", cancellationToken);
        }

        return RequestHelpers.MapRequestToDto(req!, _apiBaseUrl, documentTokenService);
    }

    /// <summary>
    /// Cria uma solicitação de exame. Status Submitted. Serviço gratuito.
    /// </summary>
    public async Task<RequestResponseDto> CreateExamAsync(
        CreateExamRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        if (user == null)
            throw new InvalidOperationException("User not found");

        await EnforceExamCooldownAsync(userId, request.Exams ?? new List<string>(), cancellationToken);

        var medicalRequest = MedicalRequest.CreateExam(
            userId,
            user.Name,
            request.ExamType ?? "geral",
            request.Exams ?? new List<string>(),
            request.Symptoms,
            request.ExamImages);

        medicalRequest = await requestRepository.CreateAsync(medicalRequest, cancellationToken) ?? medicalRequest;

        // AutoObservation em update separado — sem transacao atomica.
        try
        {
            var autoObs = RequestHelpers.GenerateAutoObservation(RequestType.Exam, examType: request.ExamType);
            medicalRequest.SetAutoObservation(autoObs);
            medicalRequest = await requestRepository.UpdateAsync(medicalRequest, cancellationToken) ?? medicalRequest;
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Falha ao salvar AutoObservation para exame {RequestId}. Pedido criado sem ela.", medicalRequest.Id);
        }

        try
        {
            await RunExamAiAndUpdateAsync(medicalRequest, cancellationToken);
        }
        catch (Exception ex)
        {
            if (logger != null)
                logger.LogError(ex, "IA exame: falha inesperada para request {RequestId}. Solicitação criada, mas sem análise. O médico pode usar Reanalisar.", medicalRequest?.Id ?? Guid.Empty);
        }

        var latest = await requestRepository.GetByIdAsync(medicalRequest!.Id, cancellationToken);
        var req = latest ?? medicalRequest;

        if (req != null && req.Status != RequestStatus.Rejected)
        {
            // Paciente acabou de enviar — push "Pedido enviado" desnecessário
            // await pushDispatcher.SendAsync(PushNotificationRules.Submitted(userId, req.Id, RequestType.Exam), cancellationToken);
            await NotifyAvailableDoctorsOfNewRequestAsync("exame", req, cancellationToken);
            await requestEventsPublisher.NotifyNewRequestToDoctorsAsync(req.Id, "submitted", "Novo exame na fila", cancellationToken);
        }

        return RequestHelpers.MapRequestToDto(req!, _apiBaseUrl, documentTokenService);
    }

    /// <summary>
    /// Cria uma solicitação de consulta. Status SearchingDoctor. Serviço gratuito.
    /// </summary>
    public async Task<RequestResponseDto> CreateConsultationAsync(
        CreateConsultationRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        if (user == null)
            throw new InvalidOperationException("User not found");

        var consultationType = string.IsNullOrWhiteSpace(request.ConsultationType)
            ? "medico_clinico"
            : request.ConsultationType;
        var durationMinutes = request.DurationMinutes > 0 ? request.DurationMinutes : 15;

        // Serviço gratuito — sem cobrança

        var medicalRequest = MedicalRequest.CreateConsultation(
            userId,
            user.Name,
            request.Symptoms,
            consultationType,
            durationMinutes);

        medicalRequest = await requestRepository.CreateAsync(medicalRequest, cancellationToken) ?? medicalRequest;

        // BUG FIX: consolidar AutoObservation + EffectivePrice em um único UpdateAsync
        // para evitar dois round-trips ao banco e estado inconsistente se o segundo falhar.
        try
        {
            var autoObs = RequestHelpers.GenerateAutoObservation(RequestType.Consultation);
            medicalRequest.SetAutoObservation(autoObs);
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Falha ao gerar AutoObservation para consulta {RequestId}. Prosseguindo sem ela.", medicalRequest.Id);
        }

        // Banco de horas: débito só ao finalizar a consulta (não na criação). Se cancelar, nada foi debitado.
        // Serviço gratuito — preço efetivo 0

        medicalRequest.SetEffectivePrice(0);

        // Salvar AutoObservation + preço efetivo em uma única operação
        medicalRequest = await requestRepository.UpdateAsync(medicalRequest, cancellationToken) ?? medicalRequest;

        // Paciente acabou de enviar — push "Pedido enviado" desnecessário
        // await pushDispatcher.SendAsync(PushNotificationRules.Submitted(userId, medicalRequest.Id, RequestType.Consultation), cancellationToken);

        await NotifyAvailableDoctorsOfNewRequestAsync("consulta", medicalRequest, cancellationToken);
        await requestEventsPublisher.NotifyNewRequestToDoctorsAsync(medicalRequest.Id, "submitted", "Nova consulta na fila", cancellationToken);

        return RequestHelpers.MapRequestToDto(medicalRequest, _apiBaseUrl, documentTokenService);
    }

    public Task<List<RequestResponseDto>> GetUserRequestsAsync(
        Guid userId, string? status = null, string? type = null, CancellationToken cancellationToken = default)
        => requestQueryService.GetUserRequestsAsync(userId, status, type, cancellationToken);

    public Task<PagedResponse<RequestResponseDto>> GetUserRequestsPagedAsync(
        Guid userId, string? status = null, string? type = null, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default)
        => requestQueryService.GetUserRequestsPagedAsync(userId, status, type, page, pageSize, cancellationToken);

    public Task<RequestResponseDto> GetRequestByIdAsync(
        Guid id, Guid userId, CancellationToken cancellationToken = default)
        => requestQueryService.GetRequestByIdAsync(id, userId, cancellationToken);

    public Task<List<RequestResponseDto>> GetPatientRequestsAsync(
        Guid doctorId, Guid patientId, CancellationToken cancellationToken = default)
        => requestQueryService.GetPatientRequestsAsync(doctorId, patientId, cancellationToken);

    public Task<PatientProfileForDoctorDto?> GetPatientProfileForDoctorAsync(
        Guid doctorId, Guid patientId, CancellationToken cancellationToken = default)
        => requestQueryService.GetPatientProfileForDoctorAsync(doctorId, patientId, cancellationToken);

    public Task<(int PendingCount, int InReviewCount, int CompletedCount, decimal TotalEarnings)> GetDoctorStatsAsync(
        Guid doctorId, CancellationToken cancellationToken = default)
        => requestQueryService.GetDoctorStatsAsync(doctorId, cancellationToken);

    /// <summary>
    /// Atualiza o status de uma solicitação. Somente o médico atribuído pode alterar.
    /// </summary>
    public async Task<RequestResponseDto> UpdateStatusAsync(
        Guid id,
        UpdateRequestStatusDto dto,
        Guid doctorId,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        // BUG FIX: validar que o médico autenticado é o médico atribuído à solicitação
        if (request.DoctorId.HasValue && request.DoctorId.Value != doctorId)
            throw new UnauthorizedAccessException("Somente o médico atribuído pode alterar o status desta solicitação.");

        var newStatus = EnumHelper.ParseSnakeCase<RequestStatus>(dto.Status);
        request.UpdateStatus(newStatus);

        if (!string.IsNullOrWhiteSpace(dto.RejectionReason))
        {
            request.Reject(dto.RejectionReason);
        }

        request = await requestRepository.UpdateAsync(request, cancellationToken);

        await CreateNotificationAsync(
            request.PatientId,
            "Status Atualizado",
            $"Sua solicitação foi atualizada para: {dto.Status}",
            cancellationToken,
            new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });

        await PublishRequestUpdatedAsync(request, "Status atualizado", cancellationToken);
        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }

    /// <summary>
    /// Aprova uma solicitação (médico). Delega ao RequestApprovalService.
    /// </summary>
    public async Task<RequestResponseDto> ApproveAsync(
        Guid id,
        ApproveRequestDto dto,
        Guid doctorId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var request = await requestApprovalService.ApproveAsync(id, dto, doctorId, cancellationToken);
            return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Erro ao aprovar solicitação {RequestId}", id);
            throw;
        }
    }

    /// <summary>
    /// Rejeita uma solicitação com motivo. Delega ao RequestApprovalService.
    /// </summary>
    public async Task<RequestResponseDto> RejectAsync(
        Guid id,
        RejectRequestDto dto,
        Guid doctorId,
        CancellationToken cancellationToken = default)
    {
        var request = await requestApprovalService.RejectAsync(id, dto, doctorId, cancellationToken);
        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }

    /// <summary>
    /// Atribui a solicitação ao primeiro médico disponível na fila.
    /// </summary>
    public async Task<RequestResponseDto> AssignToQueueAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        // Get available doctors (simple queue logic)
        var doctors = await doctorRepository.GetAvailableAsync(null, cancellationToken);
        if (doctors.Count == 0)
            throw new InvalidOperationException("No available doctors");

        var selectedDoctor = doctors.First();
        var doctorUser = await userRepository.GetByIdAsync(selectedDoctor.UserId, cancellationToken);
        
        if (doctorUser != null)
        {
            request.AssignDoctor(doctorUser.Id, doctorUser.Name);
            request = await requestRepository.UpdateAsync(request, cancellationToken);

            // "Seu pedido está em análise" — push informativo desnecessário (paciente já vê na tela)
            // await pushDispatcher.SendAsync(PushNotificationRules.InReview(request.PatientId, request.Id, request.RequestType), cancellationToken);
            await pushDispatcher.SendAsync(PushNotificationRules.RequestAssigned(doctorUser.Id, request.Id, request.RequestType), cancellationToken);
        }

        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }

    /// <summary>
    /// Aceita a consulta, cria sala de vídeo e notifica o paciente.
    /// </summary>
    public Task<(RequestResponseDto Request, VideoRoomResponseDto VideoRoom)> AcceptConsultationAsync(
        Guid id, Guid doctorId, CancellationToken cancellationToken = default)
        => consultationLifecycleService.AcceptConsultationAsync(id, doctorId, cancellationToken);

    public Task<RequestResponseDto> StartConsultationAsync(Guid id, Guid doctorId, CancellationToken cancellationToken = default)
        => consultationLifecycleService.StartConsultationAsync(id, doctorId, cancellationToken);

    public Task<RequestResponseDto> ReportCallConnectedAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
        => consultationLifecycleService.ReportCallConnectedAsync(id, userId, cancellationToken);

    public Task<RequestResponseDto> FinishConsultationAsync(Guid id, Guid doctorId, FinishConsultationDto? dto, CancellationToken cancellationToken = default)
        => consultationLifecycleService.FinishConsultationAsync(id, doctorId, dto, cancellationToken);

    public Task<string?> GetTranscriptDownloadUrlAsync(Guid id, Guid userId, int expiresInSeconds = 3600, CancellationToken cancellationToken = default)
        => consultationLifecycleService.GetTranscriptDownloadUrlAsync(id, userId, expiresInSeconds, cancellationToken);

    public Task<string?> GetRecordingDownloadUrlAsync(Guid id, Guid userId, int expiresInSeconds = 3600, CancellationToken cancellationToken = default)
        => consultationLifecycleService.GetRecordingDownloadUrlAsync(id, userId, expiresInSeconds, cancellationToken);

    public Task<RequestResponseDto> SignAsync(Guid id, SignRequestDto dto, CancellationToken cancellationToken = default)
        => signatureService.SignAsync(id, dto, cancellationToken);

    public async Task<RequestResponseDto> ReanalyzePrescriptionAsync(Guid id, ReanalyzePrescriptionDto dto, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) throw new KeyNotFoundException("Solicitação não encontrada");
        if (request.RequestType != RequestType.Prescription) throw new InvalidOperationException("Apenas solicitações de receita podem ser reanalisadas.");
        if (request.PatientId != userId) throw new UnauthorizedAccessException("Somente o paciente da solicitação pode solicitar reanálise.");
        if (dto.PrescriptionImageUrls == null || dto.PrescriptionImageUrls.Count == 0)
            throw new ArgumentException("Envie pelo menos uma URL de imagem da receita.");
        var urls = dto.PrescriptionImageUrls.ToList();
        try
        {
            logger.LogDebug("IA reanálise receita (paciente): request {RequestId}, {UrlCount} URL(s)", id, urls.Count);
            var result = await aiReadingService.AnalyzePrescriptionAsync(urls, cancellationToken);
            var outcome = ValidatePrescriptionAiResult(result, request);

            switch (outcome.Action)
            {
                case "reject":
                    request.Reject(outcome.RejectionMessage!);
                    request = await requestRepository.UpdateAsync(request, cancellationToken);
                    logger.LogDebug("IA reanálise receita (paciente): request {RequestId} REJEITADO. Motivo: {Msg}", id, outcome.RejectionMessage);
                    break;

                case "doubts":
                    request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, true, null);
                    request = await requestRepository.UpdateAsync(request, cancellationToken);
                    logger.LogDebug("IA reanálise receita (paciente): request {RequestId} encaminhado com dúvidas", id);
                    if (request.DoctorId.HasValue)
                    {
                        await CreateNotificationAsync(
                            request.DoctorId.Value,
                            "Reanálise Solicitada",
                            "O paciente solicitou reanálise da receita. Nova análise da IA disponível (com dúvidas para sua avaliação).",
                            cancellationToken,
                            new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() },
                            targetRole: "doctor");
                    }
                    break;

                default: // success
                    request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, true, null);
                    request = await requestRepository.UpdateAsync(request, cancellationToken);
                    logger.LogDebug("IA reanálise receita (paciente): sucesso para request {RequestId}", id);
                    if (request.DoctorId.HasValue)
                    {
                        await CreateNotificationAsync(
                            request.DoctorId.Value,
                            "Reanálise Solicitada",
                            "O paciente solicitou reanálise da receita. Nova análise da IA disponível.",
                            cancellationToken,
                            new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() },
                            targetRole: "doctor");
                    }
                    break;
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "IA reanálise receita (paciente): falhou para request {RequestId}. {Message}", id, ex.Message);
            request.SetAiAnalysis("[Reanálise por IA indisponível.]", null, null, null, null, null);
            request = await requestRepository.UpdateAsync(request, cancellationToken);
            await CreateNotificationAsync(
                request.PatientId,
                "Reanálise não concluída",
                "Não foi possível concluir a reanálise da IA. Tente novamente ou entre em contato com o suporte.",
                cancellationToken,
                new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
        }
        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }

    public async Task<RequestResponseDto> ReanalyzeAsDoctorAsync(Guid id, Guid doctorId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) throw new KeyNotFoundException("Solicitação não encontrada");
        if (request.DoctorId != doctorId) throw new UnauthorizedAccessException("Somente o médico atribuído pode reanalisar.");

        if (request.RequestType == RequestType.Prescription)
        {
            if (request.PrescriptionImages.Count == 0)
                throw new InvalidOperationException("Não há imagens de receita para analisar.");
            try
            {
                logger.LogDebug("IA reanálise receita (médico): request {RequestId}, {ImageCount} imagem(ns)", id, request.PrescriptionImages.Count);
                var result = await aiReadingService.AnalyzePrescriptionAsync(request.PrescriptionImages, cancellationToken);
                var outcome = ValidatePrescriptionAiResult(result, request);
                switch (outcome.Action)
                {
                    case "reject":
                        request.Reject(outcome.RejectionMessage!);
                        logger.LogDebug("IA reanálise receita (médico): request {RequestId} REJEITADO. Motivo: {Msg}", id, outcome.RejectionMessage);
                        break;
                    case "doubts":
                        request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, true, null);
                        logger.LogDebug("IA reanálise receita (médico): request {RequestId} - dúvidas documentadas", id);
                        break;
                    default: // success
                        request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, true, null);
                        logger.LogDebug("IA reanálise receita (médico): sucesso para request {RequestId}", id);
                        break;
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "IA reanálise receita (médico): falhou para request {RequestId}. {Message}", id, ex.Message);
                request.SetAiAnalysis("[Reanálise por IA indisponível. Verifique a chave OpenAI e as URLs das imagens.]", null, null, null, null, null);
            }
        }
        else if (request.RequestType == RequestType.Exam)
        {
            var textDescription = !string.IsNullOrEmpty(request.Symptoms) ? request.Symptoms : null;
            var imageUrls = request.ExamImages.Count > 0 ? request.ExamImages : null;
            if ((imageUrls == null || imageUrls.Count == 0) && string.IsNullOrWhiteSpace(textDescription))
                throw new InvalidOperationException("Não há imagens ou texto de exame para analisar.");
            try
            {
                logger.LogDebug("IA reanálise exame (médico): request {RequestId}", id);
                var result = await aiReadingService.AnalyzeExamAsync(imageUrls, textDescription, cancellationToken);
                var hasImages = imageUrls != null && imageUrls.Count > 0;
                var outcome = ValidateExamAiResult(result, request, hasImages);
                switch (outcome.Action)
                {
                    case "reject":
                        request.Reject(outcome.RejectionMessage!);
                        logger.LogDebug("IA reanálise exame (médico): request {RequestId} REJEITADO. Motivo: {Msg}", id, outcome.RejectionMessage);
                        break;
                    case "doubts":
                        request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, true, null);
                        logger.LogDebug("IA reanálise exame (médico): request {RequestId} - dúvidas documentadas", id);
                        break;
                    default: // success
                        request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, result.ReadabilityOk, result.MessageToUser);
                        logger.LogDebug("IA reanálise exame (médico): sucesso para request {RequestId}", id);
                        break;
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "IA reanálise exame (médico): falhou para request {RequestId}. {Message}", id, ex.Message);
                request.SetAiAnalysis("[Reanálise por IA indisponível.]", null, null, null, null, null);
            }
        }
        else
            throw new InvalidOperationException("Apenas receitas e exames podem ser reanalisados pela IA.");

        request = await requestRepository.UpdateAsync(request, cancellationToken);
        await CreateNotificationAsync(
            doctorId,
            "Reanálise concluída",
            "A reanálise da IA foi concluída. A nova análise está disponível.",
            cancellationToken,
            new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() },
            targetRole: "doctor");
        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }

    public async Task<RequestResponseDto> ReanalyzeExamAsync(Guid id, ReanalyzeExamDto dto, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) throw new KeyNotFoundException("Solicitação não encontrada");
        if (request.RequestType != RequestType.Exam) throw new InvalidOperationException("Apenas solicitações de exame podem ser reanalisadas.");
        if (request.PatientId != userId) throw new UnauthorizedAccessException("Somente o paciente da solicitação pode solicitar reanálise.");
        var imageUrls = dto.ExamImageUrls?.ToList() ?? new List<string>();
        var textDescription = dto.TextDescription?.Trim();
        if (imageUrls.Count == 0 && string.IsNullOrWhiteSpace(textDescription))
            throw new ArgumentException("Envie imagens do pedido de exame e/ou texto para reanalisar.");
        try
        {
            logger.LogDebug("IA reanálise exame (paciente): request {RequestId}, Imagens={ImageCount}, TextoLen={TextLen}", id, imageUrls.Count, textDescription?.Length ?? 0);
            var result = await aiReadingService.AnalyzeExamAsync(imageUrls, textDescription, cancellationToken);
            var hasImages = imageUrls.Count > 0;
            var outcome = ValidateExamAiResult(result, request, hasImages);

            switch (outcome.Action)
            {
                case "reject":
                    request.Reject(outcome.RejectionMessage!);
                    request = await requestRepository.UpdateAsync(request, cancellationToken);
                    logger.LogDebug("IA reanálise exame (paciente): request {RequestId} REJEITADO. Motivo: {Msg}", id, outcome.RejectionMessage);
                    break;

                case "doubts":
                    request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, true, null);
                    request = await requestRepository.UpdateAsync(request, cancellationToken);
                    logger.LogDebug("IA reanálise exame (paciente): request {RequestId} encaminhado com dúvidas", id);
                    if (request.DoctorId.HasValue)
                    {
                        await CreateNotificationAsync(
                            request.DoctorId.Value,
                            "Reanálise Solicitada",
                            "O paciente solicitou reanálise do pedido de exame. Nova análise da IA disponível (com dúvidas para sua avaliação).",
                            cancellationToken,
                            new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() },
                            targetRole: "doctor");
                    }
                    break;

                default: // success
                    request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, result.ReadabilityOk, result.MessageToUser);
                    request = await requestRepository.UpdateAsync(request, cancellationToken);
                    logger.LogDebug("IA reanálise exame (paciente): sucesso para request {RequestId}", id);
                    if (request.DoctorId.HasValue)
                    {
                        await CreateNotificationAsync(
                            request.DoctorId.Value,
                            "Reanálise Solicitada",
                            "O paciente solicitou reanálise do pedido de exame. Nova análise da IA disponível.",
                            cancellationToken,
                            new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() },
                            targetRole: "doctor");
                    }
                    break;
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "IA reanálise exame (paciente): falhou para request {RequestId}. {Message}", id, ex.Message);
            request.SetAiAnalysis("[Reanálise por IA indisponível.]", null, null, null, null, null);
            request = await requestRepository.UpdateAsync(request, cancellationToken);
            await CreateNotificationAsync(
                request.PatientId,
                "Reanálise não concluída",
                "Não foi possível concluir a reanálise da IA. Tente novamente ou entre em contato com o suporte.",
                cancellationToken,
                new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
        }
        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }

    public async Task<RequestResponseDto> UpdatePrescriptionContentAsync(Guid id, List<string>? medications, string? notes, Guid doctorId, CancellationToken cancellationToken = default, string? prescriptionKind = null)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) throw new KeyNotFoundException("Solicitação não encontrada");
        if (request.DoctorId != doctorId) throw new UnauthorizedAccessException("Somente o médico atribuído pode atualizar.");
        if (request.RequestType != RequestType.Prescription) throw new InvalidOperationException("Apenas receitas podem ter medicamentos atualizados.");
        if (request.Status != RequestStatus.Paid)
            throw new InvalidOperationException("Só é possível editar medicamentos/notas após o pagamento. O paciente deve pagar antes de editar e assinar.");
        var oldValues = new Dictionary<string, object?>
        {
            ["medications"] = request.Medications,
            ["notes"] = request.Notes,
            ["prescription_kind"] = request.PrescriptionKind?.ToString()
        };
        var pk = prescriptionKind != null ? RequestHelpers.ParsePrescriptionKind(prescriptionKind) : null;
        request.UpdatePrescriptionContent(medications, notes, pk);
        request = await requestRepository.UpdateAsync(request, cancellationToken);
        var newValues = new Dictionary<string, object?>
        {
            ["medications"] = request.Medications,
            ["notes"] = request.Notes,
            ["prescription_kind"] = request.PrescriptionKind?.ToString()
        };
        await auditService.LogModificationAsync(doctorId, "Update", "Request", id, oldValues, newValues, cancellationToken: cancellationToken);
        await CreateNotificationAsync(
            request.PatientId,
            "Receita atualizada",
            "O médico atualizou sua receita. O documento está disponível para assinatura.",
            cancellationToken,
            new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }

    public async Task<RequestResponseDto> UpdateExamContentAsync(Guid id, List<string>? exams, string? notes, Guid doctorId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) throw new KeyNotFoundException("Solicitação não encontrada");
        if (request.DoctorId != doctorId) throw new UnauthorizedAccessException("Somente o médico atribuído pode atualizar.");
        if (request.RequestType != RequestType.Exam) throw new InvalidOperationException("Apenas pedidos de exame podem ter exames atualizados.");
        if (request.Status != RequestStatus.Paid)
            throw new InvalidOperationException("Só é possível editar exames/notas após o pagamento. O paciente deve pagar antes de editar e assinar.");
        var oldValues = new Dictionary<string, object?>
        {
            ["exams"] = request.Exams,
            ["notes"] = request.Notes
        };
        request.UpdateExamContent(exams, notes);
        request = await requestRepository.UpdateAsync(request, cancellationToken);
        var newValues = new Dictionary<string, object?>
        {
            ["exams"] = request.Exams,
            ["notes"] = request.Notes
        };
        await auditService.LogModificationAsync(doctorId, "Update", "Request", id, oldValues, newValues, cancellationToken: cancellationToken);
        await CreateNotificationAsync(
            request.PatientId,
            "Pedido de exame atualizado",
            "O médico atualizou seu pedido de exame. O documento está disponível para assinatura.",
            cancellationToken,
            new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }

    public Task<(bool IsValid, IReadOnlyList<string> MissingFields, IReadOnlyList<string> Messages)> ValidatePrescriptionAsync(
        Guid id, Guid userId, CancellationToken cancellationToken = default)
        => signatureService.ValidatePrescriptionAsync(id, userId, cancellationToken);

    public Task<byte[]?> GetPrescriptionPdfPreviewAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
        => signatureService.GetPrescriptionPdfPreviewAsync(id, userId, cancellationToken);

    public Task<byte[]?> GetExamPdfPreviewAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
        => signatureService.GetExamPdfPreviewAsync(id, userId, cancellationToken);

    public Task<RequestResponseDto> MarkDeliveredAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
        => signatureService.MarkDeliveredAsync(id, userId, cancellationToken);


    /// <summary>
    /// Paciente cancela o pedido. Só é permitido antes da assinatura (submitted, in_review, approved, searching_doctor).
    /// </summary>
    public async Task<RequestResponseDto> CancelAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        if (request.PatientId != userId)
            throw new UnauthorizedAccessException("Only the patient can cancel this request");

        if (!RequestHelpers.CancellableStatuses.Contains(request.Status))
            throw new InvalidOperationException("Request can only be cancelled before payment is confirmed");

        // Banco de horas: débito só ao finalizar. Cancelamento não debitou nada.

        request.Cancel();
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        await PublishRequestUpdatedAsync(request, "Pedido cancelado", cancellationToken);
        if (request.DoctorId.HasValue)
        {
            await CreateNotificationAsync(
                request.DoctorId.Value,
                "Pedido Cancelado",
                "O paciente cancelou o pedido.",
                cancellationToken,
                new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() },
                targetRole: "doctor");
        }

        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }

    public Task<byte[]?> GetSignedDocumentAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
        => signatureService.GetSignedDocumentAsync(id, userId, cancellationToken);

    public Task<byte[]?> GetSignedDocumentByTokenAsync(Guid id, string? token, CancellationToken cancellationToken = default)
        => signatureService.GetSignedDocumentByTokenAsync(id, token, cancellationToken);

    public Task<byte[]?> GetRequestImageAsync(Guid id, string? token, Guid? userId, string imageType, int index, CancellationToken cancellationToken = default)
        => signatureService.GetRequestImageAsync(id, token, userId, imageType, index, cancellationToken);

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

    /// <summary>
    /// Notifica médicos disponíveis sobre nova solicitação na fila. Usa batching: pedidos em 2 min viram "X novas solicitações".
    /// </summary>
    private async Task NotifyAvailableDoctorsOfNewRequestAsync(
        string tipoSolicitacao,
        MedicalRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var doctors = await doctorRepository.GetAvailableAsync(null, cancellationToken);
            foreach (var doc in doctors.Take(3))
                newRequestBatchService.AddToBatch(doc.UserId, tipoSolicitacao);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falha ao notificar médicos sobre nova solicitação {RequestId}", request.Id);
        }
    }

    // ── FIX 13: Helper centralizado para evitar duplicação da lógica de validação IA ──

    /// <summary>
    /// Resultado da validação de análise de IA.
    /// Action: "reject" (rejeitar com mensagem), "doubts" (encaminhar com dúvidas), "success" (análise OK).
    /// </summary>
    private record AiValidationOutcome(string Action, string? RejectionMessage = null);

    /// <summary>
    /// Valida o resultado da análise de receita pela IA. Retorna a ação a ser tomada.
    /// Centraliza a lógica duplicada em RunPrescriptionAiAndUpdateAsync, ReanalyzePrescriptionAsync e ReanalyzeAsDoctorAsync.
    /// </summary>
    private AiValidationOutcome ValidatePrescriptionAiResult(
        AiPrescriptionAnalysisResult result,
        MedicalRequest request)
    {
        if (!result.ReadabilityOk)
            return new("reject", result.MessageToUser ?? "A imagem não parece ser de uma receita médica. Envie apenas fotos do documento da receita.");

        if (result.HasDoubts == true)
            return new("doubts");

        if (result.SignsOfTampering == true)
            return new("reject", "O documento enviado apresenta sinais de adulteração, edição ou recorte para ocultar informações. Envie uma foto completa e original da receita, sem alterações.");

        if (result.PatientNameVisible == false)
            return new("reject", "O nome do paciente não está visível na receita (recortado, em branco ou ilegível). Envie uma foto completa do documento onde o nome do paciente esteja claramente legível.");

        if (result.PrescriptionTypeVisible == false)
            return new("reject", "O tipo da receita (simples, controlada ou azul) não está visível no documento (recortado ou oculto). Envie uma foto completa onde o cabeçalho da receita esteja visível.");

        var userType = RequestHelpers.PrescriptionTypeToDisplay(request.PrescriptionType);
        if (!string.IsNullOrEmpty(result.ExtractedPrescriptionType) && !string.IsNullOrEmpty(userType) &&
            !string.Equals(result.ExtractedPrescriptionType, userType, StringComparison.OrdinalIgnoreCase))
        {
            var docLabel = RequestHelpers.PrescriptionTypeToRejectionLabel(result.ExtractedPrescriptionType);
            return new("reject", $"O documento enviado é uma receita {docLabel}, mas você selecionou receita {RequestHelpers.PrescriptionTypeToRejectionLabel(userType)}. O tipo da receita enviada deve corresponder ao tipo selecionado. Por favor, crie uma nova solicitação escolhendo o tipo correto.");
        }

        if (!string.IsNullOrEmpty(result.ExtractedPatientName) && !RequestHelpers.PatientNamesMatch(request.PatientName, result.ExtractedPatientName))
            return new("reject", $"O nome do paciente na receita ({result.ExtractedPatientName}) não corresponde ao nome cadastrado no app ({request.PatientName ?? "cadastro"}). A receita deve ser do próprio titular da conta. Verifique se o nome no seu cadastro está correto ou envie uma receita em seu nome.");

        return new("success");
    }

    /// <summary>
    /// Valida o resultado da análise de exame pela IA. Retorna a ação a ser tomada.
    /// </summary>
    private AiValidationOutcome ValidateExamAiResult(
        AiExamAnalysisResult result,
        MedicalRequest request,
        bool hasImages)
    {
        if (hasImages && !result.ReadabilityOk)
            return new("reject", result.MessageToUser ?? "A imagem não parece ser de pedido de exame ou documento médico. Envie apenas imagens do documento.");

        if (hasImages && result.HasDoubts == true)
            return new("doubts");

        if (hasImages && result.SignsOfTampering == true)
            return new("reject", "O documento enviado apresenta sinais de adulteração, edição ou recorte para ocultar informações. Envie uma foto completa e original do pedido de exame, sem alterações.");

        if (hasImages && result.PatientNameVisible == false)
            return new("reject", "O nome do paciente não está visível no documento (recortado, em branco ou ilegível). Envie uma foto completa onde o nome do paciente esteja claramente legível.");

        if (hasImages && !string.IsNullOrEmpty(result.ExtractedPatientName) && !RequestHelpers.PatientNamesMatch(request.PatientName, result.ExtractedPatientName))
            return new("reject", $"O nome do paciente no documento ({result.ExtractedPatientName}) não corresponde ao nome cadastrado no app ({request.PatientName ?? "cadastro"}). O pedido deve ser do próprio titular da conta.");

        return new("success");
    }

    private async Task RunPrescriptionAiAndUpdateAsync(MedicalRequest medicalRequest, CancellationToken cancellationToken)
    {
        if (medicalRequest.PrescriptionImages == null || medicalRequest.PrescriptionImages.Count == 0)
        {
            logger.LogDebug("IA receita: request {RequestId} sem imagens, pulando análise", medicalRequest.Id);
            return;
        }
        logger.LogDebug("IA receita: iniciando análise para request {RequestId} com {ImageCount} imagem(ns). URLs: {Urls}",
            medicalRequest.Id, medicalRequest.PrescriptionImages.Count, string.Join("; ", medicalRequest.PrescriptionImages.Take(3)));
        try
        {
            var result = await aiReadingService.AnalyzePrescriptionAsync(medicalRequest.PrescriptionImages, cancellationToken);
            // FIX 13: usar helper centralizado em vez de lógica duplicada
            var outcome = ValidatePrescriptionAiResult(result, medicalRequest);
            switch (outcome.Action)
            {
                case "reject":
                    medicalRequest.Reject(outcome.RejectionMessage!);
                    await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                    logger.LogDebug("IA receita: request {RequestId} REJEITADO. Motivo: {Msg}", medicalRequest.Id, outcome.RejectionMessage);
                    return;
                case "doubts":
                    medicalRequest.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, true, null);
                    await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                    logger.LogDebug("IA receita: request {RequestId} encaminhado ao médico com dúvidas", medicalRequest.Id);
                    return;
                default: // success
                    medicalRequest.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, true, null);
                    await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                    logger.LogDebug("IA receita: análise concluída para request {RequestId}. SummaryLength={Len}", medicalRequest.Id, result.SummaryForDoctor?.Length ?? 0);
                    break;
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "IA receita: análise falhou para request {RequestId}. Mensagem: {Message}. Inner: {Inner}",
                medicalRequest.Id, ex.Message, ex.InnerException?.Message ?? "-");
            medicalRequest.SetAiAnalysis("[Análise por IA indisponível no momento. O médico pode clicar em Reanalisar com IA.]", null, null, null, null, null);
            try
            {
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
            }
            catch (Exception updateEx)
            {
                logger.LogError(updateEx, "IA receita: falha ao persistir fallback para request {RequestId}", medicalRequest.Id);
            }
        }
    }

    private async Task RunExamAiAndUpdateAsync(MedicalRequest medicalRequest, CancellationToken cancellationToken)
    {
        var parts = new List<string>();
        if (!string.IsNullOrEmpty(medicalRequest.ExamType)) parts.Add($"Tipo: {medicalRequest.ExamType}");
        if (medicalRequest.Exams?.Count > 0) parts.Add("Exames: " + string.Join(", ", medicalRequest.Exams));
        if (!string.IsNullOrEmpty(medicalRequest.Symptoms)) parts.Add(medicalRequest.Symptoms);
        var textDescription = parts.Count > 0 ? string.Join("\n", parts) : null;
        var imageUrls = medicalRequest.ExamImages?.Count > 0 ? medicalRequest.ExamImages : null;
        if (string.IsNullOrWhiteSpace(textDescription) && (imageUrls == null || imageUrls.Count == 0))
        {
            logger.LogDebug("IA exame: request {RequestId} sem texto nem imagens, pulando análise", medicalRequest.Id);
            return;
        }
        logger.LogDebug("IA exame: iniciando análise para request {RequestId}. Imagens={ImageCount}, TextoLen={TextLen}",
            medicalRequest.Id, imageUrls?.Count ?? 0, textDescription?.Length ?? 0);
        try
        {
            var result = await aiReadingService.AnalyzeExamAsync(imageUrls, textDescription, cancellationToken);
            var hasImages = imageUrls != null && imageUrls.Count > 0;
            // FIX 13: usar helper centralizado em vez de lógica duplicada
            var outcome = ValidateExamAiResult(result, medicalRequest, hasImages);
            switch (outcome.Action)
            {
                case "reject":
                    medicalRequest.Reject(outcome.RejectionMessage!);
                    await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                    logger.LogDebug("IA exame: request {RequestId} REJEITADO. Motivo: {Msg}", medicalRequest.Id, outcome.RejectionMessage);
                    return;
                case "doubts":
                    medicalRequest.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, true, null);
                    await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                    logger.LogDebug("IA exame: request {RequestId} encaminhado ao médico com dúvidas", medicalRequest.Id);
                    return;
                default: // success
                    medicalRequest.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, result.ReadabilityOk, result.MessageToUser);
                    await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                    logger.LogDebug("IA exame: análise concluída para request {RequestId}. SummaryLength={Len}", medicalRequest.Id, result.SummaryForDoctor?.Length ?? 0);
                    break;
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "IA exame: análise falhou para request {RequestId}. Mensagem: {Message}. Inner: {Inner}",
                medicalRequest.Id, ex.Message, ex.InnerException?.Message ?? "-");
            medicalRequest.SetAiAnalysis("[Análise por IA indisponível no momento. O médico pode clicar em Reanalisar com IA.]", null, null, null, null, null);
            try
            {
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
            }
            catch (Exception updateEx)
            {
                logger.LogError(updateEx, "IA exame: falha ao persistir fallback para request {RequestId}", medicalRequest.Id);
            }
        }
    }


    private async Task GenerateAndSetConductSuggestionAsync(Guid requestId, CancellationToken cancellationToken)
    {
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null) return;

        var patientUser = await userRepository.GetByIdAsync(request.PatientId, cancellationToken);

        var input = new AiConductSuggestionInput(
            RequestType: request.RequestType.ToString(),
            PrescriptionType: request.PrescriptionType?.ToString(),
            ExamType: request.ExamType,
            PatientName: request.PatientName,
            PatientBirthDate: patientUser?.BirthDate,
            PatientGender: patientUser?.Gender,
            Symptoms: request.Symptoms,
            Medications: request.Medications?.Count > 0 ? request.Medications : null,
            Exams: request.Exams?.Count > 0 ? request.Exams : null,
            AiSummaryForDoctor: request.AiSummaryForDoctor,
            AiExtractedJson: request.AiExtractedJson,
            DoctorNotes: request.Notes);

        var result = await aiConductSuggestionService.GenerateAsync(input, cancellationToken);
        if (result == null) return;

        var examsJson = result.SuggestedExams?.Count > 0
            ? JsonSerializer.Serialize(result.SuggestedExams)
            : null;

        request.SetAiConductSuggestion(result.ConductSuggestion, examsJson);
        await requestRepository.UpdateAsync(request, cancellationToken);

        logger.LogDebug("AI conduct suggestion generated for request {RequestId}", requestId);
    }

    public async Task<RequestResponseDto> UpdateConductAsync(
        Guid requestId,
        UpdateConductDto dto,
        Guid doctorId,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken)
            ?? throw new InvalidOperationException($"Request {requestId} not found.");

        if (request.DoctorId.HasValue && request.DoctorId.Value != doctorId)
            throw new UnauthorizedAccessException("Somente o médico responsável pode atualizar a conduta.");

        var oldValues = new Dictionary<string, object?>
        {
            ["doctor_conduct_notes"] = request.DoctorConductNotes,
            ["include_conduct_in_pdf"] = request.IncludeConductInPdf,
            ["auto_observation"] = request.AutoObservation,
            ["conduct_updated_at"] = request.ConductUpdatedAt,
            ["conduct_updated_by"] = request.ConductUpdatedBy
        };

        request.UpdateConduct(dto.ConductNotes, dto.IncludeConductInPdf, doctorId);

        if (dto.ApplyObservationOverride)
            request.OverrideAutoObservation(dto.AutoObservationOverride, doctorId);

        await requestRepository.UpdateAsync(request, cancellationToken);

        var newValues = new Dictionary<string, object?>
        {
            ["doctor_conduct_notes"] = request.DoctorConductNotes,
            ["include_conduct_in_pdf"] = request.IncludeConductInPdf,
            ["auto_observation"] = request.AutoObservation,
            ["conduct_updated_at"] = request.ConductUpdatedAt,
            ["conduct_updated_by"] = request.ConductUpdatedBy
        };

        await auditService.LogModificationAsync(
            doctorId,
            action: "Update",
            entityType: "Request",
            entityId: requestId,
            oldValues: oldValues,
            newValues: newValues,
            cancellationToken: cancellationToken);

        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }


    /// <summary>
    /// Valida se o paciente já tem um pedido de receita ativo ou dentro do período mínimo
    /// entre renovações conforme tipo da receita. Lança DuplicateRequestException se bloqueado.
    ///
    /// Regras:
    ///   Simples     → bloqueia se existe pedido ativo (não rejeitado/cancelado)
    ///   Controlada  → bloqueia se solicitou nos últimos 30 dias (CFM Res. 2.314/2022)
    ///   Azul        → bloqueia se solicitou nos últimos 60 dias (Portaria 344/98 ANVISA)
    /// </summary>
    private async Task EnforcePrescriptionCooldownAsync(
        Guid patientUserId,
        PrescriptionKind? kind,
        PrescriptionType? prescriptionType,
        IReadOnlyList<string>? medications,
        CancellationToken cancellationToken)
    {
        // PERF FIX: buscar apenas receitas ativas do paciente (não todos os requests)
        var prescriptions = await requestRepository.GetActiveByPatientAndTypeAsync(patientUserId, RequestType.Prescription, cancellationToken)
            ?? new List<MedicalRequest>();

        var activeStatuses = new[]
        {
            RequestStatus.Submitted,
            RequestStatus.InReview,
            RequestStatus.ApprovedPendingPayment,
            RequestStatus.Paid,
            RequestStatus.Signed,
        };

        // Normaliza medicamentos para comparação case-insensitive
        var medsNormalized = (medications ?? Array.Empty<string>())
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Select(m => m.Trim().ToLowerInvariant())
            .ToList();

        // Filtragem por tipo e status já feita na query SQL (GetActiveByPatientAndTypeAsync)
        // prescriptions já contém apenas receitas ativas (não rejected/cancelled)

        // ── Receita Simples: bloqueia se já tem pedido ativo ──────────────────
        if (kind == null || kind == PrescriptionKind.Simple)
        {
            var hasActive = prescriptions.Any(r =>
                activeStatuses.Contains(r.Status) &&
                (r.PrescriptionKind == null || r.PrescriptionKind == PrescriptionKind.Simple));

            if (hasActive)
                throw new DuplicateRequestException(
                    "Você já tem uma solicitação de receita simples em andamento. " +
                    "Aguarde a conclusão antes de enviar uma nova.",
                    code: "active_request");
        }

        // ── Receita Controlada: mínimo 30 dias entre renovações ───────────────
        if (kind == PrescriptionKind.ControlledSpecial)
        {
            var cutoff = DateTime.UtcNow.AddDays(-30);
            var recent = prescriptions
                .Where(r =>
                    r.PrescriptionKind == PrescriptionKind.ControlledSpecial &&
                    r.CreatedAt >= cutoff)
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefault();

            if (recent != null)
            {
                var daysSince = (int)(DateTime.UtcNow - recent.CreatedAt).TotalDays;
                var daysRemaining = 30 - daysSince;
                throw new DuplicateRequestException(
                    $"Receitas controladas só podem ser renovadas a cada 30 dias. " +
                    $"Sua última solicitação foi há {daysSince} dia{(daysSince == 1 ? "" : "s")}. " +
                    $"Aguarde mais {daysRemaining} dia{(daysRemaining == 1 ? "" : "s")}.",
                    code: "cooldown_prescription",
                    cooldownDays: daysRemaining);
            }
        }

        // ── Receita Azul (psicotrópico): mínimo 60 dias ───────────────────────
        // Nota: PrescriptionType.Blue está desabilitado no controller por enquanto,
        // mas a regra já fica implementada para quando for liberado.
        // BUG FIX: verificar apenas quando o prescriptionType é Blue (antes rodava para qualquer receita com medicamentos)
        if (prescriptionType == PrescriptionType.Blue && medsNormalized.Count > 0)
        {
            var cutoffBlue = DateTime.UtcNow.AddDays(-60);
            var recentBlue = prescriptions
                .Where(r =>
                    r.PrescriptionType == PrescriptionType.Blue &&
                    r.CreatedAt >= cutoffBlue)
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefault();

            if (recentBlue != null)
            {
                var daysSince = (int)(DateTime.UtcNow - recentBlue.CreatedAt).TotalDays;
                var daysRemaining = 60 - daysSince;
                throw new DuplicateRequestException(
                    $"Receitas azuis (psicotrópicos) só podem ser renovadas a cada 60 dias. " +
                    $"Sua última solicitação foi há {daysSince} dia{(daysSince == 1 ? "" : "s")}. " +
                    $"Aguarde mais {daysRemaining} dia{(daysRemaining == 1 ? "" : "s")}.",
                    code: "cooldown_prescription",
                    cooldownDays: daysRemaining);
            }
        }
    }

    /// <summary>
    /// Valida se o paciente já tem um pedido de exame ativo com ao menos um exame em comum.
    /// Lança DuplicateRequestException se bloqueado.
    /// </summary>
    private async Task EnforceExamCooldownAsync(
        Guid patientUserId,
        IReadOnlyList<string>? exams,
        CancellationToken cancellationToken)
    {
        if (exams == null || exams.Count == 0) return;

        // PERF FIX: buscar apenas exames ativos do paciente (não todos os requests)
        var activeExams = await requestRepository.GetActiveByPatientAndTypeAsync(patientUserId, RequestType.Exam, cancellationToken)
            ?? new List<MedicalRequest>();

        var examsNormalized = exams
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Select(e => e.Trim().ToLowerInvariant())
            .ToList();

        if (examsNormalized.Count == 0) return;

        var activeStatuses = new[]
        {
            RequestStatus.Submitted,
            RequestStatus.InReview,
            RequestStatus.ApprovedPendingPayment,
            RequestStatus.Paid,
            RequestStatus.Signed,
        };

        // BUG FIX: usar comparação exata (Equals) em vez de Contains para evitar
        // falsos positivos (ex: "Hemograma" bloqueando "Hemograma Completo" que são exames distintos)
        var conflictingRequest = activeExams.FirstOrDefault(r =>
            r.RequestType == RequestType.Exam &&
            activeStatuses.Contains(r.Status) &&
            r.Exams != null &&
            r.Exams.Any(e => examsNormalized.Any(n =>
                !string.IsNullOrWhiteSpace(e) &&
                string.Equals(e.Trim().ToLowerInvariant(), n, StringComparison.Ordinal))));

        if (conflictingRequest != null)
        {
            // Encontra os exames em conflito para mensagem mais clara
            var conflicting = conflictingRequest.Exams?
                .Where(e => examsNormalized.Any(n =>
                    !string.IsNullOrWhiteSpace(e) &&
                    string.Equals(e.Trim().ToLowerInvariant(), n, StringComparison.Ordinal)))
                .Take(2)
                .ToList() ?? new List<string>();

            var examsDesc = conflicting.Count > 0
                ? string.Join(", ", conflicting)
                : "os mesmos exames";

            throw new DuplicateRequestException(
                $"Você já tem um pedido de exame em andamento para: {examsDesc}. " +
                "Aguarde a conclusão antes de solicitar novamente.",
                code: "cooldown_exam");
        }
    }

    private async Task<string?> BuildControlledDuplicateWarningAsync(
        Guid patientUserId,
        PrescriptionKind? kind,
        IReadOnlyList<string> medications,
        CancellationToken cancellationToken)
    {
        if (kind != PrescriptionKind.ControlledSpecial || medications == null || medications.Count == 0)
            return null;

        // PERF FIX: buscar apenas receitas ativas do paciente (não todos os requests)
        var activePrescriptions = await requestRepository.GetActiveByPatientAndTypeAsync(patientUserId, RequestType.Prescription, cancellationToken)
            ?? new List<MedicalRequest>();
        var fromDate = DateTime.UtcNow.AddDays(-30);
        var medsNormalized = medications
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Select(m => m.Trim().ToLowerInvariant())
            .ToList();

        var hasPotentialDuplicate = activePrescriptions.Any(r =>
            r.RequestType == RequestType.Prescription &&
            r.PrescriptionKind == PrescriptionKind.ControlledSpecial &&
            r.CreatedAt >= fromDate &&
            r.Status != RequestStatus.Rejected &&
            r.Status != RequestStatus.Cancelled &&
            (r.Medications?.Any(m => medsNormalized.Any(n => m != null && m.ToLowerInvariant().Contains(n))) ?? false));

        if (!hasPotentialDuplicate)
            return null;

        return "⚠️ Atenção: paciente com potencial prescrição controlada similar nos últimos 30 dias. Revisar histórico antes de assinar.";
    }


    public Task<RequestResponseDto> AutoFinishConsultationAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
        => consultationLifecycleService.AutoFinishConsultationAsync(id, userId, cancellationToken);

    public Task<(int BalanceSeconds, int BalanceMinutes, string ConsultationType)> GetTimeBankBalanceAsync(
        Guid userId, string consultationType, CancellationToken cancellationToken = default)
        => consultationLifecycleService.GetTimeBankBalanceAsync(userId, consultationType, cancellationToken);

}
