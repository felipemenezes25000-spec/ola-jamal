using RenoveJa.Application.DTOs;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.DTOs.Video;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de solicitações médicas: receita, exame, consulta, aprovação, rejeição, assinatura e vídeo.
/// </summary>
public interface IRequestService
{
    /// <summary>Cria solicitação de receita (foto + medicamentos). Status Submitted; pagamento é criado quando o médico aprovar.</summary>
    Task<(RequestResponseDto Request, PaymentResponseDto? Payment)> CreatePrescriptionAsync(
        CreatePrescriptionRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>Cria solicitação de exame. Status Submitted; pagamento criado na aprovação.</summary>
    Task<(RequestResponseDto Request, PaymentResponseDto? Payment)> CreateExamAsync(
        CreateExamRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>Cria solicitação de consulta. Status SearchingDoctor.</summary>
    Task<(RequestResponseDto Request, PaymentResponseDto? Payment)> CreateConsultationAsync(
        CreateConsultationRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<List<RequestResponseDto>> GetUserRequestsAsync(
        Guid userId,
        string? status = null,
        string? type = null,
        CancellationToken cancellationToken = default);

    Task<PagedResponse<RequestResponseDto>> GetUserRequestsPagedAsync(
        Guid userId,
        string? status = null,
        string? type = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default);

    Task<RequestResponseDto> GetRequestByIdAsync(
        Guid id,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<RequestResponseDto> UpdateStatusAsync(
        Guid id,
        UpdateRequestStatusDto dto,
        CancellationToken cancellationToken = default);

    /// <summary>Aprova a solicitação e define o valor (da tabela product_prices). Pagamento é criado pelo paciente ao chamar POST /api/payments.</summary>
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

    /// <summary>Reanalisa receita com novas imagens (ex.: mais legíveis). Somente paciente.</summary>
    Task<RequestResponseDto> ReanalyzePrescriptionAsync(Guid id, ReanalyzePrescriptionDto dto, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Reanalisa pedido de exame com novas imagens e/ou texto. Somente paciente.</summary>
    Task<RequestResponseDto> ReanalyzeExamAsync(Guid id, ReanalyzeExamDto dto, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Médico reexecuta a análise de IA com as imagens já existentes da receita/exame.</summary>
    Task<RequestResponseDto> ReanalyzeAsDoctorAsync(Guid id, Guid doctorId, CancellationToken cancellationToken = default);
}
