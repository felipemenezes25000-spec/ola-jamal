using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Payments;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por pagamentos (PIX, confirmação, webhook).
/// </summary>
[ApiController]
[Route("api/payments")]
public class PaymentsController(IPaymentService paymentService, IOptions<MercadoPagoConfig> mpConfig, ILogger<PaymentsController> logger) : ControllerBase
{
    /// <summary>
    /// Cria um novo pagamento para uma solicitação.
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreatePayment(
        [FromBody] CreatePaymentRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        logger.LogInformation("Payments CreatePayment: userId={UserId}, requestId={RequestId}", userId, request.RequestId);
        var payment = await paymentService.CreatePaymentAsync(request, userId, cancellationToken);
        logger.LogInformation("Payments CreatePayment OK: paymentId={PaymentId}", payment.Id);
        return Ok(payment);
    }

    /// <summary>
    /// Obtém o pagamento PIX pendente de uma solicitação (para o paciente pagar).
    /// </summary>
    [HttpGet("by-request/{requestId}")]
    [Authorize]
    public async Task<IActionResult> GetPaymentByRequest(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var payment = await paymentService.GetPaymentByRequestIdAsync(requestId, userId, cancellationToken);
        if (payment == null)
            return NotFound(new { message = "Nenhum pagamento pendente para esta solicitação" });
        return Ok(payment);
    }

    /// <summary>
    /// Obtém um pagamento pelo ID.
    /// </summary>
    [HttpGet("{id}")]
    [Authorize]
    public async Task<IActionResult> GetPayment(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var payment = await paymentService.GetPaymentAsync(id, userId, cancellationToken);
        return Ok(payment);
    }

    /// <summary>
    /// Retorna o código PIX copia-e-cola completo em texto puro (para copiar e testar).
    /// </summary>
    [HttpGet("{id}/pix-code")]
    [Authorize]
    public async Task<IActionResult> GetPixCode(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var payment = await paymentService.GetPaymentAsync(id, userId, cancellationToken);
        var code = payment.PixCopyPaste ?? payment.PixQrCode ?? "";
        return Content(code, "text/plain; charset=utf-8");
    }

    /// <summary>
    /// Confirma um pagamento pelo ID do pagamento.
    /// </summary>
    [HttpPost("{id}/confirm")]
    public async Task<IActionResult> ConfirmPayment(
        Guid id,
        CancellationToken cancellationToken)
    {
        var payment = await paymentService.ConfirmPaymentAsync(id, cancellationToken);
        return Ok(payment);
    }

    /// <summary>
    /// Confirma o pagamento pendente de uma solicitação (por requestId). Para testes.
    /// Use o ID da solicitação, não o ID do pagamento.
    /// </summary>
    [HttpPost("confirm-by-request/{requestId}")]
    public async Task<IActionResult> ConfirmPaymentByRequest(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var payment = await paymentService.ConfirmPaymentByRequestIdAsync(requestId, cancellationToken);
        return Ok(payment);
    }

    /// <summary>
    /// Recebe webhooks do Mercado Pago. Valida assinatura HMAC-SHA256 quando WebhookSecret está configurado.
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook(
        [FromBody] MercadoPagoWebhookDto? webhook,
        CancellationToken cancellationToken)
    {
        var dataId = webhook?.Data != null && webhook.Data.TryGetValue("id", out var idVal) ? idVal?.ToString() : null;
        logger.LogInformation("Payments Webhook: recebido, dataId={DataId}", dataId ?? "null");

        // Validar assinatura HMAC do Mercado Pago
        var webhookSecret = mpConfig.Value.WebhookSecret;
        if (!string.IsNullOrWhiteSpace(webhookSecret) && !webhookSecret.Contains("YOUR_"))
        {
            var xSignature = Request.Headers["x-signature"].FirstOrDefault();
            var xRequestId = Request.Headers["x-request-id"].FirstOrDefault();

            if (paymentService is PaymentService ps && !ps.ValidateWebhookSignature(xSignature, xRequestId, dataId))
            {
                logger.LogWarning("Webhook MP rejeitado: assinatura HMAC inválida. x-signature={Sig}", xSignature);
                return Unauthorized(new { error = "Invalid webhook signature" });
            }
        }
        await paymentService.ProcessWebhookAsync(webhook, cancellationToken);
        logger.LogInformation("Payments Webhook: processado com sucesso");
        return Ok();
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
