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
public class PushTokensController(IPushTokenRepository pushTokenRepository) : ControllerBase
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
        [FromBody] UnregisterPushTokenRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();

        await pushTokenRepository.DeleteByTokenAsync(request.Token, userId, cancellationToken);

        return Ok(new { message = "Push token unregistered successfully" });
    }

    /// <summary>
    /// Lista os tokens de push do usuário autenticado.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMyTokens(CancellationToken cancellationToken)
    {
        var userId = GetUserId();

        var tokens = await pushTokenRepository.GetByUserIdAsync(userId, cancellationToken);

        return Ok(tokens.Select(t => new
        {
            id = t.Id,
            token = t.Token,
            device_type = t.DeviceType,
            active = t.Active,
            created_at = t.CreatedAt
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
