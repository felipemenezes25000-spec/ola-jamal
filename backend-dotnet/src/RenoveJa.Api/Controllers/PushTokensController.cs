using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

[ApiController]
[Route("api/push-tokens")]
[Authorize]
public class PushTokensController : ControllerBase
{
    private readonly IPushTokenRepository _pushTokenRepository;

    public PushTokensController(IPushTokenRepository pushTokenRepository)
    {
        _pushTokenRepository = pushTokenRepository;
    }

    [HttpPost]
    public async Task<IActionResult> RegisterToken(
        [FromBody] RegisterPushTokenRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();

        var pushToken = PushToken.Create(userId, request.Token, request.DeviceType);
        pushToken = await _pushTokenRepository.CreateAsync(pushToken, cancellationToken);

        return Ok(new
        {
            id = pushToken.Id,
            message = "Push token registered successfully"
        });
    }

    [HttpDelete]
    public async Task<IActionResult> UnregisterToken(
        [FromBody] UnregisterPushTokenRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();

        await _pushTokenRepository.DeleteByTokenAsync(request.Token, userId, cancellationToken);

        return Ok(new { message = "Push token unregistered successfully" });
    }

    [HttpGet]
    public async Task<IActionResult> GetMyTokens(CancellationToken cancellationToken)
    {
        var userId = GetUserId();

        var tokens = await _pushTokenRepository.GetByUserIdAsync(userId, cancellationToken);

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

public record RegisterPushTokenRequest(string Token, string? DeviceType = null);
public record UnregisterPushTokenRequest(string Token);
