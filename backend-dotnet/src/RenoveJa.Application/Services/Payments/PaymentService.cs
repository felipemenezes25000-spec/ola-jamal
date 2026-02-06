using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Payments;

/// <summary>
/// Implementação do serviço de pagamentos (PIX, confirmação, webhook Mercado Pago).
/// </summary>
public class PaymentService(
    IPaymentRepository paymentRepository,
    IRequestRepository requestRepository,
    INotificationRepository notificationRepository) : IPaymentService
{
    /// <summary>
    /// Cria um pagamento para uma solicitação e retorna dados PIX.
    /// </summary>
    public async Task<PaymentResponseDto> CreatePaymentAsync(
        CreatePaymentRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var medicalRequest = await requestRepository.GetByIdAsync(request.RequestId, cancellationToken);
        if (medicalRequest == null)
            throw new KeyNotFoundException("Request not found");

        if (medicalRequest.PatientId != userId)
            throw new UnauthorizedAccessException("You can only create payment for your own requests");

        var payment = Payment.CreatePixPayment(request.RequestId, userId, request.Amount);

        // In real implementation, call MercadoPago service here
        // For now, mock PIX data
        payment.SetPixData(
            externalId: Guid.NewGuid().ToString(),
            qrCode: "00020126580014br.gov.bcb.pix...",
            qrCodeBase64: "iVBORw0KGgoAAAANSUhEUgAA...",
            copyPaste: "00020126580014br.gov.bcb.pix...");

        payment = await paymentRepository.CreateAsync(payment, cancellationToken);

        await CreateNotificationAsync(
            userId,
            "Pagamento Criado",
            $"Pagamento de R$ {request.Amount:F2} criado. Aguardando confirmação.",
            cancellationToken);

        return MapToDto(payment);
    }

    /// <summary>
    /// Obtém um pagamento pelo ID.
    /// </summary>
    public async Task<PaymentResponseDto> GetPaymentAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var payment = await paymentRepository.GetByIdAsync(id, cancellationToken);
        if (payment == null)
            throw new KeyNotFoundException("Payment not found");

        return MapToDto(payment);
    }

    /// <summary>
    /// Confirma um pagamento e atualiza a solicitação para pago.
    /// </summary>
    public async Task<PaymentResponseDto> ConfirmPaymentAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var payment = await paymentRepository.GetByIdAsync(id, cancellationToken);
        if (payment == null)
            throw new KeyNotFoundException("Payment not found");

        payment.Approve();
        payment = await paymentRepository.UpdateAsync(payment, cancellationToken);

        // Update request status to paid
        var request = await requestRepository.GetByIdAsync(payment.RequestId, cancellationToken);
        if (request != null)
        {
            request.MarkAsPaid();
            await requestRepository.UpdateAsync(request, cancellationToken);

            await CreateNotificationAsync(
                payment.UserId,
                "Pagamento Confirmado",
                "Seu pagamento foi confirmado! Sua solicitação está sendo processada.",
                cancellationToken);
        }

        return MapToDto(payment);
    }

    /// <summary>
    /// Processa webhook do Mercado Pago (atualização de pagamento).
    /// </summary>
    public async Task ProcessWebhookAsync(
        MercadoPagoWebhookDto webhook,
        CancellationToken cancellationToken = default)
    {
        if (webhook.Action != "payment.updated" || webhook.Id == null)
            return;

        var payment = await paymentRepository.GetByExternalIdAsync(webhook.Id, cancellationToken);
        if (payment == null)
            return;

        // In real implementation, verify payment status with MercadoPago API
        // For now, auto-approve
        if (payment.IsPending())
        {
            payment.Approve();
            await paymentRepository.UpdateAsync(payment, cancellationToken);

            var request = await requestRepository.GetByIdAsync(payment.RequestId, cancellationToken);
            if (request != null)
            {
                request.MarkAsPaid();
                await requestRepository.UpdateAsync(request, cancellationToken);

                await CreateNotificationAsync(
                    payment.UserId,
                    "Pagamento Confirmado",
                    "Seu pagamento foi confirmado automaticamente!",
                    cancellationToken);
            }
        }
    }

    private async Task CreateNotificationAsync(
        Guid userId,
        string title,
        string message,
        CancellationToken cancellationToken)
    {
        var notification = Notification.Create(userId, title, message, NotificationType.Success);
        await notificationRepository.CreateAsync(notification, cancellationToken);
    }

    private static PaymentResponseDto MapToDto(Payment payment)
    {
        return new PaymentResponseDto(
            payment.Id,
            payment.RequestId,
            payment.UserId,
            payment.Amount.Amount,
            payment.Status.ToString().ToLowerInvariant(),
            payment.PaymentMethod,
            payment.ExternalId,
            payment.PixQrCode,
            payment.PixQrCodeBase64,
            payment.PixCopyPaste,
            payment.PaidAt,
            payment.CreatedAt,
            payment.UpdatedAt);
    }
}
