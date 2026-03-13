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
    IProductPriceRepository productPriceRepository,
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

        var (productType, subtype) = GetProductTypeAndSubtype(request);
        var priceFromDb = await productPriceRepository.GetPriceAsync(productType, subtype, cancellationToken);
        if (!priceFromDb.HasValue || priceFromDb.Value <= 0)
            throw new InvalidOperationException(
                $"Preço não encontrado para {productType}/{subtype}. Verifique a tabela product_prices.");

        var price = priceFromDb.Value;
        request.Approve(price, dto.Notes, dto.Medications, dto.Exams);
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        _ = Task.Run(async () =>
        {
            try { await GenerateAndSetConductSuggestionAsync(request.Id, cancellationToken); }
            catch (Exception ex) { logger.LogWarning(ex, "AI conduct suggestion failed for {RequestId}", request.Id); }
        }, cancellationToken);

        await requestEventsPublisher.NotifyRequestUpdatedAsync(
            request.Id,
            request.PatientId,
            request.DoctorId,
            EnumHelper.ToSnakeCase(request.Status),
            "Solicitação aprovada",
            cancellationToken);
        await pushDispatcher.SendAsync(PushNotificationRules.ApprovedPendingPayment(request.PatientId, request.Id, request.RequestType), cancellationToken);

        return request;
    }

    public async Task<MedicalRequest> RejectAsync(
        Guid id,
        RejectRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        request.Reject(dto.RejectionReason);
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        await pushDispatcher.SendAsync(PushNotificationRules.Rejected(request.PatientId, request.Id, request.RequestType, dto.RejectionReason), cancellationToken);

        return request;
    }

    private static (string productType, string subtype) GetProductTypeAndSubtype(MedicalRequest request)
    {
        var productType = request.RequestType.ToString().ToLowerInvariant();
        var subtype = "default";

        if (request.RequestType == RequestType.Prescription && request.PrescriptionType.HasValue)
            subtype = PrescriptionTypeToDisplay(request.PrescriptionType.Value) ?? "simples";

        return (productType, subtype);
    }

    private static string? PrescriptionTypeToDisplay(PrescriptionType type) => type switch
    {
        PrescriptionType.Simple => "simples",
        PrescriptionType.Controlled => "controlado",
        PrescriptionType.Blue => "azul",
        _ => null
    };

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
