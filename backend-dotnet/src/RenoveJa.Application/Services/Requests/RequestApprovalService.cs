using Microsoft.Extensions.Logging;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Helpers;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Requests;

/// <summary>
/// Implementação do serviço de aprovação e rejeição de solicitações.
/// </summary>
public class RequestApprovalService(
    IRequestRepository requestRepository,
    IUserRepository userRepository,
    IPushNotificationDispatcher pushDispatcher,
    IRequestEventsPublisher requestEventsPublisher,
    IAiConductSuggestionService aiConductSuggestionService,
    ILogger<RequestApprovalService> logger) : IRequestApprovalService
{
    public async Task<MedicalRequest> ApproveAsync(
        Guid id,
        ApproveRequestDto dto,
        Guid doctorId,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        var doctor = await userRepository.GetByIdAsync(doctorId, cancellationToken);
        if (doctor == null || !doctor.IsDoctor())
            throw new InvalidOperationException("Doctor not found");

        if (request.DoctorId == null)
            request.AssignDoctor(doctorId, doctor.Name);
        // FIX B31: IDOR guard — prevent a doctor from approving a request assigned to another doctor
        else if (request.DoctorId.Value != doctorId)
            throw new UnauthorizedAccessException("Este pedido está atribuído a outro médico.");

        // Sem fluxo de pagamento: aprovação vai direto para Paid (price = 0)
        request.Approve(0, dto.Notes, dto.Medications, dto.Exams);
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        // BUG FIX: usar CancellationToken.None para evitar cancelamento da task quando
        // o HTTP request termina (ASP.NET cancela o token original ao enviar a response).
        // Capturar requestId antes do closure para evitar problemas de ciclo de vida.
        var requestIdForBackground = request.Id;
        // Fire-and-forget sem Task.Run — evita thread pool starvation em ASP.NET Core
        _ = GenerateAndSetConductSuggestionAsync(requestIdForBackground, CancellationToken.None)
            .ContinueWith(t =>
            {
                if (t.IsFaulted)
                    logger.LogWarning(t.Exception?.InnerException, "AI conduct suggestion failed for {RequestId}", requestIdForBackground);
            }, TaskScheduler.Default);

        await requestEventsPublisher.NotifyRequestUpdatedAsync(
            request.Id,
            request.PatientId,
            request.DoctorId,
            EnumHelper.ToSnakeCase(request.Status),
            "Solicitação aprovada",
            cancellationToken);
        // Push de "Documento pronto" será enviado pelo SignatureService após a assinatura

        return request;
    }

    public async Task<MedicalRequest> RejectAsync(
        Guid id,
        RejectRequestDto dto,
        Guid doctorId,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        // BUG FIX: validar que o médico autenticado é o médico atribuído (ou não há médico atribuído)
        if (request.DoctorId.HasValue && request.DoctorId.Value != doctorId)
            throw new UnauthorizedAccessException("Somente o médico atribuído pode rejeitar esta solicitação.");

        request.Reject(dto.RejectionReason);
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        await pushDispatcher.SendAsync(PushNotificationRules.Rejected(request.PatientId, request.Id, request.RequestType, dto.RejectionReason), cancellationToken);

        return request;
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
            ? System.Text.Json.JsonSerializer.Serialize(result.SuggestedExams)
            : null;

        request.SetAiConductSuggestion(result.ConductSuggestion, examsJson);
        await requestRepository.UpdateAsync(request, cancellationToken);

        logger.LogInformation("AI conduct suggestion generated for request {RequestId}", requestId);
    }
}
