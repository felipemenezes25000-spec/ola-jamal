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
[Authorize(Roles = "doctor,patient")]
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
    /// O PACIENTE envia o áudio (seu microfone) — transcrição do que o paciente fala.
    /// O médico apenas visualiza transcrição e anamnese via SignalR (fica mudo durante a consulta).
    /// Aceita médico ou paciente: paciente sempre [Paciente]; médico usa stream "local"/"remote".
    /// </summary>
    [HttpPost("transcribe")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> Transcribe(
        [FromForm] Guid requestId,
        [FromForm] IFormFile? file,
        [FromForm] string? stream,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null)
            return NotFound("Request not found");
        var isDoctor = request.DoctorId == userId;
        var isPatient = request.PatientId == userId;
        if (!isDoctor && !isPatient)
            return Forbid();
        if (request.Status != RequestStatus.InConsultation)
            return BadRequest("Consultation must be in progress to transcribe");

        if (file == null || file.Length == 0)
        {
            logger.LogWarning("[Transcribe] Chunk de áudio ausente ou vazio. RequestId={RequestId}", requestId);
            return BadRequest("Audio file is required");
        }

        logger.LogInformation("[Transcribe] Chunk recebido: RequestId={RequestId}, Size={Size}, Stream={Stream}",
            requestId, file.Length, stream ?? "(null)");

        await using var fileStream = file.OpenReadStream();
        using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms, cancellationToken);
        var audioBytes = ms.ToArray();

        sessionStore.EnsureSession(requestId, request.PatientId);

        var rawText = await transcriptionService.TranscribeAsync(audioBytes, file.FileName, cancellationToken);
        if (string.IsNullOrWhiteSpace(rawText))
        {
            logger.LogInformation("[Transcribe] Transcrição retornou vazio. RequestId={RequestId}", requestId);
            return Ok(new { transcribed = false, message = "No speech detected or transcription unavailable." });
        }

        logger.LogInformation("[Transcribe] Transcrição OK: RequestId={RequestId}, TextLength={Len}", requestId, rawText.Length);

        // Diarização: paciente sempre [Paciente]; médico usa campo stream (local=própria voz, remote=outro)
        var prefix = isPatient ? "[Paciente]" : (string.Equals(stream, "local", StringComparison.OrdinalIgnoreCase) ? "[Médico]" : "[Paciente]");
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
                        if (result.Evidence.Count > 0)
                        {
                            await hubContext.Clients.Group(group)
                                .SendAsync("EvidenceUpdate", new EvidenceUpdateDto(result.Evidence));
                        }
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

    /// <summary>
    /// Endpoint de teste de transcrição (apenas Development).
    /// Aceita um arquivo de áudio e retorna o resultado da transcrição (Deepgram), sem precisar de consulta ativa.
    /// Útil para validar OpenAI:ApiKey e o fluxo de transcrição.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("transcribe-test")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> TranscribeTest(
        [FromForm] IFormFile? file,
        CancellationToken cancellationToken)
    {
        var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        logger.LogInformation("[TranscribeTest] Requisição recebida. ASPNETCORE_ENVIRONMENT={Env}", env ?? "(null)");

        if (!string.Equals(env, "Development", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning("[TranscribeTest] Endpoint não disponível fora de Development. Retornando 404.");
            return NotFound();
        }

        if (file == null || file.Length == 0)
        {
            logger.LogWarning("[TranscribeTest] Arquivo ausente ou vazio.");
            return BadRequest(new { error = "Arquivo de áudio obrigatório" });
        }

        logger.LogInformation("[TranscribeTest] Arquivo recebido: {Name}, {Size} bytes", file.FileName, file.Length);

        await using var fileStream = file.OpenReadStream();
        using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms, cancellationToken);
        var audioBytes = ms.ToArray();

        var rawText = await transcriptionService.TranscribeAsync(audioBytes, file.FileName, cancellationToken);
        logger.LogInformation("[TranscribeTest] Resultado: transcribed={Transcribed}, textLength={Len}",
            !string.IsNullOrWhiteSpace(rawText), rawText?.Length ?? 0);

        return Ok(new
        {
            transcribed = !string.IsNullOrWhiteSpace(rawText),
            text = rawText ?? "(nenhum texto detectado)",
            fileSize = audioBytes.Length,
            fileName = file.FileName
        });
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
