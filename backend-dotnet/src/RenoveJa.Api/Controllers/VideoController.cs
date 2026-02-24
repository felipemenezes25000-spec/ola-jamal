using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Video;
using RenoveJa.Application.Services.Video;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Video;
using Microsoft.Extensions.Options;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Endpoints de videochamada usando Daily.co.
/// Substitui o WebRTC artesanal via WebView + SignalR signaling.
///
/// Fluxo:
/// 1. POST /api/video/rooms         — cria sala no Daily + grava no BD
/// 2. POST /api/video/join-token    — gera meeting token para o participante
/// 3. GET  /api/video/rooms/{id}    — consulta sala existente
/// 4. GET  /api/video/by-request/{requestId} — busca sala por request
///
/// O frontend usa o SDK nativo @daily-co/react-native-daily-js
/// para fazer join(url, token) diretamente — sem WebView.
/// </summary>
[ApiController]
[Route("api/video")]
public class VideoController(
    IVideoService videoService,
    IDailyVideoService dailyVideoService,
    IRequestRepository requestRepository,
    IUserRepository userRepository,
    IOptions<DailyConfig> dailyConfig,
    ILogger<VideoController> logger) : ControllerBase
{
    /// <summary>
    /// Cria sala de vídeo no Daily.co e persiste no banco.
    /// Idempotente: se já existir, retorna a sala existente.
    /// </summary>
    [Authorize]
    [HttpPost("rooms")]
    public async Task<IActionResult> CreateRoom(
        [FromBody] CreateVideoRoomRequestDto dto,
        CancellationToken cancellationToken)
    {
        var localRoom = await videoService.CreateRoomAsync(dto, cancellationToken);

        var config = dailyConfig.Value;
        var roomName = config.GetRoomName(dto.RequestId);

        try
        {
            var dailyRoom = await dailyVideoService.CreateRoomAsync(
                roomName,
                maxParticipants: 2,
                expiryMinutes: config.DefaultRoomExpiryMinutes,
                cancellationToken);

            return Ok(new
            {
                localRoom.Id,
                localRoom.RequestId,
                localRoom.RoomName,
                roomUrl = dailyRoom.Url,
                dailyRoomName = dailyRoom.Name,
                localRoom.Status,
                localRoom.CreatedAt,
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create Daily room for request {RequestId}", dto.RequestId);
            return StatusCode(502, new { message = "Falha ao criar sala de vídeo. Tente novamente." });
        }
    }

    /// <summary>
    /// Gera um meeting token do Daily.co para o usuário autenticado.
    /// O médico recebe is_owner=true (pode gravar, encerrar, etc.).
    /// O paciente recebe eject_after_elapsed baseado nos minutos contratados.
    /// </summary>
    [Authorize]
    [HttpPost("join-token")]
    public async Task<IActionResult> CreateJoinToken(
        [FromBody] JoinTokenRequestDto dto,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        if (user == null)
            return Unauthorized();

        var request = await requestRepository.GetByIdAsync(dto.RequestId, cancellationToken);
        if (request == null)
            return NotFound("Request not found");

        if (request.PatientId != userId && request.DoctorId != userId)
            return Forbid();

        var config = dailyConfig.Value;
        var roomName = config.GetRoomName(dto.RequestId);
        var isDoctor = request.DoctorId == userId;

        // Paciente: ejetar automaticamente após o tempo contratado + 5min buffer
        int? ejectAfterSeconds = null;
        if (!isDoctor && request.ContractedMinutes.HasValue)
        {
            ejectAfterSeconds = (request.ContractedMinutes.Value + 5) * 60;
        }

        try
        {
            var token = await dailyVideoService.CreateMeetingTokenAsync(
                roomName,
                userId.ToString(),
                user.Name,
                isOwner: isDoctor,
                ejectAfterSeconds: ejectAfterSeconds,
                cancellationToken);

            var roomUrl = $"https://{config.Domain}.daily.co/{roomName}";

            return Ok(new JoinTokenResponseDto(
                Token: token,
                RoomUrl: roomUrl,
                RoomName: roomName,
                IsOwner: isDoctor,
                ContractedMinutes: request.ContractedMinutes
            ));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create Daily meeting token for user {UserId}, request {RequestId}",
                userId, dto.RequestId);
            return StatusCode(502, new { message = "Falha ao gerar token de acesso à sala." });
        }
    }

    /// <summary>Busca sala por request ID.</summary>
    [Authorize]
    [HttpGet("by-request/{requestId:guid}")]
    public async Task<IActionResult> GetRoomByRequest(Guid requestId, CancellationToken cancellationToken)
    {
        var room = await videoService.GetRoomByRequestIdAsync(requestId, cancellationToken);
        if (room == null) return NotFound();
        return Ok(room);
    }

    /// <summary>Busca sala por ID.</summary>
    [Authorize]
    [HttpGet("rooms/{id:guid}")]
    public async Task<IActionResult> GetRoom(Guid id, CancellationToken cancellationToken)
    {
        var room = await videoService.GetRoomAsync(id, cancellationToken);
        return Ok(room);
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim, out var id) ? id : throw new UnauthorizedAccessException();
    }
}

// --- DTOs ---

public record JoinTokenRequestDto(Guid RequestId);

public record JoinTokenResponseDto(
    string Token,
    string RoomUrl,
    string RoomName,
    bool IsOwner,
    int? ContractedMinutes
);
