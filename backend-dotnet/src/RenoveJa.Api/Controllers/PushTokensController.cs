using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Notifications;
using RenoveJa.Application.Interfaces;
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
public class PushTokensController(
    IPushTokenRepository pushTokenRepository,
    IUserPushPreferencesRepository pushPreferencesRepository,
    IPushNotificationDispatcher pushDispatcher,
    ILogger<PushTokensController> logger) : ControllerBase
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
        pushToken = await pushTokenRepository.RegisterOrUpdateAsync(pushToken, cancellationToken);

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
    /// Obtém preferências por categoria (Pedidos, Consultas, Lembretes) e timezone para quiet hours.
    /// </summary>
    [HttpGet("preferences")]
    public async Task<IActionResult> GetPushPreferences(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var prefs = await pushPreferencesRepository.GetOrCreateAsync(userId, cancellationToken);
        return Ok(new
        {
            requestsEnabled = prefs.RequestsEnabled,
            consultationsEnabled = prefs.ConsultationsEnabled,
            remindersEnabled = prefs.RemindersEnabled,
            timezone = prefs.Timezone
        });
    }

    /// <summary>
    /// Atualiza preferências por categoria e timezone. Valores null mantêm o atual.
    /// </summary>
    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePushPreferences(
        [FromBody] UserPushPreferencesRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var prefs = await pushPreferencesRepository.GetOrCreateAsync(userId, cancellationToken);
        var updated = UserPushPreferences.Reconstitute(
            userId,
            request.RequestsEnabled ?? prefs.RequestsEnabled,
            request.ConsultationsEnabled ?? prefs.ConsultationsEnabled,
            request.RemindersEnabled ?? prefs.RemindersEnabled,
            request.Timezone ?? prefs.Timezone);
        await pushPreferencesRepository.UpdateAsync(updated, cancellationToken);
        return Ok(new
        {
            requestsEnabled = updated.RequestsEnabled,
            consultationsEnabled = updated.ConsultationsEnabled,
            remindersEnabled = updated.RemindersEnabled,
            timezone = updated.Timezone
        });
    }

    /// <summary>
    /// Envia um push de teste para o usuário autenticado (para validar se push está funcional).
    /// </summary>
    [HttpPost("test")]
    public async Task<IActionResult> SendTestPush(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var tokens = await pushTokenRepository.GetByUserIdAsync(userId, cancellationToken);
        if (tokens.Count == 0)
        {
            // Verificar se tem tokens inativos para dar mensagem mais útil
            var allTokens = await pushTokenRepository.GetAllByUserIdAsync(userId, cancellationToken);
            if (allTokens.Count > 0)
                return BadRequest(new { message = "Seu token de push está inativo. Saia do app, entre novamente e tente outra vez." });
            return BadRequest(new { message = "Nenhum token de push registrado. Abra o app em um dispositivo físico e aceite as permissões de notificação." });
        }

        var payload = new PushNotificationPayload(
            "test",
            "renoveja://",
            PushCategory.System,
            $"test_{Guid.NewGuid():N}",
            DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        var request = new PushNotificationRequest(userId, "Teste RenoveJá", "Se você recebeu isso, o push está funcionando.", payload);

        try
        {
            await pushDispatcher.SendAsync(request, cancellationToken);
            return Ok(new { message = "Push de teste enviado. Verifique seu dispositivo." });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Falha ao enviar push de teste para userId={UserId}", userId);
            return BadRequest(new { message = "Não foi possível enviar o push de teste. Tente novamente em alguns instantes." });
        }
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
