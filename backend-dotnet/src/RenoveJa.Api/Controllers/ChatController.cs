using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Chat;
using RenoveJa.Application.Services.Chat;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por mensagens de chat entre paciente e médico.
/// </summary>
[ApiController]
[Route("api/chat")]
[Authorize]
public class ChatController(IChatService chatService) : ControllerBase
{
    /// <summary>
    /// Envia uma mensagem em um pedido/solicitação.
    /// </summary>
    [HttpPost("{requestId}/messages")]
    public async Task<IActionResult> SendMessage(
        Guid requestId,
        [FromBody] SendMessageRequestDto dto,
        CancellationToken cancellationToken)
    {
        var senderId = GetUserId();
        var message = await chatService.SendMessageAsync(requestId, dto, senderId, cancellationToken);
        return Ok(message);
    }

    /// <summary>
    /// Lista mensagens de um pedido.
    /// </summary>
    [HttpGet("{requestId}/messages")]
    public async Task<IActionResult> GetMessages(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var messages = await chatService.GetMessagesAsync(requestId, cancellationToken);
        return Ok(messages);
    }

    /// <summary>
    /// Retorna a quantidade de mensagens não lidas do usuário.
    /// </summary>
    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount(
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var count = await chatService.GetUnreadCountAsync(userId, cancellationToken);
        return Ok(new { unread_count = count });
    }

    /// <summary>
    /// Marca as mensagens de um pedido como lidas.
    /// </summary>
    [HttpPut("{requestId}/mark-read")]
    public async Task<IActionResult> MarkAsRead(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        await chatService.MarkAsReadAsync(requestId, userId, cancellationToken);
        return Ok(new { message = "Messages marked as read" });
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
