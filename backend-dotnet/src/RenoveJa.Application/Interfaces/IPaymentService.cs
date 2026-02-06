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
        CancellationToken cancellationToken = default);

    Task<PaymentResponseDto> ConfirmPaymentAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task ProcessWebhookAsync(
        MercadoPagoWebhookDto webhook,
        CancellationToken cancellationToken = default);
}
