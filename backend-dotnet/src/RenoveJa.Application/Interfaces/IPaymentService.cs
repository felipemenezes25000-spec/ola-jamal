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
    /// Indica se o pagamento com o external ID do MP já foi processado (não pendente).
    /// Usado para retornar 200 idempotente quando webhooks legados falham no HMAC.
    /// </summary>
    Task<bool> IsPaymentProcessedByExternalIdAsync(string externalId, CancellationToken cancellationToken = default);

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

    /// <summary>
    /// Lista cartões salvos do usuário.
    /// </summary>
    Task<IReadOnlyList<SavedCardDto>> GetSavedCardsAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Paga com cartão salvo (requer CVV).
    /// </summary>
    /// <summary>
    /// Adiciona um cartão ao customer do MP e persiste em saved_cards.
    /// O token vem do Brick (modo somente cartão, sem pagamento).
    /// </summary>
    Task AddCardAsync(Guid userId, string token, CancellationToken cancellationToken = default);

    Task<PaymentResponseDto> PayWithSavedCardAsync(
        PayWithSavedCardRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default);
}
