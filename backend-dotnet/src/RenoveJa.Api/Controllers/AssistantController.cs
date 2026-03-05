using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Assistant;
using RenoveJa.Application.Interfaces;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Endpoints da Dra. RenoveJa para navegacao do fluxo e qualidade do envio.
/// </summary>
[ApiController]
[Route("api/assistant")]
[Authorize]
public class AssistantController(IAssistantNavigatorService assistantNavigatorService) : ControllerBase
{
    /// <summary>
    /// Retorna o proximo passo recomendado para o pedido atual.
    /// Pode receber requestId (preferencial) ou status/requestType.
    /// </summary>
    [HttpPost("next-action")]
    public async Task<IActionResult> NextAction(
        [FromBody] AssistantNextActionRequestDto request,
        CancellationToken cancellationToken)
    {
        if (request == null)
            return BadRequest(new { error = "Body obrigatorio." });

        if (!request.RequestId.HasValue && string.IsNullOrWhiteSpace(request.Status))
            return BadRequest(new { error = "Informe requestId ou status." });

        var userId = GetUserId();
        var result = await assistantNavigatorService.GetNextActionAsync(request, userId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Avalia completude do pedido antes do envio e identifica sinais de urgencia no relato.
    /// </summary>
    [HttpPost("complete")]
    public IActionResult Complete([FromBody] AssistantCompleteRequestDto request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Flow))
            return BadRequest(new { error = "Campo 'flow' e obrigatorio (prescription, exam, consultation)." });
        var flow = request.Flow.Trim().ToLowerInvariant();
        if (flow is not ("prescription" or "exam" or "consultation"))
            return BadRequest(new { error = "Flow invalido. Use: prescription, exam, consultation." });

        var result = assistantNavigatorService.EvaluateCompleteness(request);
        return Ok(result);
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
