using RenoveJa.Application.DTOs.CarePlans;

namespace RenoveJa.Application.Interfaces;

public interface ICarePlanService
{
    Task<AiSuggestionResponseDto> CreateAiSuggestionAsync(
        Guid consultationId,
        CreateAiSuggestionRequestDto request,
        CancellationToken cancellationToken = default);

    Task<List<AiSuggestionResponseDto>> GetAiSuggestionsAsync(
        Guid consultationId,
        IReadOnlyCollection<string>? statuses,
        Guid requesterUserId,
        CancellationToken cancellationToken = default);

    Task<CarePlanResponseDto> CreateCarePlanFromSuggestionAsync(
        Guid consultationId,
        Guid doctorId,
        CreateCarePlanFromSuggestionRequestDto request,
        CancellationToken cancellationToken = default);

    Task<CarePlanResponseDto?> GetCarePlanByConsultationIdAsync(
        Guid consultationId,
        Guid requesterUserId,
        CancellationToken cancellationToken = default);

    Task<CarePlanResponseDto> GetCarePlanByIdAsync(
        Guid carePlanId,
        Guid requesterUserId,
        CancellationToken cancellationToken = default);

    Task<CarePlanResponseDto> ExecuteTaskActionAsync(
        Guid carePlanId,
        Guid taskId,
        Guid requesterUserId,
        string role,
        CarePlanTaskActionRequestDto request,
        CancellationToken cancellationToken = default);

    Task<CarePlanTaskFileResponseDto> UploadTaskFileAsync(
        Guid carePlanId,
        Guid taskId,
        Guid requesterUserId,
        string fileName,
        string contentType,
        byte[] fileBytes,
        CancellationToken cancellationToken = default);

    Task<CarePlanResponseDto> ReviewAndOptionallyCloseAsync(
        Guid carePlanId,
        Guid doctorId,
        ReviewCarePlanRequestDto request,
        CancellationToken cancellationToken = default);
}
