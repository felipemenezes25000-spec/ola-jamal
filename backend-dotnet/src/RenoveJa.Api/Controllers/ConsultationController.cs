using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Caching.Memory;
using RenoveJa.Api.Hubs;
using RenoveJa.Application.DTOs.Consultation;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Endpoints para transcrição e anamnese em tempo quase real durante a consulta por vídeo.
/// Suporta diarização: campo "stream" = "local" (médico) ou "remote" (paciente).
/// </summary>
[ApiController]
[Route("api/consultation")]
[Authorize(Roles = "doctor")]
public class ConsultationController(
    IRequestRepository requestRepository,
    ITranscriptionService transcriptionService,
    IConsultationAnamnesisService anamnesisService,
    IConsultationSessionStore sessionStore,
    IHubContext<VideoSignalingHub> hubContext,
    IMemoryCache memoryCache,
    ILogger<ConsultationController> logger) : ControllerBase
{
    private const string AnamnesisThrottleKeyPrefix = "consultation_anamnesis_last_";
    private static readonly TimeSpan AnamnesisThrottleInterval = TimeSpan.FromSeconds(20);
    private const int MinTranscriptLengthForAnamnesis = 200;

    /// <summary>
    /// Recebe um chunk de áudio, transcreve e acumula.
    /// Campo opcional "stream": "local" (médico) | "remote" (paciente, padrão).
    /// Transcrições são prefixadas com [Médico] ou [Paciente] para diarização.
    /// </summary>
    [HttpPost("transcribe")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> Transcribe(
        [FromForm] Guid requestId,
        [FromForm] IFormFile? file,
        [FromForm] string? stream,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null)
            return NotFound("Request not found");
        if (request.DoctorId != doctorId)
            return Forbid();
        if (request.Status != RequestStatus.InConsultation)
            return BadRequest("Consultation must be in progress to transcribe");

        if (file == null || file.Length == 0)
            return BadRequest("Audio file is required");

        await using var fileStream = file.OpenReadStream();
        using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms, cancellationToken);
        var audioBytes = ms.ToArray();

        sessionStore.EnsureSession(requestId, request.PatientId);

        var rawText = await transcriptionService.TranscribeAsync(audioBytes, file.FileName, cancellationToken);
        if (string.IsNullOrWhiteSpace(rawText))
        {
            return Ok(new { transcribed = false, message = "No speech detected or transcription unavailable." });
        }

        // Diarização: prefixar com o locutor baseado no campo "stream"
        var isLocal = string.Equals(stream, "local", StringComparison.OrdinalIgnoreCase);
        var prefix = isLocal ? "[Médico]" : "[Paciente]";
        var labeledText = $"{prefix} {rawText}";

        sessionStore.AppendTranscript(requestId, labeledText);
        var fullText = sessionStore.GetTranscript(requestId);

        var group = VideoSignalingHub.GroupName(requestId.ToString());
        await hubContext.Clients.Group(group)
            .SendAsync("TranscriptUpdate", new TranscriptUpdateDto(fullText), cancellationToken);

        // Anamnese + sugestões com throttle reduzido para 20s
        var throttleKey = AnamnesisThrottleKeyPrefix + requestId;
        if (fullText.Length >= MinTranscriptLengthForAnamnesis &&
            !memoryCache.TryGetValue(throttleKey, out _))
        {
            memoryCache.Set(throttleKey, true,
                new MemoryCacheEntryOptions().SetAbsoluteExpiration(AnamnesisThrottleInterval));

            var (previousAnamnesisJson, _) = sessionStore.GetAnamnesisState(requestId);
            _ = Task.Run(async () =>
            {
                try
                {
                    var result = await anamnesisService.UpdateAnamnesisAndSuggestionsAsync(
                        fullText, previousAnamnesisJson, CancellationToken.None);
                    if (result != null)
                    {
                        var suggestionsJson = System.Text.Json.JsonSerializer.Serialize(result.Suggestions);
                        sessionStore.UpdateAnamnesis(requestId, result.AnamnesisJson, suggestionsJson);
                        await hubContext.Clients.Group(group)
                            .SendAsync("AnamnesisUpdate", new AnamnesisUpdateDto(result.AnamnesisJson));
                        await hubContext.Clients.Group(group)
                            .SendAsync("SuggestionUpdate", new SuggestionUpdateDto(result.Suggestions));
                    }
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Anamnesis update failed for request {RequestId}", requestId);
                }
            }, CancellationToken.None);
        }

        return Ok(new { transcribed = true, text = rawText, stream = prefix, fullLength = fullText.Length });
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
