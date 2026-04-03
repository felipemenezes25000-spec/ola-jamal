using System.Text.Json;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.DTOs.Consultation;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// Orquestra pré-processamento de transcript, prompts e chamada ao modelo (delegada a <see cref="ConsultationAnamnesisLlmClient"/>).
/// </summary>
public class ConsultationAnamnesisService : IConsultationAnamnesisService
{
    private readonly ConsultationAnamnesisLlmClient _llmClient;
    private readonly IClinicalEvidenceService _evidenceService;
    private readonly ILogger<ConsultationAnamnesisService> _logger;
    private readonly IAiInteractionLogRepository _aiInteractionLogRepository;

    public ConsultationAnamnesisService(
        ConsultationAnamnesisLlmClient llmClient,
        IClinicalEvidenceService evidenceService,
        ILogger<ConsultationAnamnesisService> logger,
        IAiInteractionLogRepository aiInteractionLogRepository)
    {
        _llmClient = llmClient;
        _evidenceService = evidenceService;
        _logger = logger;
        _aiInteractionLogRepository = aiInteractionLogRepository;
    }

    public async Task<ConsultationAnamnesisResult?> UpdateAnamnesisAndSuggestionsAsync(
        string transcriptSoFar,
        string? previousAnamnesisJson,
        string? consultationType = null,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[Anamnese IA v2] INICIO transcriptLen={Len} previousAnamnesisLen={PrevLen}",
            transcriptSoFar?.Length ?? 0, previousAnamnesisJson?.Length ?? 0);

        var anamnesisModel = _llmClient.GetAnamnesisModel();

        if (string.IsNullOrWhiteSpace(transcriptSoFar))
        {
            _logger.LogWarning("[Anamnese IA v2] ANAMNESE_NAO_OCORRE: Transcript vazio ou nulo.");
            return null;
        }

        var processedTranscript = TranscriptPreprocessor.PreprocessTranscript(transcriptSoFar);
        _logger.LogInformation("[Anamnese IA v4] Transcript preprocessado: originalLen={OrigLen} processedLen={ProcLen}",
            transcriptSoFar.Length, processedTranscript.Length);

        var systemPrompt = string.Equals(consultationType, "psicologo", StringComparison.OrdinalIgnoreCase)
            ? AnamnesisPrompts.BuildPsychologySystemPrompt()
            : AnamnesisPrompts.BuildSystemPromptV2();
        var userContent = AnamnesisPrompts.BuildUserContentForAnamnesisV2(processedTranscript, previousAnamnesisJson);

        var llmResult = await _llmClient.SendAnamnesisChatAsync(anamnesisModel, systemPrompt, userContent, cancellationToken);
        if (llmResult == null)
            return null;

        string? content;
        try
        {
            using var doc = JsonDocument.Parse(llmResult.ResponseJson);
            var choices = doc.RootElement.GetProperty("choices");
            content = choices.GetArrayLength() > 0
                ? choices[0].GetProperty("message").GetProperty("content").GetString()
                : null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Anamnese IA v2] Falha ao extrair content da resposta OpenAI.");
            return null;
        }

        if (string.IsNullOrWhiteSpace(content))
        {
            _logger.LogWarning("[Anamnese IA v2] OpenAI retornou content vazio.");
            return null;
        }

        var cleaned = AnamnesisResponseParser.CleanJsonResponse(content);
        var composed = await ConsultationAnamnesisResultComposer.TryComposeAsync(
            cleaned,
            transcriptSoFar,
            _logger,
            _aiInteractionLogRepository,
            llmResult.ModelUsed,
            llmResult.PromptHash,
            llmResult.StartedAt,
            cancellationToken,
            consultationType);

        if (composed == null)
            return null;

        // Buscar evidências clínicas (Cochrane/PubMed → GPT-4o validação) em background.
        // Se falhar, retorna resultado sem evidência (não bloqueia anamnese).
        IReadOnlyList<EvidenceItemDto> evidence;
        try
        {
            evidence = await _evidenceService.SearchEvidenceAsync(composed.AnamnesisJson, cancellationToken);
            _logger.LogInformation("[Anamnese IA v2] Evidências clínicas: {Count} itens encontrados.", evidence.Count);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Anamnese IA v2] Falha ao buscar evidências clínicas. Continuando sem evidência.");
            evidence = Array.Empty<EvidenceItemDto>();
        }

        return new ConsultationAnamnesisResult(composed.AnamnesisJson, composed.Suggestions, evidence);
    }

}
