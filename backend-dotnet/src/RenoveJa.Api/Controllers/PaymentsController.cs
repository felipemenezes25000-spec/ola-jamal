using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.Interfaces;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por pagamentos (PIX, confirmação, webhook).
/// </summary>
[ApiController]
[Route("api/payments")]
public class PaymentsController(IPaymentService paymentService) : ControllerBase
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
        var payment = await paymentService.CreatePaymentAsync(request, userId, cancellationToken);
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
        var payment = await paymentService.GetPaymentAsync(id, cancellationToken);
        return Ok(payment);
    }

    /// <summary>
    /// Confirma um pagamento pelo ID.
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
    /// Recebe webhooks do Mercado Pago.
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook(
        [FromBody] MercadoPagoWebhookDto webhook,
        CancellationToken cancellationToken)
    {
        await paymentService.ProcessWebhookAsync(webhook, cancellationToken);
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
