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
    private readonly CidLlmValidator _cidValidator;
    private readonly IClinicalEvidenceService _evidenceService;
    private readonly ILogger<ConsultationAnamnesisService> _logger;
    private readonly IAiInteractionLogRepository _aiInteractionLogRepository;

    public ConsultationAnamnesisService(
        ConsultationAnamnesisLlmClient llmClient,
        CidLlmValidator cidValidator,
        IClinicalEvidenceService evidenceService,
        ILogger<ConsultationAnamnesisService> logger,
        IAiInteractionLogRepository aiInteractionLogRepository)
    {
        _llmClient = llmClient;
        _cidValidator = cidValidator;
        _evidenceService = evidenceService;
        _logger = logger;
        _aiInteractionLogRepository = aiInteractionLogRepository;
    }

    public async Task<ConsultationAnamnesisResult?> UpdateAnamnesisAndSuggestionsAsync(
        string transcriptSoFar,
        string? previousAnamnesisJson,
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

        var systemPrompt = AnamnesisPrompts.BuildSystemPromptV2();
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
            cancellationToken);

        if (composed == null)
            return null;

        // MELHORIA 2: Segundo pass — validar CID com LLM separado
        try
        {
            var cidFromResult = ExtractCidFromJson(composed.AnamnesisJson);
            if (!string.IsNullOrWhiteSpace(cidFromResult))
            {
                var diffJson = ExtractFieldFromJson(composed.AnamnesisJson, "diagnostico_diferencial");
                var validation = await _cidValidator.ValidateCidAsync(
                    transcriptSoFar, cidFromResult, diffJson, cancellationToken);

                if (!validation.IsValid)
                {
                    _logger.LogWarning("[Anamnese] CID '{Cid}' REPROVADO pelo validador LLM: {Reason}. Sugestão: {Suggested}",
                        cidFromResult, validation.Reason, validation.SuggestedCid);

                    // Substituir CID no JSON se temos sugestão válida
                    if (!string.IsNullOrWhiteSpace(validation.SuggestedCid))
                    {
                        composed = ReplaceCidInResult(composed, validation.SuggestedCid, validation.Reason, _logger);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Anamnese] Falha na validação LLM do CID — continuando com CID original.");
        }

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

    private static string? ExtractCidFromJson(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty("cid_sugerido", out var el)
                ? el.GetString()?.Trim() : null;
        }
        catch { return null; }
    }

    private static string? ExtractFieldFromJson(string json, string field)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty(field, out var el)
                ? el.GetRawText() : null;
        }
        catch { return null; }
    }

    private static ConsultationAnamnesisResult ReplaceCidInResult(
        ConsultationAnamnesisResult original, string newCid, string? reason, ILogger logger)
    {
        try
        {
            using var doc = JsonDocument.Parse(original.AnamnesisJson);
            var root = doc.RootElement;
            var dict = new Dictionary<string, string>();

            foreach (var prop in root.EnumerateObject())
            {
                if (prop.Name == "cid_sugerido")
                    dict[prop.Name] = JsonSerializer.Serialize(newCid);
                else if (prop.Name == "confianca_cid")
                    dict[prop.Name] = JsonSerializer.Serialize("baixa");
                else
                    dict[prop.Name] = prop.Value.GetRawText();
            }

            // Adicionar motivo da correção
            dict["cid_correcao_motivo"] = JsonSerializer.Serialize(reason ?? "CID reprovado pelo validador LLM");

            var newJson = "{" + string.Join(",", dict.Select(kv => $"\"{kv.Key}\":{kv.Value}")) + "}";
            logger.LogInformation("[Anamnese] CID substituído pelo validador LLM: {NewCid}", newCid);
            return new ConsultationAnamnesisResult(newJson, original.Suggestions, original.Evidence);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[Anamnese] Falha ao substituir CID — mantendo original.");
            return original;
        }
    }
}
