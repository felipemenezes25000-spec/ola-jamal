using System.Text.Json;
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
    /// Aceita notificação por body JSON ou por query string (data.id/type ou id/topic), conforme documentação MP.
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook(
        [FromBody] MercadoPagoWebhookDto? webhook,
        CancellationToken cancellationToken)
    {
        // Id para HMAC: query (MP assina com parâmetros da URL) ou body (data.id)
        var dataIdFromQuery = Request.Query["data.id"].FirstOrDefault() ?? Request.Query["id"].FirstOrDefault();
        var dataIdFromBody = ExtractPaymentIdFromWebhook(webhook);

        // Fallback: ler body bruto se model binding falhou (ex: ngrok altera request)
        if (string.IsNullOrWhiteSpace(dataIdFromBody) && string.IsNullOrWhiteSpace(dataIdFromQuery))
        {
            try
            {
                Request.EnableBuffering();
                Request.Body.Position = 0;
                using var reader = new StreamReader(Request.Body, leaveOpen: true);
                var rawBody = await reader.ReadToEndAsync(cancellationToken);
                Request.Body.Position = 0;
                if (!string.IsNullOrWhiteSpace(rawBody))
                {
                    using var doc = JsonDocument.Parse(rawBody);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("data", out var dataEl) && dataEl.TryGetProperty("id", out var idEl))
                    {
                        dataIdFromBody = idEl.ValueKind == JsonValueKind.Number
                            ? idEl.GetInt64().ToString()
                            : idEl.GetString();
                        if (webhook == null && !string.IsNullOrEmpty(dataIdFromBody))
                        {
                            var action = root.TryGetProperty("action", out var a) ? a.GetString() : "payment.updated";
                            var data = new Dictionary<string, JsonElement> { ["id"] = idEl.Clone() };
                            webhook = new MercadoPagoWebhookDto(action, dataIdFromBody, data);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Payments Webhook: falha ao parsear body bruto");
            }
        }

        var dataIdForHmac = dataIdFromQuery ?? dataIdFromBody;
        var dataIdForProcessing = dataIdFromQuery ?? dataIdFromBody;

        logger.LogInformation("Payments Webhook: recebido, dataId={DataId}, fromQuery={FromQuery}",
            dataIdForProcessing ?? "null", !string.IsNullOrEmpty(dataIdFromQuery));

        if (string.IsNullOrWhiteSpace(dataIdForProcessing))
        {
            logger.LogWarning("Payments Webhook: sem id na query (data.id ou id) nem no body");
            return BadRequest(new { error = "Missing payment id in query or body" });
        }

        // Montar DTO a partir da query quando o body vier vazio (alguns envios do MP só trazem query)
        var topic = Request.Query["topic"].FirstOrDefault() ?? Request.Query["type"].FirstOrDefault();
        if (webhook == null && !string.IsNullOrEmpty(dataIdForProcessing) && "payment".Equals(topic, StringComparison.OrdinalIgnoreCase))
        {
            using var doc = JsonDocument.Parse($"\"{dataIdForProcessing.Replace("\\", "\\\\").Replace("\"", "\\\"")}\"");
            var data = new Dictionary<string, JsonElement> { ["id"] = doc.RootElement.Clone() };
            webhook = new MercadoPagoWebhookDto("payment.updated", dataIdForProcessing, data);
        }

        if (webhook == null)
        {
            using var doc = JsonDocument.Parse($"\"{dataIdForProcessing.Replace("\\", "\\\\").Replace("\"", "\\\"")}\"");
            var data = new Dictionary<string, JsonElement> { ["id"] = doc.RootElement.Clone() };
            webhook = new MercadoPagoWebhookDto("payment.updated", dataIdForProcessing, data);
        }

        // Validar assinatura HMAC do Mercado Pago (usa id da URL quando presente, senão do body)
        var webhookSecret = mpConfig.Value.WebhookSecret;
        if (!string.IsNullOrWhiteSpace(webhookSecret) && !webhookSecret.Contains("YOUR_"))
        {
            var xSignature = Request.Headers["x-signature"].FirstOrDefault();
            var xRequestId = Request.Headers["x-request-id"].FirstOrDefault();

            if (paymentService is PaymentService ps && !ps.ValidateWebhookSignature(xSignature, xRequestId, dataIdForHmac))
            {
                logger.LogWarning("Webhook MP rejeitado: assinatura HMAC inválida. x-signature={Sig}", xSignature);
                return Unauthorized(new { error = "Invalid webhook signature" });
            }
        }

        await paymentService.ProcessWebhookAsync(webhook, cancellationToken);
        logger.LogInformation("Payments Webhook: processado com sucesso");
        return Ok();
    }

    private static string? ExtractPaymentIdFromWebhook(MercadoPagoWebhookDto? webhook)
    {
        if (webhook?.Data != null && webhook.Data.TryGetValue("id", out var idVal))
        {
            return idVal.ValueKind == JsonValueKind.Number
                ? idVal.GetInt64().ToString()
                : idVal.GetString();
        }
        return webhook?.Id;
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
