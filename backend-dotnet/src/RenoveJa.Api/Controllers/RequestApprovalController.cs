using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

[ApiController]
[Route("api/requests")]
[Authorize]
public class RequestApprovalController(
    IRequestService requestService,
    IRequestRepository requestRepository,
    ILogger<RequestApprovalController> logger) : ControllerBase
{
    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }

    private async Task<Guid?> ResolveRequestIdAsync(string id, CancellationToken cancellationToken)
    {
        if (Guid.TryParse(id, out var guid))
            return guid;
        var req = await requestRepository.GetByShortCodeAsync(id, cancellationToken);
        return req?.Id;
    }

    /// <summary>
    /// Atualiza o status de uma solicitação (médico).
    /// </summary>
    [HttpPut("{id}/status")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        [FromBody] UpdateRequestStatusDto dto,
        CancellationToken cancellationToken)
    {
        var request = await requestService.UpdateStatusAsync(id, dto, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Aprova a renovação. Somente médicos (role doctor). Body vazio.
    /// O valor vem da tabela product_prices. O paciente inicia o pagamento via POST /api/payments.
    /// Para rejeitar: POST /api/requests/{id}/reject com { "rejectionReason": "motivo" }.
    /// </summary>
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> Approve(
        string id,
        [FromBody] ApproveRequestDto? dto,
        CancellationToken cancellationToken)
    {
        var resolvedId = await ResolveRequestIdAsync(id, cancellationToken);
        if (resolvedId == null) return NotFound();
        var doctorId = GetUserId();
        var request = await requestService.ApproveAsync(resolvedId.Value, dto ?? new ApproveRequestDto(), doctorId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Rejeita uma solicitação com motivo (médico).
    /// </summary>
    [HttpPost("{id}/reject")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> Reject(
        string id,
        [FromBody] RejectRequestDto dto,
        CancellationToken cancellationToken)
    {
        var resolvedId = await ResolveRequestIdAsync(id, cancellationToken);
        if (resolvedId == null) return NotFound();
        var request = await requestService.RejectAsync(resolvedId.Value, dto, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Atribui a solicitação à fila (próximo médico disponível).
    /// </summary>
    [HttpPost("{id}/assign-queue")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> AssignQueue(
        Guid id,
        CancellationToken cancellationToken)
    {
        var request = await requestService.AssignToQueueAsync(id, cancellationToken);
        return Ok(request);
    }

    [HttpPut("{id}/conduct")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> UpdateConduct(
        string id,
        [FromBody] UpdateConductDto dto,
        CancellationToken cancellationToken)
    {
        var resolvedId = await ResolveRequestIdAsync(id, cancellationToken);
        if (resolvedId == null) return NotFound();
        var doctorId = GetUserId();
        var result = await requestService.UpdateConductAsync(resolvedId.Value, dto, doctorId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Paciente marca o documento como entregue (Signed → Delivered) ao baixar/abrir o PDF.
    /// </summary>
    [HttpPost("{id}/mark-delivered")]
    public async Task<IActionResult> MarkDelivered(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestService.MarkDeliveredAsync(id, userId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Paciente cancela o pedido (apenas antes do pagamento).
    /// </summary>
    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestService.CancelAsync(id, userId, cancellationToken);
        return Ok(request);
    }
}
