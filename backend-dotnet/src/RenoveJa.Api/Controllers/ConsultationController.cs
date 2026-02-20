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
    private static readonly TimeSpan AnamnesisThrottleInterval = TimeSpan.FromSeconds(45);
    private const int MinTranscriptLengthForAnamnesis = 300;

    /// <summary>
    /// Recebe um chunk de áudio do paciente, transcreve, acumula e envia atualizações ao médico via SignalR.
    /// Só o médico da consulta pode enviar; a solicitação deve estar em InConsultation.
    /// </summary>
    [HttpPost("transcribe")]
    [RequestSizeLimit(5 * 1024 * 1024)] // 5 MB
    public async Task<IActionResult> Transcribe(
        [FromForm] Guid requestId,
        [FromForm] IFormFile? file,
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

        await using var stream = file.OpenReadStream();
        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms, cancellationToken);
        var audioBytes = ms.ToArray();

        sessionStore.EnsureSession(requestId, request.PatientId);

        var text = await transcriptionService.TranscribeAsync(audioBytes, file.FileName, cancellationToken);
        if (string.IsNullOrWhiteSpace(text))
        {
            return Ok(new { transcribed = false, message = "No speech detected or transcription unavailable." });
        }

        sessionStore.AppendTranscript(requestId, text);
        var fullText = sessionStore.GetTranscript(requestId);

        var group = VideoSignalingHub.GroupName(requestId.ToString());
        await hubContext.Clients.Group(group).SendAsync("TranscriptUpdate", new TranscriptUpdateDto(fullText), cancellationToken);

        // Anamnese + sugestões com throttle (ex.: a cada 45 s quando há texto suficiente)
        var throttleKey = AnamnesisThrottleKeyPrefix + requestId;
        if (fullText.Length >= MinTranscriptLengthForAnamnesis &&
            !memoryCache.TryGetValue(throttleKey, out _))
        {
            memoryCache.Set(throttleKey, DateTime.UtcNow, new MemoryCacheEntryOptions().SetAbsoluteExpiration(AnamnesisThrottleInterval));
            var (previousAnamnesisJson, _) = sessionStore.GetAnamnesisState(requestId);
            var result = await anamnesisService.UpdateAnamnesisAndSuggestionsAsync(fullText, previousAnamnesisJson, cancellationToken);
            if (result != null)
            {
                var suggestionsJson = System.Text.Json.JsonSerializer.Serialize(result.Suggestions);
                sessionStore.UpdateAnamnesis(requestId, result.AnamnesisJson, suggestionsJson);
                await hubContext.Clients.Group(group).SendAsync("AnamnesisUpdate", new AnamnesisUpdateDto(result.AnamnesisJson), cancellationToken);
                await hubContext.Clients.Group(group).SendAsync("SuggestionUpdate", new SuggestionUpdateDto(result.Suggestions), cancellationToken);
            }
        }

        return Ok(new { transcribed = true, text, fullLength = fullText.Length });
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
