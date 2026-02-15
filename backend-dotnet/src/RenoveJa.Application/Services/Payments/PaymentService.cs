using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
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
    INotificationRepository notificationRepository,
    IPushNotificationSender pushNotificationSender,
    IMercadoPagoService mercadoPagoService,
    IUserRepository userRepository,
    IOptions<MercadoPagoConfig> mercadoPagoConfig,
    ILogger<PaymentService> logger) : IPaymentService
{
    /// <summary>
    /// Paciente inicia o pagamento para uma solicitação aprovada. Suporta PIX ou cartão (crédito/débito).
    /// O valor é obtido da solicitação (não é enviado pelo cliente, por segurança).
    /// </summary>
    public async Task<PaymentResponseDto> CreatePaymentAsync(
        CreatePaymentRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var medicalRequest = await requestRepository.GetByIdAsync(request.RequestId, cancellationToken);
        if (medicalRequest == null)
            throw new KeyNotFoundException("Solicitação não encontrada");

        if (medicalRequest.PatientId != userId)
            throw new UnauthorizedAccessException("Somente o paciente da solicitação pode criar o pagamento");

        if (medicalRequest.Status != RequestStatus.ApprovedPendingPayment)
            throw new InvalidOperationException("Solicitação deve estar aprovada e aguardando pagamento");

        if (medicalRequest.Price == null || medicalRequest.Price.Amount <= 0)
            throw new InvalidOperationException("Solicitação sem valor definido");

        var amount = medicalRequest.Price.Amount;
        var paymentMethod = string.IsNullOrWhiteSpace(request.PaymentMethod) ? "pix" : request.PaymentMethod.Trim().ToLowerInvariant();
        var isCard = paymentMethod is "credit_card" or "debit_card";

        if (isCard)
            return await CreateCardPaymentInternalAsync(request, userId, amount, medicalRequest.Id, cancellationToken);

        return await CreatePixPaymentInternalAsync(request.RequestId, userId, amount, medicalRequest.Id, cancellationToken);
    }

    private async Task<PaymentResponseDto> CreatePixPaymentInternalAsync(
        Guid requestId,
        Guid userId,
        decimal amount,
        Guid medicalRequestId,
        CancellationToken cancellationToken)
    {
        var existingPayment = await paymentRepository.GetByRequestIdAsync(requestId, cancellationToken);
        if (existingPayment != null && existingPayment.IsPending())
        {
            var copyPaste = existingPayment.PixCopyPaste ?? existingPayment.PixQrCode ?? "";
            if (copyPaste.Length >= 100)
                return MapToDto(existingPayment);
            await paymentRepository.DeleteAsync(existingPayment.Id, cancellationToken);
        }

        var patient = await userRepository.GetByIdAsync(userId, cancellationToken);
        var patientEmail = patient?.Email?.Value ?? "pagador@renoveja.com.br";

        var pixResult = await mercadoPagoService.CreatePixPaymentAsync(
            amount,
            $"RenoveJá - Solicitação {medicalRequestId:N}",
            patientEmail,
            medicalRequestId.ToString(),
            cancellationToken);

        var payment = Payment.CreatePixPayment(requestId, userId, amount);
        payment.SetPixData(
            pixResult.ExternalId,
            pixResult.QrCode,
            pixResult.QrCodeBase64,
            pixResult.CopyPaste);
        payment = await paymentRepository.CreateAsync(payment, cancellationToken);

        await CreateNotificationAsync(
            userId,
            "Pagamento Criado",
            $"Pagamento de R$ {amount:F2} criado. Use o QR Code ou copia e cola para pagar.",
            cancellationToken);

        return MapToDto(payment);
    }

    private async Task<PaymentResponseDto> CreateCardPaymentInternalAsync(
        CreatePaymentRequestDto request,
        Guid userId,
        decimal amount,
        Guid medicalRequestId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || string.IsNullOrWhiteSpace(request.PaymentMethodId))
            throw new InvalidOperationException("Token e PaymentMethodId são obrigatórios para pagamento com cartão.");

        var patient = await userRepository.GetByIdAsync(userId, cancellationToken);
        var patientEmail = patient?.Email?.Value ?? "pagador@renoveja.com.br";
        var payerCpf = patient?.Cpf;

        var paymentTypeId = request.PaymentMethod?.Trim().ToLowerInvariant();
        var cardResult = await mercadoPagoService.CreateCardPaymentAsync(
            amount,
            $"RenoveJá - Solicitação {medicalRequestId:N}",
            patientEmail,
            payerCpf,
            medicalRequestId.ToString(),
            request.Token,
            request.Installments ?? 1,
            request.PaymentMethodId.Trim(),
            request.IssuerId,
            paymentTypeId: paymentTypeId is "credit_card" or "debit_card" ? paymentTypeId : null,
            cancellationToken);

        var payment = Payment.CreateCardPayment(
            request.RequestId,
            userId,
            amount,
            request.PaymentMethod!.Trim().ToLowerInvariant());
        payment.SetExternalId(cardResult.ExternalId);

        var statusLower = cardResult.Status.Trim().ToLowerInvariant();
        if (statusLower == "approved")
        {
            payment.Approve();
            var medicalRequest = await requestRepository.GetByIdAsync(request.RequestId, cancellationToken);
            if (medicalRequest != null)
            {
                medicalRequest.MarkAsPaid();
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
            }
        }
        else if (statusLower is "rejected" or "cancelled")
        {
            payment.Reject();
        }

        payment = await paymentRepository.CreateAsync(payment, cancellationToken);

        var message = statusLower == "approved"
            ? "Pagamento aprovado."
            : statusLower is "rejected" or "cancelled"
                ? "Pagamento não aprovado. Tente outro cartão ou forma de pagamento."
                : "Pagamento em processamento. Você será notificado quando for confirmado.";

        await CreateNotificationAsync(
            userId,
            "Pagamento com cartão",
            $"R$ {amount:F2} - {message}",
            cancellationToken);

        return MapToDto(payment);
    }

    /// <summary>
    /// Obtém o pagamento pendente de uma solicitação. Somente o paciente da solicitação.
    /// </summary>
    public async Task<PaymentResponseDto?> GetPaymentByRequestIdAsync(
        Guid requestId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var medicalRequest = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (medicalRequest == null)
            throw new KeyNotFoundException("Request not found");

        if (medicalRequest.PatientId != userId)
            throw new UnauthorizedAccessException("Somente o paciente da solicitação pode acessar o pagamento");

        var payment = await paymentRepository.GetByRequestIdAsync(requestId, cancellationToken);
        if (payment == null || !payment.IsPending())
            return null;

        return MapToDto(payment);
    }

    /// <summary>
    /// Obtém um pagamento pelo ID.
    /// </summary>
    public async Task<PaymentResponseDto> GetPaymentAsync(
        Guid id,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var payment = await paymentRepository.GetByIdAsync(id, cancellationToken);
        if (payment == null)
            throw new KeyNotFoundException("Payment not found");

        if (payment.UserId != userId)
            throw new UnauthorizedAccessException("Somente o dono do pagamento pode acessá-lo");

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

            if (request.DoctorId.HasValue)
            {
                await CreateNotificationAsync(
                    request.DoctorId.Value,
                    "Pagamento Recebido",
                    $"O paciente pagou a solicitação de {request.PatientName ?? "paciente"}. Valor: R$ {payment.Amount.Amount:F2}.",
                    cancellationToken);
            }
        }

        return MapToDto(payment);
    }

    /// <summary>
    /// Confirma o pagamento pendente de uma solicitação (por requestId). Para testes.
    /// </summary>
    public async Task<PaymentResponseDto> ConfirmPaymentByRequestIdAsync(
        Guid requestId,
        CancellationToken cancellationToken = default)
    {
        var payment = await paymentRepository.GetByRequestIdAsync(requestId, cancellationToken);
        if (payment == null)
            throw new KeyNotFoundException("Nenhum pagamento encontrado para esta solicitação");
        if (!payment.IsPending())
            throw new InvalidOperationException($"Pagamento não está pendente (status: {payment.Status})");
        return await ConfirmPaymentAsync(payment.Id, cancellationToken);
    }

    /// <summary>
    /// Processa webhook do Mercado Pago com verificação real do pagamento via API e validação HMAC.
    /// </summary>
    public async Task ProcessWebhookAsync(
        MercadoPagoWebhookDto? webhook,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(webhook?.Action) || !webhook.Action.StartsWith("payment.", StringComparison.OrdinalIgnoreCase))
            return;

        var mpPaymentId = NormalizeWebhookId(webhook.Data != null && webhook.Data.TryGetValue("id", out var dataId) ? dataId : null)
            ?? NormalizeWebhookId(webhook.Id);
        if (string.IsNullOrEmpty(mpPaymentId))
            return;

        var payment = await paymentRepository.GetByExternalIdAsync(mpPaymentId, cancellationToken);
        if (payment == null)
            return;

        if (!payment.IsPending())
            return;

        // Verify payment status with MercadoPago API
        var realStatus = await mercadoPagoService.GetPaymentStatusAsync(mpPaymentId, cancellationToken);
        if (string.IsNullOrEmpty(realStatus))
        {
            logger.LogWarning("Webhook: não foi possível verificar status do pagamento {PaymentId} na API do MP", mpPaymentId);
            return;
        }

        logger.LogInformation("Webhook: pagamento {PaymentId} status real = {Status}", mpPaymentId, realStatus);

        if (realStatus.Equals("approved", StringComparison.OrdinalIgnoreCase))
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

                if (request.DoctorId.HasValue)
                {
                    await CreateNotificationAsync(
                        request.DoctorId.Value,
                        "Pagamento Recebido",
                        $"O paciente pagou a solicitação. Valor: R$ {payment.Amount.Amount:F2}.",
                        cancellationToken);
                }
            }
        }
        else if (realStatus.Equals("rejected", StringComparison.OrdinalIgnoreCase) ||
                 realStatus.Equals("cancelled", StringComparison.OrdinalIgnoreCase))
        {
            payment.Reject();
            await paymentRepository.UpdateAsync(payment, cancellationToken);
        }
    }

    /// <summary>
    /// Validates the HMAC-SHA256 signature from MercadoPago webhook.
    /// </summary>
    public bool ValidateWebhookSignature(string? xSignature, string? xRequestId, string? dataId)
    {
        var secret = mercadoPagoConfig.Value.WebhookSecret;
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(xSignature))
            return false;

        // Parse x-signature: ts=...,v1=...
        string? ts = null;
        string? v1 = null;
        foreach (var part in xSignature.Split(','))
        {
            var trimmed = part.Trim();
            if (trimmed.StartsWith("ts="))
                ts = trimmed[3..];
            else if (trimmed.StartsWith("v1="))
                v1 = trimmed[3..];
        }

        if (string.IsNullOrEmpty(ts) || string.IsNullOrEmpty(v1))
            return false;

        // Build the manifest: id:{data.id};request-id:{x-request-id};ts:{ts};
        var manifest = $"id:{dataId};request-id:{xRequestId};ts:{ts};";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(manifest));
        var computed = BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();

        return string.Equals(computed, v1, StringComparison.OrdinalIgnoreCase);
    }

    private static string? NormalizeWebhookId(object? value)
    {
        if (value == null) return null;
        if (value is string s) return string.IsNullOrWhiteSpace(s) ? null : s.Trim();
        if (value is JsonElement je)
        {
            if (je.ValueKind == JsonValueKind.String) return je.GetString()?.Trim();
            if (je.ValueKind == JsonValueKind.Number && je.TryGetInt64(out var num)) return num.ToString();
            return je.GetRawText().Trim();
        }
        return value.ToString()?.Trim();
    }

    private async Task CreateNotificationAsync(
        Guid userId,
        string title,
        string message,
        CancellationToken cancellationToken)
    {
        var notification = Notification.Create(userId, title, message, NotificationType.Success);
        await notificationRepository.CreateAsync(notification, cancellationToken);
        await pushNotificationSender.SendAsync(userId, title, message, ct: cancellationToken);
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
