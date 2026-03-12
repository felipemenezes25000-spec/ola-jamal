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
        logger.LogInformation("[Transcribe] INICIO RequestId={RequestId} | file={FileLen} | stream={Stream}",
            requestId, file?.Length ?? 0, stream ?? "(null)");

        var userId = GetUserId();
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null)
        {
            logger.LogWarning("[Transcribe] Request não encontrado. RequestId={RequestId}", requestId);
            return NotFound("Request not found");
        }
        var isDoctor = request.DoctorId == userId;
        var isPatient = request.PatientId == userId;
        if (!isDoctor && !isPatient)
        {
            logger.LogWarning("[Transcribe] Usuário não autorizado. RequestId={RequestId} UserId={UserId}", requestId, userId);
            return Forbid();
        }

        if (request.RequestType != RequestType.Consultation)
        {
            logger.LogWarning("[Transcribe] Tipo de request inválido. RequestId={RequestId} Type={Type}", requestId, request.RequestType);
            return BadRequest("Only consultation requests support transcription");
        }

        var canTranscribe = request.Status == RequestStatus.InConsultation || request.Status == RequestStatus.Paid;
        if (!canTranscribe)
        {
            logger.LogWarning("[Transcribe] TRANSCRICAO_NAO_OCORRE: Status da consulta inválido. RequestId={RequestId} Status={Status} (exige InConsultation ou Paid)",
                requestId, request.Status);
            return BadRequest("Consultation must be paid or in progress to transcribe");
        }

        if (file == null || file.Length == 0)
        {
            logger.LogWarning("[Transcribe] TRANSCRICAO_NAO_OCORRE: Chunk de áudio ausente ou vazio. RequestId={RequestId}", requestId);
            return BadRequest("Audio file is required");
        }

        logger.LogInformation("[Transcribe] Processando áudio: RequestId={RequestId} Size={Size} FileName={FileName}",
            requestId, file.Length, file.FileName ?? "(null)");

        await using var fileStream = file.OpenReadStream();
        using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms, cancellationToken);
        var audioBytes = ms.ToArray();

        sessionStore.EnsureSession(requestId, request.PatientId);
        logger.LogDebug("[Transcribe] Sessão garantida para RequestId={RequestId}", requestId);

        var currentTranscript = sessionStore.GetTranscript(requestId);
        var rawText = await transcriptionService.TranscribeAsync(audioBytes, file.FileName, currentTranscript, cancellationToken);
        if (string.IsNullOrWhiteSpace(rawText))
        {
            logger.LogWarning("[Transcribe] TRANSCRICAO_NAO_OCORRE: Whisper retornou vazio. RequestId={RequestId} | Verifique logs [Whisper] para causa (OpenAI key, áudio sem fala, etc.)",
                requestId);
            return Ok(new { transcribed = false, message = "No speech detected or transcription unavailable." });
        }

        logger.LogInformation("[Transcribe] Transcrição recebida: RequestId={RequestId} TextLength={Len}",
            requestId, rawText.Length);

        var prefix = isPatient ? "[Paciente]" : (string.Equals(stream, "local", StringComparison.OrdinalIgnoreCase) ? "[Médico]" : "[Paciente]");
        var labeledText = $"{prefix} {rawText}";

        sessionStore.AppendTranscript(requestId, labeledText);
        var fullText = sessionStore.GetTranscript(requestId);

        var group = VideoSignalingHub.GroupName(requestId.ToString());
        await hubContext.Clients.Group(group)
            .SendAsync("TranscriptUpdate", new TranscriptUpdateDto(fullText), cancellationToken);

        var throttleKey = AnamnesisThrottleKeyPrefix + requestId;
        var canRunAnamnesis = fullText.Length >= MinTranscriptLengthForAnamnesis;
        var throttleActive = memoryCache.TryGetValue(throttleKey, out _);

        logger.LogInformation("[Transcribe] Anamnese IA: RequestId={RequestId} fullTextLen={Len} minRequerido={Min} canRun={CanRun} throttleActive={Throttle}",
            requestId, fullText.Length, MinTranscriptLengthForAnamnesis, canRunAnamnesis, throttleActive);

        if (canRunAnamnesis && !throttleActive)
        {
            memoryCache.Set(throttleKey, true,
                new MemoryCacheEntryOptions().SetAbsoluteExpiration(AnamnesisThrottleInterval));

            var (previousAnamnesisJson, _) = sessionStore.GetAnamnesisState(requestId);
            logger.LogInformation("[Transcribe] Disparando anamnese IA: RequestId={RequestId} previousAnamnesisLen={PrevLen}",
                requestId, previousAnamnesisJson?.Length ?? 0);

            _ = Task.Run(async () =>
            {
                try
                {
                    var result = await anamnesisService.UpdateAnamnesisAndSuggestionsAsync(
                        fullText, previousAnamnesisJson, CancellationToken.None);
                    if (result != null)
                    {
                        var suggestionsJson = System.Text.Json.JsonSerializer.Serialize(result.Suggestions);
                        var evidenceJson = result.Evidence.Count > 0
                            ? System.Text.Json.JsonSerializer.Serialize(result.Evidence.Select(e => new
                            {
                                provider = e.Provider,
                                url = e.Url,
                                title = e.Title,
                                source = e.Source,
                                translatedAbstract = e.TranslatedAbstract,
                                clinicalRelevance = e.ClinicalRelevance,
                                relevantExcerpts = e.RelevantExcerpts
                            }))
                            : null;
                        sessionStore.UpdateAnamnesis(requestId, result.AnamnesisJson, suggestionsJson, evidenceJson);
                        await hubContext.Clients.Group(group)
                            .SendAsync("AnamnesisUpdate", new AnamnesisUpdateDto(result.AnamnesisJson));
                        await hubContext.Clients.Group(group)
                            .SendAsync("SuggestionUpdate", new SuggestionUpdateDto(result.Suggestions));
                        if (result.Evidence.Count > 0)
                        {
                            await hubContext.Clients.Group(group)
                                .SendAsync("EvidenceUpdate", new EvidenceUpdateDto(result.Evidence));
                        }
                        logger.LogInformation("[Transcribe] Anamnese IA OK: RequestId={RequestId} suggestions={Count} evidence={EvidenceCount}",
                            requestId, result.Suggestions.Count, result.Evidence.Count);
                    }
                    else
                    {
                        logger.LogWarning("[Transcribe] ANAMNESE_NAO_OCORRE: Serviço retornou null. RequestId={RequestId} | Verifique logs [Anamnese IA] para causa (OpenAI key, API error, parse JSON)",
                            requestId);
                    }
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "[Transcribe] ANAMNESE_NAO_OCORRE: Exceção ao atualizar anamnese. RequestId={RequestId}", requestId);
                }
            }, CancellationToken.None);
        }
        else if (!canRunAnamnesis)
        {
            logger.LogInformation("[Transcribe] Anamnese IA aguardando: transcript com {Len} chars (mínimo {Min}). RequestId={RequestId}",
                fullText.Length, MinTranscriptLengthForAnamnesis, requestId);
        }

        return Ok(new { transcribed = true, text = rawText, stream = prefix, fullLength = fullText.Length });
    }

    /// <summary>
    /// Recebe texto já transcrito (Daily.co nativo no cliente). Usado quando transcrição é feita no app.
    /// O médico envia chunks de texto com speaker (medico|paciente); acumula e propaga via SignalR.
    /// </summary>
    [HttpPost("transcribe-text")]
    public async Task<IActionResult> TranscribeText(
        [FromBody] TranscribeTextRequestDto dto,
        CancellationToken cancellationToken)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.Text))
        {
            logger.LogWarning("[TranscribeText] Texto ausente ou vazio.");
            return BadRequest(new { message = "Text is required" });
        }
        if (dto.RequestId == Guid.Empty)
        {
            logger.LogWarning("[TranscribeText] RequestId inválido.");
            return BadRequest(new { message = "RequestId is required" });
        }

        var requestId = dto.RequestId;
        logger.LogInformation("[TranscribeText] INICIO RequestId={RequestId} | textLen={Len} | speaker={Speaker}",
            requestId, dto.Text.Length, dto.Speaker ?? "(null)");

        var userId = GetUserId();
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null)
        {
            logger.LogWarning("[TranscribeText] Request não encontrado. RequestId={RequestId}", requestId);
            return NotFound(new { message = "Request not found" });
        }
        var isDoctor = request.DoctorId == userId;
        var isPatient = request.PatientId == userId;
        if (!isDoctor && !isPatient)
        {
            logger.LogWarning("[TranscribeText] Usuário não autorizado. RequestId={RequestId} UserId={UserId}", requestId, userId);
            return Forbid();
        }

        if (request.RequestType != RequestType.Consultation)
        {
            logger.LogWarning("[TranscribeText] Tipo de request inválido. RequestId={RequestId} Type={Type}", requestId, request.RequestType);
            return BadRequest(new { message = "Only consultation requests support transcription" });
        }

        var canTranscribe = request.Status == RequestStatus.InConsultation || request.Status == RequestStatus.Paid;
        if (!canTranscribe)
        {
            logger.LogWarning("[TranscribeText] Status inválido. RequestId={RequestId} Status={Status}", requestId, request.Status);
            return BadRequest(new { message = "Consultation must be paid or in progress to transcribe" });
        }

        var prefix = string.Equals(dto.Speaker, "medico", StringComparison.OrdinalIgnoreCase) ? "[Médico]" : "[Paciente]";
        var labeledText = $"{prefix} {dto.Text.Trim()}";

        sessionStore.EnsureSession(requestId, request.PatientId);
        sessionStore.AppendTranscript(requestId, labeledText, dto.StartTimeSeconds);
        var fullText = sessionStore.GetTranscript(requestId);

        var group = VideoSignalingHub.GroupName(requestId.ToString());
        await hubContext.Clients.Group(group)
            .SendAsync("TranscriptUpdate", new TranscriptUpdateDto(fullText), cancellationToken);

        var throttleKey = AnamnesisThrottleKeyPrefix + requestId;
        var canRunAnamnesis = fullText.Length >= MinTranscriptLengthForAnamnesis;
        var throttleActive = memoryCache.TryGetValue(throttleKey, out _);

        if (canRunAnamnesis && !throttleActive)
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
                        var evidenceJson = result.Evidence.Count > 0
                            ? System.Text.Json.JsonSerializer.Serialize(result.Evidence.Select(e => new
                            {
                                provider = e.Provider,
                                url = e.Url,
                                title = e.Title,
                                source = e.Source,
                                translatedAbstract = e.TranslatedAbstract,
                                clinicalRelevance = e.ClinicalRelevance,
                                relevantExcerpts = e.RelevantExcerpts
                            }))
                            : null;
                        sessionStore.UpdateAnamnesis(requestId, result.AnamnesisJson, suggestionsJson, evidenceJson);
                        await hubContext.Clients.Group(group)
                            .SendAsync("AnamnesisUpdate", new AnamnesisUpdateDto(result.AnamnesisJson));
                        await hubContext.Clients.Group(group)
                            .SendAsync("SuggestionUpdate", new SuggestionUpdateDto(result.Suggestions));
                        if (result.Evidence.Count > 0)
                        {
                            await hubContext.Clients.Group(group)
                                .SendAsync("EvidenceUpdate", new EvidenceUpdateDto(result.Evidence));
                        }
                        logger.LogInformation("[TranscribeText] Anamnese IA OK: RequestId={RequestId} suggestions={Count}",
                            requestId, result.Suggestions.Count);
                    }
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "[TranscribeText] Exceção ao atualizar anamnese. RequestId={RequestId}", requestId);
                }
            }, CancellationToken.None);
        }

        return Ok(new { ok = true, fullLength = fullText.Length });
    }

    /// <summary>
    /// Endpoint de teste de transcrição (apenas Development).
    /// Aceita um arquivo de áudio e retorna o resultado da transcrição (OpenAI Whisper), sem precisar de consulta ativa.
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

        var rawText = await transcriptionService.TranscribeAsync(audioBytes, file.FileName, null, cancellationToken);
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
