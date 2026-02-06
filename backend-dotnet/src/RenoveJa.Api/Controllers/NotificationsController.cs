using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.Services.Notifications;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por notificações do usuário.
/// </summary>
[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController(INotificationService notificationService) : ControllerBase
{
    /// <summary>
    /// Lista notificações do usuário autenticado.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetNotifications(
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var notifications = await notificationService.GetUserNotificationsAsync(userId, cancellationToken);
        return Ok(notifications);
    }

    /// <summary>
    /// Marca uma notificação como lida.
    /// </summary>
    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkAsRead(
        Guid id,
        CancellationToken cancellationToken)
    {
        var notification = await notificationService.MarkAsReadAsync(id, cancellationToken);
        return Ok(notification);
    }

    /// <summary>
    /// Marca todas as notificações do usuário como lidas.
    /// </summary>
    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead(
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        await notificationService.MarkAllAsReadAsync(userId, cancellationToken);
        return Ok(new { message = "All notifications marked as read" });
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
