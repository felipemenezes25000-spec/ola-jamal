using System.Collections.Concurrent;
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
    // Bug fix #5: Simple in-memory rate limiter for room creation.
    // Key = requestId, Value = last creation timestamp.
    // Max 1 room creation per consultation per minute.
    private static readonly ConcurrentDictionary<Guid, DateTime> _roomCreationTimestamps = new();
    private static readonly TimeSpan RoomCreationCooldown = TimeSpan.FromMinutes(1);

    /// <summary>
    /// Cria sala de vídeo no Daily.co e persiste no banco.
    /// Idempotente: se já existir, retorna a sala existente.
    /// Rate limited: max 1 creation per consultation per minute.
    /// </summary>
    [Authorize]
    [HttpPost("rooms")]
    public async Task<IActionResult> CreateRoom(
        [FromBody] CreateVideoRoomRequestDto dto,
        CancellationToken cancellationToken)
    {
        // IDOR check: só participantes da consulta podem criar sala
        var userId = GetUserId();
        var request = await requestRepository.GetByIdAsync(dto.RequestId, cancellationToken);
        if (request == null)
            return NotFound(new { message = "Solicitação não encontrada." });
        if (request.PatientId != userId && request.DoctorId != userId)
            return StatusCode(403, new { error = "Acesso negado a esta consulta." });

        // Bug fix #5: Rate limit — max 1 room creation per consultation per minute.
        var now = DateTime.UtcNow;
        if (_roomCreationTimestamps.TryGetValue(dto.RequestId, out var lastCreation)
            && (now - lastCreation) < RoomCreationCooldown)
        {
            var retryAfter = (int)(RoomCreationCooldown - (now - lastCreation)).TotalSeconds + 1;
            logger.LogWarning(
                "[VideoController] Room creation rate limited — RequestId={RequestId} RetryAfterSeconds={RetryAfter}",
                dto.RequestId, retryAfter);
            Response.Headers["Retry-After"] = retryAfter.ToString();
            return StatusCode(429, new { message = "Sala já foi criada recentemente. Aguarde antes de tentar novamente.", retryAfterSeconds = retryAfter });
        }

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

            // Record successful creation timestamp for rate limiting
            _roomCreationTimestamps[dto.RequestId] = DateTime.UtcNow;

            // Periodically clean up old entries to prevent memory growth
            CleanupStaleRateLimitEntries();

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
            logger.LogError(ex,
                "[VideoController] Failed to create Daily room — RequestId={RequestId} RoomName={RoomName} UserId={UserId}",
                dto.RequestId, roomName, User.FindFirstValue(ClaimTypes.NameIdentifier));
            return StatusCode(502, new { message = "Falha ao criar sala de vídeo. Tente novamente." });
        }
    }

    /// <summary>Remove rate limit entries older than 10 minutes to prevent unbounded memory growth.</summary>
    private static void CleanupStaleRateLimitEntries()
    {
        // Only clean up occasionally (rough check — not synchronized, which is fine for a best-effort cleanup)
        if (_roomCreationTimestamps.Count < 100) return;

        var cutoff = DateTime.UtcNow.AddMinutes(-10);
        foreach (var kvp in _roomCreationTimestamps)
        {
            if (kvp.Value < cutoff)
                _roomCreationTimestamps.TryRemove(kvp.Key, out _);
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
            logger.LogError(ex,
                "[VideoController] Failed to create Daily meeting token — UserId={UserId} RequestId={RequestId} RoomName={RoomName} IsDoctor={IsDoctor}",
                userId, dto.RequestId, roomName, isDoctor);
            return StatusCode(502, new { message = "Falha ao gerar token de acesso à sala." });
        }
    }

    /// <summary>Busca sala por request ID.</summary>
    [Authorize]
    [HttpGet("by-request/{requestId:guid}")]
    public async Task<IActionResult> GetRoomByRequest(Guid requestId, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null) return NotFound();
        if (request.PatientId != userId && request.DoctorId != userId)
            return Forbid();

        var room = await videoService.GetRoomByRequestIdAsync(requestId, cancellationToken);
        if (room == null) return NotFound();
        return Ok(room);
    }

    /// <summary>Busca sala por ID. Verifica se o usuário é participante da consulta associada.</summary>
    [Authorize]
    [HttpGet("rooms/{id:guid}")]
    public async Task<IActionResult> GetRoom(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var room = await videoService.GetRoomAsync(id, cancellationToken);
        if (room == null) return NotFound();

        // IDOR fix: verify requesting user is a participant of the associated request
        var request = await requestRepository.GetByIdAsync(room.RequestId, cancellationToken);
        if (request == null || (request.PatientId != userId && request.DoctorId != userId))
            return Forbid();

        return Ok(room);
    }

    /// <summary>
    /// Cria sala de teste para transcrição via Daily.co (sem consulta ativa).
    /// Retorna roomUrl e token para o médico testar a transcrição nativa do Daily.
    /// </summary>
    [Authorize]
    [HttpPost("transcription-test-room")]
    public async Task<IActionResult> CreateTranscriptionTestRoom(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        if (user == null)
            return Unauthorized();

        var roomName = $"transcription-test-{Guid.NewGuid():N}";
        try
        {
            var dailyRoom = await dailyVideoService.CreateRoomAsync(
                roomName,
                maxParticipants: 2,
                expiryMinutes: 15,
                cancellationToken);

            string token;
            try
            {
                token = await dailyVideoService.CreateMeetingTokenAsync(
                    roomName,
                    userId.ToString(),
                    user.Name,
                    isOwner: true,
                    ejectAfterSeconds: null,
                    cancellationToken);
            }
            catch
            {
                try { await dailyVideoService.DeleteRoomAsync(roomName, cancellationToken); }
                catch (Exception cleanupEx) { logger.LogWarning(cleanupEx, "[VideoController] Failed to clean up Daily room after token failure — RoomName={RoomName}", roomName); }
                throw;
            }

            return Ok(new
            {
                roomUrl = dailyRoom.Url,
                token,
                roomName,
                expiresInMinutes = 15,
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[VideoController] Failed to create Daily transcription test room — UserId={UserId} RoomName={RoomName}", userId, roomName);
            return StatusCode(502, new { message = "Falha ao criar sala de teste. Verifique DAILY_API_KEY." });
        }
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
