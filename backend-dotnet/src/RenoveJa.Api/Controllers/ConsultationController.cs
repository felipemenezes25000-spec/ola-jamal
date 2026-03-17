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
    IStorageService storageService,
    ILogger<ConsultationController> logger) : ControllerBase
{
    private const string AnamnesisThrottleKeyPrefix = "consultation_anamnesis_last_";
    private static readonly TimeSpan AnamnesisThrottleInterval = TimeSpan.FromMinutes(1);
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
        [FromForm] string? requestIdRaw,
        [FromForm] IFormFile? file,
        [FromForm] string? stream,
        CancellationToken cancellationToken)
    {
        logger.LogInformation("[Transcribe] INICIO requestIdRaw={RequestIdRaw} | fileLen={FileLen} fileName={FileName} stream={Stream}",
            requestIdRaw ?? "(null)", file?.Length ?? 0, file?.FileName ?? "(null)", stream ?? "(null)");

        if (string.IsNullOrWhiteSpace(requestIdRaw))
        {
            logger.LogWarning("[Transcribe] 400: requestId ausente ou vazio. requestIdRaw={RequestIdRaw}", requestIdRaw ?? "(null)");
            return BadRequest(new { message = "RequestId is required", code = "invalid_request_id" });
        }

        if (!Guid.TryParse(requestIdRaw, out var requestId))
        {
            logger.LogWarning("[Transcribe] 400: requestId com formato inválido (exige UUID). requestIdRaw={RequestIdRaw}", requestIdRaw);
            return BadRequest(new { message = "RequestId must be a valid UUID", code = "invalid_request_id_format" });
        }

        var userId = GetUserId();
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null)
        {
            logger.LogWarning("[Transcribe] 404: Request não encontrado. RequestId={RequestId}", requestId);
            return NotFound(new { message = "Request not found", code = "request_not_found" });
        }
        var isDoctor = request.DoctorId == userId;
        var isPatient = request.PatientId == userId;
        if (!isDoctor && !isPatient)
        {
            logger.LogWarning("[Transcribe] 403: Usuário não autorizado. RequestId={RequestId} UserId={UserId}", requestId, userId);
            return Forbid();
        }

        if (request.RequestType != RequestType.Consultation)
        {
            logger.LogWarning("[Transcribe] 400: Tipo de request inválido. RequestId={RequestId} Type={Type} (exige Consultation)", requestId, request.RequestType);
            return BadRequest(new { message = "Only consultation requests support transcription", code = "invalid_request_type" });
        }

        var canTranscribe = request.Status == RequestStatus.InConsultation || request.Status == RequestStatus.Paid;
        if (!canTranscribe)
        {
            logger.LogWarning("[Transcribe] 400 TRANSCRICAO_NAO_OCORRE: Status inválido. RequestId={RequestId} Status={Status} (exige InConsultation ou Paid)",
                requestId, request.Status);
            return BadRequest(new { message = "Consultation must be paid or in progress to transcribe", code = "invalid_consultation_status" });
        }

        if (file == null || file.Length == 0)
        {
            logger.LogWarning("[Transcribe] 400 TRANSCRICAO_NAO_OCORRE: Chunk de áudio ausente ou vazio. RequestId={RequestId} fileNull={FileNull} fileLen={FileLen}",
                requestId, file == null, file?.Length ?? 0);
            return BadRequest(new { message = "Audio file is required", code = "audio_file_required" });
        }

        logger.LogInformation("[Transcribe] Processando áudio: RequestId={RequestId} Size={Size} FileName={FileName}",
            requestId, file.Length, file.FileName ?? "(null)");

        await using var fileStream = file.OpenReadStream();
        using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms, cancellationToken);
        var audioBytes = ms.ToArray();

        // Gravação de áudio na AWS (bucket de transcrições/gravações)
        var fileName = file.FileName ?? "";
        var ext = string.IsNullOrEmpty(Path.GetExtension(fileName)) ? "webm" : Path.GetExtension(fileName).TrimStart('.');
        var recordingPath = $"consultas/{requestId:N}/gravacao-chunks/{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}.{ext}";
        var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? "audio/webm" : file.ContentType;
        try
        {
            var uploadResult = await storageService.UploadAsync(recordingPath, audioBytes, contentType, cancellationToken);
            if (!uploadResult.Success)
                logger.LogWarning("[Transcribe] Gravação não enviada à AWS: RequestId={RequestId} Path={Path} Error={Error}", requestId, recordingPath, uploadResult.ErrorMessage);
            else
                logger.LogInformation("[Transcribe] Gravação enviada à AWS: RequestId={RequestId} Path={Path}", requestId, recordingPath);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[Transcribe] Falha ao enviar gravação à AWS: RequestId={RequestId}", requestId);
        }

        sessionStore.EnsureSession(requestId, request.PatientId);
        logger.LogDebug("[Transcribe] Sessão garantida para RequestId={RequestId}", requestId);

        var currentTranscript = sessionStore.GetTranscript(requestId);
        var rawText = await transcriptionService.TranscribeAsync(audioBytes, file.FileName, currentTranscript, cancellationToken);
        if (string.IsNullOrWhiteSpace(rawText))
        {
            logger.LogWarning("[Transcribe] TRANSCRICAO_NAO_OCORRE: transcrição retornou vazio. RequestId={RequestId} | Transcrição em consulta é feita pelo Daily.co (Deepgram).",
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

            // Fire-and-forget sem Task.Run — evita thread pool starvation em ASP.NET Core
            _ = ((Func<Task>)(async () =>
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
            }))();
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

            // Fire-and-forget sem Task.Run
            _ = ((Func<Task>)(async () =>
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
            }))();
        }

        return Ok(new { ok = true, fullLength = fullText.Length });
    }

    /// <summary>
    /// Endpoint de teste de anamnese (apenas Development).
    /// Aceita transcript e retorna anamnese gerada pela IA (Gemini/OpenAI).
    /// </summary>
    [AllowAnonymous]
    [HttpPost("anamnesis-test")]
    public async Task<IActionResult> AnamnesisTest(
        [FromBody] AnamnesisTestRequestDto? dto,
        CancellationToken cancellationToken)
    {
        var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        if (!string.Equals(env, "Development", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning("[AnamnesisTest] Endpoint não disponível fora de Development.");
            return NotFound();
        }

        if (dto == null || string.IsNullOrWhiteSpace(dto.Transcript))
        {
            return BadRequest(new { error = "Transcript obrigatório. Ex: {\"transcript\": \"[Paciente] Dor de cabeça há 3 dias.\"}" });
        }

        var transcript = dto.Transcript.Trim();
        if (transcript.Length < 100)
        {
            return BadRequest(new { error = "Transcript muito curto (mínimo 100 caracteres para teste significativo)" });
        }

        logger.LogInformation("[AnamnesisTest] INICIO transcriptLen={Len}", transcript.Length);

        try
        {
            var result = await anamnesisService.UpdateAnamnesisAndSuggestionsAsync(
                transcript, dto.PreviousAnamnesisJson, cancellationToken);

            if (result == null)
            {
                logger.LogWarning("[AnamnesisTest] Serviço retornou null (verifique Gemini__ApiKey ou OpenAI__ApiKey)");
                return Ok(new
                {
                    success = false,
                    message = "Anamnese não gerada. Verifique logs e chaves de API (Gemini__ApiKey ou OpenAI__ApiKey)."
                });
            }

            logger.LogInformation("[AnamnesisTest] SUCESSO anamnesisLen={Len} suggestions={Count}",
                result.AnamnesisJson.Length, result.Suggestions.Count);

            return Ok(new
            {
                success = true,
                anamnesisJson = result.AnamnesisJson,
                suggestions = result.Suggestions,
                evidenceCount = result.Evidence.Count
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[AnamnesisTest] Exceção ao gerar anamnese");
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    /// <summary>
    /// Endpoint de teste de transcrição (apenas Development).
    /// Aceita um arquivo de áudio. Transcrição em consulta é feita pelo Daily.co (Deepgram).
    /// Este endpoint retorna vazio — use apenas para testes de compatibilidade.
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
