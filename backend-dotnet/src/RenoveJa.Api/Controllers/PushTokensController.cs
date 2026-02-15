using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por registro e remoção de tokens de push para notificações.
/// </summary>
[ApiController]
[Route("api/push-tokens")]
[Authorize]
public class PushTokensController(IPushTokenRepository pushTokenRepository, ILogger<PushTokensController> logger) : ControllerBase
{
    /// <summary>
    /// Registra um token de push do dispositivo do usuário.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> RegisterToken(
        [FromBody] RegisterPushTokenRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        logger.LogInformation("PushTokens RegisterToken: userId={UserId}, deviceType={DeviceType}", userId, request.DeviceType);
        var pushToken = PushToken.Create(userId, request.Token, request.DeviceType);
        pushToken = await pushTokenRepository.CreateAsync(pushToken, cancellationToken);

        return Ok(new
        {
            id = pushToken.Id,
            message = "Push token registered successfully"
        });
    }

    /// <summary>
    /// Remove o registro de um token de push.
    /// </summary>
    [HttpDelete]
    public async Task<IActionResult> UnregisterToken(
        [FromQuery] string? token,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { message = "Token is required" });

        var userId = GetUserId();
        await pushTokenRepository.DeleteByTokenAsync(token, userId, cancellationToken);
        return Ok(new { message = "Push token unregistered successfully" });
    }

    /// <summary>
    /// Ativa ou desativa as notificações push para todos os tokens do usuário.
    /// </summary>
    [HttpPut("preference")]
    public async Task<IActionResult> SetPushPreference(
        [FromBody] PushPreferenceRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        await pushTokenRepository.SetAllActiveForUserAsync(userId, request.PushEnabled, cancellationToken);
        return Ok(new { pushEnabled = request.PushEnabled });
    }

    /// <summary>
    /// Lista os tokens de push do usuário autenticado (ativos e inativos, para exibir preferência).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMyTokens(CancellationToken cancellationToken)
    {
        var userId = GetUserId();

        var tokens = await pushTokenRepository.GetAllByUserIdAsync(userId, cancellationToken);

        return Ok(tokens.Select(t => new
        {
            id = t.Id,
            userId = t.UserId,
            token = t.Token,
            deviceType = t.DeviceType,
            active = t.Active,
            createdAt = t.CreatedAt
        }));
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
