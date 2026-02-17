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
    IPaymentAttemptRepository paymentAttemptRepository,
    ISavedCardRepository savedCardRepository,
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

        // Gerar correlationId único para esta tentativa
        var correlationId = Guid.NewGuid().ToString("N");
        var requestUrl = "https://api.mercadopago.com/v1/payments";
        var requestPayload = JsonSerializer.Serialize(new
        {
            transaction_amount = Math.Round(amount, 2),
            description = $"RenoveJá - Solicitação {medicalRequestId:N}",
            payment_method_id = "pix",
            payer = new { email = patientEmail },
            external_reference = medicalRequestId.ToString(),
            notification_url = mercadoPagoConfig.Value.NotificationUrl
        }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower });

        logger.LogInformation("[PAYMENT-ATTEMPT] Iniciando criação de pagamento PIX. CorrelationId={CorrelationId}, RequestId={RequestId}, UserId={UserId}, Amount={Amount}",
            correlationId, requestId, userId, amount);
        Console.WriteLine($"[PAYMENT-ATTEMPT] CorrelationId={correlationId}, RequestId={requestId}, UserId={userId}, Amount={amount}");

        PaymentAttempt? attempt = null;
        try
        {
            var pixResult = await mercadoPagoService.CreatePixPaymentAsync(
                amount,
                $"RenoveJá - Solicitação {medicalRequestId:N}",
                patientEmail,
                medicalRequestId.ToString(),
                correlationId,
                cancellationToken);

            var payment = Payment.CreatePixPayment(requestId, userId, amount);
            payment.SetPixData(
                pixResult.ExternalId,
                pixResult.QrCode,
                pixResult.QrCodeBase64,
                pixResult.CopyPaste);
            payment = await paymentRepository.CreateAsync(payment, cancellationToken);

            // Persistir PaymentAttempt com sucesso (opcional - pode falhar se tabela não existe ainda)
            try
            {
                attempt = new PaymentAttempt(
                    payment.Id,
                    requestId,
                    userId,
                    correlationId,
                    "pix",
                    amount,
                    requestUrl,
                    requestPayload);
                attempt.RecordSuccess(
                    pixResult.ExternalId,
                    null,
                    pixResult.ResponsePayload,
                    pixResult.ResponseStatusCode,
                    pixResult.ResponseStatusDetail,
                    pixResult.ResponseHeaders);
                attempt = await paymentAttemptRepository.CreateAsync(attempt, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "[PAYMENT-ATTEMPT] Falha ao persistir PaymentAttempt (tabela pode não existir ainda). CorrelationId={CorrelationId}", correlationId);
                // Não falha o fluxo se a persistência falhar
            }

            logger.LogInformation("[PAYMENT-ATTEMPT] Pagamento PIX criado com sucesso. CorrelationId={CorrelationId}, PaymentId={PaymentId}, MercadoPagoPaymentId={MpPaymentId}",
                correlationId, payment.Id, pixResult.ExternalId);
            Console.WriteLine($"[PAYMENT-ATTEMPT] Sucesso. CorrelationId={correlationId}, PaymentId={payment.Id}, MpPaymentId={pixResult.ExternalId}");

            await CreateNotificationAsync(
                userId,
                "Pagamento Criado",
                $"Pagamento de R$ {amount:F2} criado. Use o QR Code ou copia e cola para pagar.",
                cancellationToken,
                requestId);

            return MapToDto(payment);
        }
        catch (Exception ex)
        {
            // Persistir PaymentAttempt com falha
            if (attempt == null)
            {
                var tempPayment = Payment.CreatePixPayment(requestId, userId, amount);
                tempPayment = await paymentRepository.CreateAsync(tempPayment, cancellationToken);
                attempt = new PaymentAttempt(
                    tempPayment.Id,
                    requestId,
                    userId,
                    correlationId,
                    "pix",
                    amount,
                    requestUrl,
                    requestPayload);
            }
            attempt.RecordFailure(null, null, ex.Message, null);
            try
            {
                await paymentAttemptRepository.CreateAsync(attempt, cancellationToken);
            }
            catch (Exception persistEx)
            {
                logger.LogWarning(persistEx, "[PAYMENT-ATTEMPT] Falha ao persistir PaymentAttempt com erro. CorrelationId={CorrelationId}", correlationId);
                // Não falha o fluxo se a persistência falhar
            }

            logger.LogError(ex, "[PAYMENT-ATTEMPT] Falha ao criar pagamento PIX. CorrelationId={CorrelationId}, RequestId={RequestId}",
                correlationId, requestId);
            Console.WriteLine($"[PAYMENT-ATTEMPT] Falha. CorrelationId={correlationId}, Error={ex.Message}");
            throw;
        }
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
        var payerEmail = !string.IsNullOrWhiteSpace(request.PayerEmail)
            ? request.PayerEmail.Trim()
            : (patient?.Email?.Value ?? "pagador@renoveja.com.br");
        var payerCpf = !string.IsNullOrWhiteSpace(request.PayerCpf) ? request.PayerCpf : patient?.Cpf;

        // Gerar correlationId único para esta tentativa
        var correlationId = Guid.NewGuid().ToString("N");
        var paymentTypeId = request.PaymentMethod?.Trim().ToLowerInvariant();
        var cardResult = await mercadoPagoService.CreateCardPaymentAsync(
            amount,
            $"RenoveJá - Solicitação {medicalRequestId:N}",
            payerEmail,
            payerCpf,
            medicalRequestId.ToString(),
            request.Token,
            request.Installments ?? 1,
            request.PaymentMethodId.Trim(),
            request.IssuerId,
            paymentTypeId: paymentTypeId is "credit_card" or "debit_card" ? paymentTypeId : null,
            correlationId,
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
            if (request.SaveCard)
            {
                logger.LogInformation("SaveCard solicitado para userId={UserId} (MP Customers API em implementação futura)", userId);
            }
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
            cancellationToken,
            request.RequestId);

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
                cancellationToken,
                payment.RequestId);

            if (request.DoctorId.HasValue)
            {
                await CreateNotificationAsync(
                    request.DoctorId.Value,
                    "Pagamento Recebido",
                    $"O paciente pagou a solicitação de {request.PatientName ?? "paciente"}. Valor: R$ {payment.Amount.Amount:F2}.",
                    cancellationToken,
                    payment.RequestId);
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
    /// Obtém URL do Checkout Pro para pagamento com cartão. Cria pagamento checkout_pro e retorna init_point.
    /// </summary>
    public async Task<CheckoutProResponseDto> GetCheckoutProUrlAsync(
        Guid requestId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var medicalRequest = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (medicalRequest == null)
            throw new KeyNotFoundException("Solicitação não encontrada");

        if (medicalRequest.PatientId != userId)
            throw new UnauthorizedAccessException("Somente o paciente da solicitação pode pagar");

        if (medicalRequest.Status != RequestStatus.ApprovedPendingPayment)
            throw new InvalidOperationException("Solicitação deve estar aprovada e aguardando pagamento");

        if (medicalRequest.Price == null || medicalRequest.Price.Amount <= 0)
            throw new InvalidOperationException("Solicitação sem valor definido");

        var amount = medicalRequest.Price.Amount;

        var existingPayment = await paymentRepository.GetByRequestIdAsync(requestId, cancellationToken);
        if (existingPayment != null && existingPayment.IsPending())
            await paymentRepository.DeleteAsync(existingPayment.Id, cancellationToken);

        var patient = await userRepository.GetByIdAsync(userId, cancellationToken);
        var patientEmail = patient?.Email?.Value ?? "pagador@renoveja.com.br";

        // Gerar correlationId único para esta tentativa
        var correlationId = Guid.NewGuid().ToString("N");
        var initPoint = await mercadoPagoService.CreateCheckoutProPreferenceAsync(
            amount,
            $"RenoveJá - Solicitação {medicalRequest.Id:N}",
            medicalRequest.Id.ToString(),
            patientEmail,
            mercadoPagoConfig.Value.RedirectBaseUrl,
            correlationId,
            cancellationToken);

        var payment = Payment.CreateCheckoutProPayment(requestId, userId, amount);
        payment = await paymentRepository.CreateAsync(payment, cancellationToken);

        await CreateNotificationAsync(
            userId,
            "Checkout Pro",
            "Abra o link para pagar com cartão ou PIX na página do Mercado Pago.",
            cancellationToken,
            requestId);

        return new CheckoutProResponseDto(initPoint, payment.Id);
    }

    /// <summary>
    /// Processa webhook do Mercado Pago com verificação real do pagamento via API e validação HMAC.
    /// </summary>
    public async Task ProcessWebhookAsync(
        MercadoPagoWebhookDto? webhook,
        CancellationToken cancellationToken = default)
    {
        if (webhook == null)
            return;

        // Aceitar webhooks com Action "payment.*" OU sem action (formato antigo do MP: id/topic)
        // O formato antigo envia ?id=X&topic=payment sem action no body
        var action = webhook.Action;
        if (!string.IsNullOrEmpty(action) && !action.StartsWith("payment.", StringComparison.OrdinalIgnoreCase))
            return;

        var mpPaymentId = NormalizeWebhookId(webhook.Data != null && webhook.Data.TryGetValue("id", out var dataId) ? dataId : null)
            ?? NormalizeWebhookId(webhook.Id);
        if (string.IsNullOrEmpty(mpPaymentId))
            return;

        logger.LogInformation("[WEBHOOK-PROCESS] Processando webhook. Action={Action}, PaymentId={PaymentId}", action ?? "(null/topic)", mpPaymentId);
        Console.WriteLine($"[WEBHOOK-PROCESS] Action={action ?? "(null/topic)"}, PaymentId={mpPaymentId}");

        var payment = await paymentRepository.GetByExternalIdAsync(mpPaymentId, cancellationToken);
        logger.LogInformation("[WEBHOOK-PROCESS] GetByExternalId({MpPaymentId}) => {Found}", mpPaymentId, payment != null ? $"PaymentId={payment.Id}" : "null");
        Console.WriteLine($"[WEBHOOK-PROCESS] GetByExternalId({mpPaymentId}) => {(payment != null ? $"PaymentId={payment.Id}" : "null")}");

        if (payment == null)
        {
            logger.LogInformation("[WEBHOOK-PROCESS] Buscando detalhes do pagamento no MP para encontrar external_reference...");
            Console.WriteLine("[WEBHOOK-PROCESS] Buscando detalhes no MP...");
            var details = await mercadoPagoService.GetPaymentDetailsAsync(mpPaymentId, cancellationToken);
            logger.LogInformation("[WEBHOOK-PROCESS] MP details: ExternalReference={ExtRef}", details?.ExternalReference ?? "null");
            Console.WriteLine($"[WEBHOOK-PROCESS] MP details: ExternalReference={details?.ExternalReference ?? "null"}");
            if (details != null && !string.IsNullOrEmpty(details.ExternalReference) &&
                Guid.TryParse(details.ExternalReference, out var requestIdFromExt))
            {
                payment = await paymentRepository.GetByRequestIdAsync(requestIdFromExt, cancellationToken);
                logger.LogInformation("[WEBHOOK-PROCESS] GetByRequestId({RequestId}) => {Found}", requestIdFromExt, payment != null ? $"PaymentId={payment.Id}" : "null");
                Console.WriteLine($"[WEBHOOK-PROCESS] GetByRequestId({requestIdFromExt}) => {(payment != null ? $"PaymentId={payment.Id}" : "null")}");
                if (payment != null)
                {
                    payment.SetExternalId(mpPaymentId);
                    payment = await paymentRepository.UpdateAsync(payment, cancellationToken);
                }
            }
        }

        if (payment == null)
        {
            logger.LogWarning("[WEBHOOK-PROCESS] Pagamento NÃO encontrado para MpPaymentId={MpPaymentId}. Ignorando.", mpPaymentId);
            Console.WriteLine($"[WEBHOOK-PROCESS] Pagamento NÃO encontrado para {mpPaymentId}. Ignorando.");
            return;
        }

        if (!payment.IsPending())
        {
            logger.LogInformation("[WEBHOOK-PROCESS] Pagamento já não está pendente. Status atual. PaymentId={PaymentId}", payment.Id);
            Console.WriteLine($"[WEBHOOK-PROCESS] Pagamento já não pendente. PaymentId={payment.Id}");
            return;
        }

        // Verify payment status with MercadoPago API
        logger.LogInformation("[WEBHOOK-PROCESS] Verificando status real no MP API para pagamento {MpPaymentId}...", mpPaymentId);
        Console.WriteLine($"[WEBHOOK-PROCESS] Verificando status no MP para {mpPaymentId}...");
        var realStatus = await mercadoPagoService.GetPaymentStatusAsync(mpPaymentId, cancellationToken);
        if (string.IsNullOrEmpty(realStatus))
        {
            logger.LogWarning("[WEBHOOK-PROCESS] Não foi possível verificar status do pagamento {PaymentId} na API do MP", mpPaymentId);
            Console.WriteLine($"[WEBHOOK-PROCESS] FALHA ao verificar status no MP para {mpPaymentId}");
            return;
        }

        logger.LogInformation("[WEBHOOK-PROCESS] Pagamento {PaymentId} status real do MP = {Status}", mpPaymentId, realStatus);
        Console.WriteLine($"[WEBHOOK-PROCESS] Status real do MP para {mpPaymentId} = {realStatus}");

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
                    cancellationToken,
                    payment.RequestId);

                if (request.DoctorId.HasValue)
                {
                    await CreateNotificationAsync(
                        request.DoctorId.Value,
                        "Pagamento Recebido",
                        $"O paciente pagou a solicitação. Valor: R$ {payment.Amount.Amount:F2}.",
                        cancellationToken,
                        payment.RequestId);
                }
            }
        }
        else if (realStatus.Equals("rejected", StringComparison.OrdinalIgnoreCase) ||
                 realStatus.Equals("cancelled", StringComparison.OrdinalIgnoreCase))
        {
            payment.Reject();
            await paymentRepository.UpdateAsync(payment, cancellationToken);

            await CreateNotificationAsync(
                payment.UserId,
                "Pagamento não aprovado",
                "Seu pagamento não foi aprovado. Tente outro cartão ou forma de pagamento.",
                cancellationToken,
                payment.RequestId);
        }
    }

    /// <summary>
    /// Sincroniza o status de um pagamento com a API do Mercado Pago. Útil quando o webhook falha.
    /// </summary>
    public async Task<PaymentResponseDto?> SyncPaymentStatusAsync(
        Guid requestId,
        CancellationToken cancellationToken = default)
    {
        var payment = await paymentRepository.GetByRequestIdAsync(requestId, cancellationToken);
        if (payment == null)
            return null;

        if (!payment.IsPending())
            return MapToDto(payment);

        // Se não tem externalId, tenta buscar pelos detalhes do pagamento
        if (string.IsNullOrEmpty(payment.ExternalId))
        {
            logger.LogWarning("SyncPaymentStatus: pagamento {PaymentId} não tem ExternalId do Mercado Pago", payment.Id);
            return MapToDto(payment);
        }

        // Verifica status real na API do Mercado Pago
        var realStatus = await mercadoPagoService.GetPaymentStatusAsync(payment.ExternalId, cancellationToken);
        if (string.IsNullOrEmpty(realStatus))
        {
            logger.LogWarning("SyncPaymentStatus: não foi possível verificar status do pagamento {PaymentId} na API do MP", payment.ExternalId);
            return MapToDto(payment);
        }

        logger.LogInformation("SyncPaymentStatus: pagamento {PaymentId} status real = {Status}", payment.ExternalId, realStatus);

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
                    "Seu pagamento foi confirmado!",
                    cancellationToken,
                    payment.RequestId);

                if (request.DoctorId.HasValue)
                {
                    await CreateNotificationAsync(
                        request.DoctorId.Value,
                        "Pagamento Recebido",
                        $"O paciente pagou a solicitação. Valor: R$ {payment.Amount.Amount:F2}.",
                        cancellationToken,
                        payment.RequestId);
                }
            }
        }
        else if (realStatus.Equals("rejected", StringComparison.OrdinalIgnoreCase) ||
                 realStatus.Equals("cancelled", StringComparison.OrdinalIgnoreCase))
        {
            payment.Reject();
            await paymentRepository.UpdateAsync(payment, cancellationToken);

            await CreateNotificationAsync(
                payment.UserId,
                "Pagamento não aprovado",
                "Seu pagamento não foi aprovado. Tente outro cartão ou forma de pagamento.",
                cancellationToken,
                payment.RequestId);
        }

        return MapToDto(payment);
    }

    /// <summary>
    /// Lista cartões salvos do usuário.
    /// </summary>
    public async Task<IReadOnlyList<SavedCardDto>> GetSavedCardsAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var cards = await savedCardRepository.GetByUserIdAsync(userId, cancellationToken);
        return cards.Select(c => new SavedCardDto(
            c.Id.ToString(),
            c.MpCardId,
            c.LastFour,
            c.Brand)).ToList();
    }

    /// <summary>
    /// Paga com cartão salvo. O token deve ser criado no frontend via mp.fields.createCardToken({ cardId }) com o CVV.
    /// </summary>
    public async Task<PaymentResponseDto> PayWithSavedCardAsync(
        PayWithSavedCardRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            throw new InvalidOperationException("Token do cartão é obrigatório. Use mp.fields.createCardToken({ cardId }) no frontend.");

        if (!Guid.TryParse(request.SavedCardId, out var savedCardGuid))
            throw new InvalidOperationException("SavedCardId inválido.");

        var savedCard = await savedCardRepository.GetByIdAsync(savedCardGuid, cancellationToken);
        if (savedCard == null)
            throw new KeyNotFoundException("Cartão salvo não encontrado.");

        if (savedCard.UserId != userId)
            throw new UnauthorizedAccessException("Este cartão não pertence ao usuário.");

        var medicalRequest = await requestRepository.GetByIdAsync(request.RequestId, cancellationToken);
        if (medicalRequest == null)
            throw new KeyNotFoundException("Solicitação não encontrada");

        if (medicalRequest.PatientId != userId)
            throw new UnauthorizedAccessException("Somente o paciente da solicitação pode pagar");

        if (medicalRequest.Status != RequestStatus.ApprovedPendingPayment)
            throw new InvalidOperationException("Solicitação deve estar aprovada e aguardando pagamento");

        if (medicalRequest.Price == null || medicalRequest.Price.Amount <= 0)
            throw new InvalidOperationException("Solicitação sem valor definido");

        var amount = medicalRequest.Price.Amount;
        var correlationId = Guid.NewGuid().ToString("N");

        var cardResult = await mercadoPagoService.CreateCardPaymentWithCustomerAsync(
            amount,
            $"RenoveJá - Solicitação {medicalRequest.Id:N}",
            savedCard.MpCustomerId,
            request.Token,
            savedCard.Brand,
            1,
            medicalRequest.Id.ToString(),
            correlationId,
            cancellationToken);

        var payment = Payment.CreateCardPayment(request.RequestId, userId, amount, "credit_card");
        payment.SetExternalId(cardResult.ExternalId);

        var statusLower = cardResult.Status.Trim().ToLowerInvariant();
        if (statusLower == "approved")
        {
            payment.Approve();
            medicalRequest.MarkAsPaid();
            await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
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

        await CreateNotificationAsync(userId, "Pagamento com cartão salvo", $"R$ {amount:F2} - {message}", cancellationToken, request.RequestId);

        return MapToDto(payment);
    }

    /// <summary>
    /// Adiciona um cartão ao customer do MP e persiste em saved_cards.
    /// </summary>
    public async Task AddCardAsync(Guid userId, string token, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new InvalidOperationException("Token do cartão é obrigatório.");

        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        if (user == null)
            throw new KeyNotFoundException("Usuário não encontrado.");

        var email = user.Email?.Value ?? "usuario@renoveja.com.br";
        var nameParts = (user.Name ?? "Usuário").Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        var firstName = nameParts.Length > 0 ? nameParts[0] : "Usuário";
        var lastName = nameParts.Length > 1 ? nameParts[1] : "";

        string mpCustomerId;
        var existingCards = await savedCardRepository.GetByUserIdAsync(userId, cancellationToken);
        if (existingCards.Count > 0)
        {
            mpCustomerId = existingCards[0].MpCustomerId;
        }
        else
        {
            mpCustomerId = await mercadoPagoService.CreateCustomerAsync(
                email,
                firstName,
                lastName,
                "55",
                user.Phone ?? "999999999",
                cancellationToken);
        }

        var (cardId, lastFour, brand) = await mercadoPagoService.AddCardToCustomerAsync(mpCustomerId, token, cancellationToken);

        var savedCard = SavedCard.Create(userId, mpCustomerId, cardId, lastFour, brand);
        await savedCardRepository.CreateAsync(savedCard, cancellationToken);

        logger.LogInformation("Cartão salvo para userId={UserId}, mpCardId={CardId}, lastFour={LastFour}", userId, cardId, lastFour);
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

        // Manifest conforme doc MP: incluir apenas valores presentes. Id da URL em minúsculas se alfanumérico.
        var parts = new List<string>();
        if (!string.IsNullOrEmpty(dataId)) parts.Add($"id:{dataId.ToLowerInvariant()}");
        if (!string.IsNullOrEmpty(xRequestId)) parts.Add($"request-id:{xRequestId}");
        parts.Add($"ts:{ts}");
        var manifest = string.Join(";", parts) + ";";
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
        CancellationToken cancellationToken,
        Guid? requestId = null)
    {
        var data = requestId.HasValue ? new Dictionary<string, object> { ["requestId"] = requestId.Value.ToString() } : null;
        var notification = Notification.Create(userId, title, message, NotificationType.Success, data);
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
