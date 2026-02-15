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
public class NotificationsController(INotificationService notificationService, ILogger<NotificationsController> logger) : ControllerBase
{
    /// <summary>
    /// Lista notificações do usuário autenticado com paginação.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetNotifications(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        if (page < 1) page = 1;
        var userId = GetUserId();
        logger.LogInformation("Notifications GetNotifications: userId={UserId}, page={Page}, pageSize={PageSize}", userId, page, pageSize);
        var notifications = await notificationService.GetUserNotificationsPagedAsync(userId, page, pageSize, cancellationToken);
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
