using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.Interfaces;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Assinatura em lote de documentos médicos.
/// Fluxo: Revisar → Aprovar → Acumular → Assinar todos.
/// </summary>
[ApiController]
[Route("api/batch-signature")]
[Authorize(Roles = "doctor")]
public class BatchSignatureController(
    IBatchSignatureService batchService,
    ILogger<BatchSignatureController> logger) : ControllerBase
{
    private Guid GetUserId() =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id : throw new UnauthorizedAccessException();

    /// <summary>Marca pedido como revisado.</summary>
    [HttpPost("{requestId}/review")]
    public async Task<IActionResult> MarkReviewed(Guid requestId, CancellationToken ct)
    {
        var ok = await batchService.MarkAsReviewedAsync(GetUserId(), requestId, ct);
        return ok ? Ok(new { reviewed = true }) : BadRequest(new { error = "Pedido não encontrado ou acesso negado." });
    }

    /// <summary>Aprova pedido para assinatura em lote.</summary>
    [HttpPost("{requestId}/approve-for-signing")]
    public async Task<IActionResult> ApproveForSigning(Guid requestId, CancellationToken ct)
    {
        var (success, error) = await batchService.ApproveForSigningAsync(GetUserId(), requestId, ct);
        return success ? Ok(new { approved = true }) : BadRequest(new { error });
    }

    /// <summary>Lista todos os requests aprovados para assinatura.</summary>
    [HttpGet("pending")]
    public async Task<IActionResult> GetPending(CancellationToken ct)
    {
        var ids = await batchService.GetApprovedRequestIdsAsync(GetUserId(), ct);
        return Ok(new { requestIds = ids, count = ids.Count });
    }

    /// <summary>Assina em lote todos os requests aprovados.</summary>
    [HttpPost("sign")]
    public async Task<IActionResult> SignBatch(
        [FromBody] BatchSignRequest request, CancellationToken ct)
    {
        if (request.RequestIds == null || request.RequestIds.Count == 0)
            return BadRequest(new { error = "Nenhum pedido selecionado." });

        var result = await batchService.SignBatchAsync(
            GetUserId(), request.RequestIds, request.PfxPassword, ct);

        return Ok(result);
    }
}

public record BatchSignRequest(List<Guid> RequestIds, string? PfxPassword);
