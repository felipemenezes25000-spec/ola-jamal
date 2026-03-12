using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Payments;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por pagamentos (PIX, confirmação, webhook).
/// </summary>
[ApiController]
[Route("api/payments")]
public class PaymentsController(
    IPaymentService paymentService,
    IPaymentWebhookHandler webhookHandler,
    ILogger<PaymentsController> logger) : ControllerBase
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
    /// Obtém URL do Checkout Pro para pagamento com cartão. Abra a URL no navegador.
    /// </summary>
    [HttpGet("checkout-pro/{requestId}")]
    [Authorize]
    public async Task<IActionResult> GetCheckoutProUrl(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var result = await paymentService.GetCheckoutProUrlAsync(requestId, userId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Obtém o pagamento PIX pendente de uma solicitação (para o paciente pagar).
    /// Retorna 200 com null quando não há pagamento pendente (fluxo normal: frontend cria o pagamento).
    /// </summary>
    [HttpGet("by-request/{requestId}")]
    [Authorize]
    public async Task<IActionResult> GetPaymentByRequest(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var payment = await paymentService.GetPaymentByRequestIdAsync(requestId, userId, cancellationToken);
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
        if (payment == null)
            return NotFound(new { message = "Pagamento não encontrado" });
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
        if (payment == null)
            return NotFound(new { message = "Pagamento não encontrado" });
        var code = payment.PixCopyPaste ?? payment.PixQrCode ?? "";
        return Content(code, "text/plain; charset=utf-8");
    }

    /// <summary>
    /// Confirma um pagamento pelo ID do pagamento.
    /// </summary>
    [HttpPost("{id}/confirm")]
    [Authorize]
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
    [Authorize]
    public async Task<IActionResult> ConfirmPaymentByRequest(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var payment = await paymentService.ConfirmPaymentByRequestIdAsync(requestId, cancellationToken);
        return Ok(payment);
    }

    /// <summary>
    /// Lista cartões salvos do usuário.
    /// </summary>
    [HttpGet("saved-cards")]
    [Authorize]
    public async Task<IActionResult> GetSavedCards(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var cards = await paymentService.GetSavedCardsAsync(userId, cancellationToken);
        return Ok(cards);
    }

    /// <summary>
    /// Adiciona um cartão salvo (token do Brick em modo somente cartão).
    /// </summary>
    [HttpPost("add-card")]
    [Authorize]
    public async Task<IActionResult> AddCard(
        [FromBody] AddCardRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        await paymentService.AddCardAsync(userId, request.Token, cancellationToken);
        return Ok(new { message = "Cartão adicionado com sucesso." });
    }

    /// <summary>
    /// Pagar com cartão salvo (token criado via mp.fields.createCardToken com CVV).
    /// </summary>
    [HttpPost("saved-card")]
    [Authorize]
    public async Task<IActionResult> PayWithSavedCard(
        [FromBody] PayWithSavedCardRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var payment = await paymentService.PayWithSavedCardAsync(request, userId, cancellationToken);
        return Ok(payment);
    }

    /// <summary>
    /// Sincroniza o status do pagamento com a API do Mercado Pago. Útil quando o webhook falha.
    /// Use o ID da solicitação (requestId), não o ID do pagamento.
    /// </summary>
    [HttpPost("sync-status/{requestId}")]
    [Authorize]
    public async Task<IActionResult> SyncPaymentStatus(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var payment = await paymentService.SyncPaymentStatusAsync(requestId, cancellationToken);
        if (payment == null)
            return NotFound(new { message = "Nenhum pagamento encontrado para esta solicitação" });
        return Ok(payment);
    }

    /// <summary>
    /// GET para verificação/health do webhook (evita 405 em verificações ou redirects).
    /// </summary>
    [HttpGet("webhook")]
    [AllowAnonymous]
    public IActionResult WebhookHealth()
    {
        return Ok(new { status = "ok", message = "Webhook endpoint ready" });
    }

    /// <summary>
    /// Recebe webhooks do Mercado Pago. Valida assinatura HMAC quando WebhookSecret está configurado.
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    [EnableRateLimiting("fixed")]
    public async Task<IActionResult> Webhook(CancellationToken cancellationToken)
    {
        string? rawBody = null;
        try
        {
            Request.Body.Position = 0;
            using var reader = new StreamReader(Request.Body, System.Text.Encoding.UTF8);
            rawBody = await reader.ReadToEndAsync(cancellationToken);
            Request.Body.Position = 0;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Payments Webhook: falha ao ler body.");
        }

        var headers = Request.Headers.ToDictionary(h => h.Key, h => h.Value.FirstOrDefault() ?? "", StringComparer.OrdinalIgnoreCase);
        var result = await webhookHandler.HandleAsync(
            rawBody,
            Request.QueryString.Value ?? "",
            headers,
            Request.ContentType,
            Request.ContentLength,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken);

        return result.Kind switch
        {
            PaymentWebhookResultKind.Success => Ok(),
            PaymentWebhookResultKind.BadRequest => BadRequest(new { error = result.Error }),
            PaymentWebhookResultKind.Unauthorized => Unauthorized(new { error = result.Error }),
            PaymentWebhookResultKind.Duplicate => Ok(new { message = "Webhook já processado (duplicado)", duplicate = true }),
            PaymentWebhookResultKind.Idempotent => Ok(new { message = "Pagamento já processado", idempotent = true }),
            _ => BadRequest(new { error = result.Error ?? "Unknown" })
        };
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
