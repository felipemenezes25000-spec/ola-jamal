using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.DTOs.Video;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de solicitações médicas: receita, exame, consulta, aprovação, rejeição, assinatura e vídeo.
/// </summary>
public interface IRequestService
{
    Task<(RequestResponseDto Request, PaymentResponseDto Payment)> CreatePrescriptionAsync(
        CreatePrescriptionRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<(RequestResponseDto Request, PaymentResponseDto Payment)> CreateExamAsync(
        CreateExamRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<(RequestResponseDto Request, PaymentResponseDto Payment)> CreateConsultationAsync(
        CreateConsultationRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<List<RequestResponseDto>> GetUserRequestsAsync(
        Guid userId,
        string? status = null,
        string? type = null,
        CancellationToken cancellationToken = default);

    Task<RequestResponseDto> GetRequestByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<RequestResponseDto> UpdateStatusAsync(
        Guid id,
        UpdateRequestStatusDto dto,
        CancellationToken cancellationToken = default);

    Task<RequestResponseDto> ApproveAsync(
        Guid id,
        ApproveRequestDto dto,
        Guid doctorId,
        CancellationToken cancellationToken = default);

    Task<RequestResponseDto> RejectAsync(
        Guid id,
        RejectRequestDto dto,
        CancellationToken cancellationToken = default);

    Task<RequestResponseDto> AssignToQueueAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<(RequestResponseDto Request, VideoRoomResponseDto VideoRoom)> AcceptConsultationAsync(
        Guid id,
        Guid doctorId,
        CancellationToken cancellationToken = default);

    Task<RequestResponseDto> SignAsync(
        Guid id,
        SignRequestDto dto,
        CancellationToken cancellationToken = default);
}
