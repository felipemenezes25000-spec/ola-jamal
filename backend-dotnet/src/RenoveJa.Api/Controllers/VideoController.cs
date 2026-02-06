using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Video;
using RenoveJa.Application.Services.Video;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por salas de vídeo para consultas.
/// </summary>
[ApiController]
[Route("api/video")]
[Authorize]
public class VideoController(IVideoService videoService) : ControllerBase
{
    /// <summary>
    /// Cria uma sala de vídeo para uma solicitação.
    /// </summary>
    [HttpPost("rooms")]
    public async Task<IActionResult> CreateRoom(
        [FromBody] CreateVideoRoomRequestDto dto,
        CancellationToken cancellationToken)
    {
        var room = await videoService.CreateRoomAsync(dto, cancellationToken);
        return Ok(room);
    }

    /// <summary>
    /// Obtém uma sala de vídeo pelo ID.
    /// </summary>
    [HttpGet("rooms/{id}")]
    public async Task<IActionResult> GetRoom(
        Guid id,
        CancellationToken cancellationToken)
    {
        var room = await videoService.GetRoomAsync(id, cancellationToken);
        return Ok(room);
    }
}
