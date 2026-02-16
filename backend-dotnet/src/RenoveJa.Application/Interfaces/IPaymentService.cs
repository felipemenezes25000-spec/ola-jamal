using RenoveJa.Application.DTOs.Payments;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de pagamentos: criação, confirmação e webhook.
/// </summary>
public interface IPaymentService
{
    Task<PaymentResponseDto> CreatePaymentAsync(
        CreatePaymentRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<PaymentResponseDto> GetPaymentAsync(
        Guid id,
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtém o pagamento pendente de uma solicitação. Permite ao paciente obter o PIX para pagar.
    /// </summary>
    Task<PaymentResponseDto?> GetPaymentByRequestIdAsync(
        Guid requestId,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<PaymentResponseDto> ConfirmPaymentAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Confirma o pagamento pendente de uma solicitação (por requestId). Para testes.
    /// </summary>
    Task<PaymentResponseDto> ConfirmPaymentByRequestIdAsync(
        Guid requestId,
        CancellationToken cancellationToken = default);

    Task ProcessWebhookAsync(
        MercadoPagoWebhookDto? webhook,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtém URL do Checkout Pro para pagamento com cartão (e opcionalmente PIX na página do MP).
    /// Cria um pagamento checkout_pro e retorna init_point + paymentId.
    /// </summary>
    Task<CheckoutProResponseDto> GetCheckoutProUrlAsync(
        Guid requestId,
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sincroniza o status de um pagamento com a API do Mercado Pago. Útil quando o webhook falha.
    /// </summary>
    Task<PaymentResponseDto?> SyncPaymentStatusAsync(
        Guid requestId,
        CancellationToken cancellationToken = default);
}
