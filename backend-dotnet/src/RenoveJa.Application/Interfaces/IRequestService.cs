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

    /// <summary>Médico inicia a consulta (status Paid → InConsultation).</summary>
    Task<RequestResponseDto> StartConsultationAsync(Guid id, Guid doctorId, CancellationToken cancellationToken = default);

    /// <summary>Médico encerra a consulta, persiste notas, deleta sala Daily e notifica paciente.</summary>
    Task<RequestResponseDto> FinishConsultationAsync(Guid id, Guid doctorId, FinishConsultationDto? dto, CancellationToken cancellationToken = default);

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

    /// <summary>Médico atualiza medicamentos e/ou notas da receita antes da assinatura.</summary>
    Task<RequestResponseDto> UpdatePrescriptionContentAsync(Guid id, List<string>? medications, string? notes, Guid doctorId, CancellationToken cancellationToken = default);

    /// <summary>Médico atualiza exames e/ou notas do pedido antes da assinatura.</summary>
    Task<RequestResponseDto> UpdateExamContentAsync(Guid id, List<string>? exams, string? notes, Guid doctorId, CancellationToken cancellationToken = default);

    /// <summary>Gera preview do PDF da receita (base64) para o médico visualizar antes de assinar.</summary>
    Task<byte[]?> GetPrescriptionPdfPreviewAsync(Guid id, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Paciente marca o documento como entregue (Signed → Delivered) ao baixar/abrir o PDF.</summary>
    Task<RequestResponseDto> MarkDeliveredAsync(Guid id, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Paciente cancela o pedido (apenas antes do pagamento).</summary>
    Task<RequestResponseDto> CancelAsync(Guid id, Guid userId, CancellationToken cancellationToken = default);
}
