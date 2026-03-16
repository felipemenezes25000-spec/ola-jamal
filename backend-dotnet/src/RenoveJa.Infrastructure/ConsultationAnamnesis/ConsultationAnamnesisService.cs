using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Consultation;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Domain.ValueObjects;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// Serviço de anamnese estruturada e sugestões clínicas por IA (GPT-4o/Gemini) durante a consulta.
/// v2: Prompt enriquecido com diagnóstico diferencial, CID-10 validado, medicamentos com
/// interações/contraindicações, exames com código TUSS, classificação de gravidade,
/// orientações ao paciente e critérios de retorno.
/// Atua como copiloto: a decisão final é sempre do médico.
/// Suporta múltiplos providers (Gemini, OpenAI) via endpoint OpenAI-compatible.
/// Gemini 2.5 Flash: melhor acurácia médica a ~1/5 do preço. Config: Gemini__ApiKey.
/// </summary>
public class ConsultationAnamnesisService : IConsultationAnamnesisService
{
    private const string OpenAiBaseUrl = "https://api.openai.com/v1";
    private const string GeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
    private const string DefaultGeminiModel = "gemini-2.5-flash";
    private const string DefaultOpenAiModel = "gpt-4o";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = false
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<OpenAIConfig> _config;
    private readonly ILogger<ConsultationAnamnesisService> _logger;
    private readonly IAiInteractionLogRepository _aiInteractionLogRepository;

    public ConsultationAnamnesisService(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        ILogger<ConsultationAnamnesisService> logger,
        IAiInteractionLogRepository aiInteractionLogRepository)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
        _aiInteractionLogRepository = aiInteractionLogRepository;
    }

    private string GetAnamnesisModel()
    {
        var specific = _config.Value?.ModelAnamnesis?.Trim();
        if (!string.IsNullOrEmpty(specific)) return specific;
        if (!string.IsNullOrEmpty(GetOpenAiApiKey())) return _config.Value?.Model ?? DefaultOpenAiModel;
        return GetGeminiApiKey() != null ? DefaultGeminiModel : (_config.Value?.Model ?? DefaultOpenAiModel);
    }

    private string? GetOpenAiApiKey()
    {
        var key = _config.Value?.ApiKey?.Trim();
        return !string.IsNullOrEmpty(key) && !key.Contains("YOUR_") && !key.Contains("_HERE") ? key : null;
    }

    private string? GetGeminiApiKey()
    {
        return _config.Value?.GeminiApiKey?.Trim() is { Length: > 0 } key
            && !key.Contains("YOUR_") && !key.Contains("_HERE")
            ? key : null;
    }

    /// <summary>Prioriza OpenAI (GPT). Fallback para Gemini quando OpenAI ausente.</summary>
    private (string apiKey, string baseUrl) ResolveProvider(string model)
    {
        var isGemini = model.StartsWith("gemini", StringComparison.OrdinalIgnoreCase);

        if (isGemini)
        {
            var geminiKey = GetGeminiApiKey();
            if (!string.IsNullOrEmpty(geminiKey))
            {
                var customUrl = _config.Value?.GeminiApiBaseUrl?.Trim();
                var baseUrl = !string.IsNullOrEmpty(customUrl) ? customUrl : GeminiBaseUrl;
                return (geminiKey, baseUrl);
            }
            _logger.LogWarning("[Anamnese] Modelo Gemini solicitado mas Gemini__ApiKey não configurada. Fallback para OpenAI.");
        }

        var openAiKey = GetOpenAiApiKey() ?? _config.Value?.ApiKey?.Trim() ?? "";
        return (openAiKey, OpenAiBaseUrl);
    }

    public async Task<ConsultationAnamnesisResult?> UpdateAnamnesisAndSuggestionsAsync(
        string transcriptSoFar,
        string? previousAnamnesisJson,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[Anamnese IA v2] INICIO transcriptLen={Len} previousAnamnesisLen={PrevLen}",
            transcriptSoFar?.Length ?? 0, previousAnamnesisJson?.Length ?? 0);

        var anamnesisModel = GetAnamnesisModel();
        var (apiKey, apiBaseUrl) = ResolveProvider(anamnesisModel);
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("[Anamnese IA v2] ANAMNESE_NAO_OCORRE: Nenhuma API key configurada (Gemini__ApiKey ou OpenAI__ApiKey).");
            return null;
        }

        if (string.IsNullOrWhiteSpace(transcriptSoFar))
        {
            _logger.LogWarning("[Anamnese IA v2] ANAMNESE_NAO_OCORRE: Transcript vazio ou nulo.");
            return null;
        }

        // ── Pré-processamento: consolida transcript ruidoso do Deepgram/Daily ──
        var processedTranscript = TranscriptPreprocessor.PreprocessTranscript(transcriptSoFar);
        _logger.LogInformation("[Anamnese IA v4] Transcript preprocessado: originalLen={OrigLen} processedLen={ProcLen}",
            transcriptSoFar.Length, processedTranscript.Length);

        var systemPrompt = AnamnesisPrompts.BuildSystemPromptV2();

        // ── User message: com instrução de reconstrução + raciocínio clínico explícito ──
        var transcriptBlock = $@"═══ TRANSCRIPT DA CONSULTA (pré-processado, linhas consolidadas por locutor) ═══

{processedTranscript}

═══ FIM DO TRANSCRIPT ═══";

        var reasoningInstruction = @"
═══ INSTRUÇÕES OBRIGATÓRIAS ANTES DE GERAR O JSON ═══

ETAPA 1 — RECONSTRUÇÃO: O transcript vem de reconhecimento de fala (Deepgram/Daily) e contém ERROS FONÉTICOS. Reconstrua mentalmente o que o paciente QUIS dizer. Exemplos comuns:
- ""saúde não teu pressão alta"" → ""não tenho pressão alta""
- ""pescoço macho"" → ""pescoço, acho""
- ""de bar"" → ""daqui debaixo""
- ""mu"" → ""nuca"" (região cervical posterior)
- ""talk aguda de querida"" → ""toxoplasmose aguda adquirida""
- ""uma mono de"" → ""mononucleose""
Leia com olhos clínicos: interprete o SENTIDO MÉDICO, não a literalidade.

ETAPA 2 — EXTRAÇÃO DE DADOS CLÍNICOS: Antes de definir QUALQUER CID, liste mentalmente:
• Quais SINTOMAS o paciente relatou? (duração, localização, intensidade, caráter)
• Quais SINAIS foram mencionados? (febre, inchaço, etc.)
• Qual a HISTÓRIA EPIDEMIOLÓGICA? (contato com animais, viagens, exposições)
• O que o paciente NEGA? (nega hipertensão, nega medicamentos, nega alergias)
• O que o MÉDICO comentou no final? (diagnósticos, CIDs mencionados verbalmente)

ETAPA 3 — RACIOCÍNIO DIAGNÓSTICO: Com os dados extraídos, raciocine:
• Qual SISTEMA/ÓRGÃO está envolvido? (apenas os que o paciente MENCIONOU)
• Quais HIPÓTESES explicam TODOS os achados juntos?
• Qual dado epidemiológico é CHAVE para o diagnóstico diferencial?
• O CID deve cobrir o quadro COMPLETO, não apenas um sintoma isolado.

SOMENTE DEPOIS das 3 etapas, gere o JSON com cid_sugerido coerente.";

        string userContent;
        if (string.IsNullOrWhiteSpace(previousAnamnesisJson))
        {
            userContent = $@"{reasoningInstruction}

{transcriptBlock}";
        }
        else
        {
            userContent = $@"{reasoningInstruction}

ANAMNESE ANTERIOR (use como REFERÊNCIA, mas RECALCULE TUDO — especialmente cid_sugerido e diagnostico_diferencial — do ZERO com base no transcript completo abaixo. O CID anterior pode estar ERRADO. Não o preserve por inércia.):
{previousAnamnesisJson}

REGRA ABSOLUTA: Ignore o cid_sugerido anterior. Derive o CID EXCLUSIVAMENTE do transcript abaixo, seguindo as 3 etapas acima.

{transcriptBlock}";
        }

        var isGemini = anamnesisModel.StartsWith("gemini", StringComparison.OrdinalIgnoreCase);
        var requestBody = new
        {
            model = anamnesisModel,
            messages = new object[]
            {
                new { role = "system", content = (object)systemPrompt },
                new { role = "user", content = (object)userContent }
            },
            max_tokens = isGemini ? 8192 : 16000,
            temperature = 0.10
        };

        var startedAt = DateTime.UtcNow;
        var json = JsonSerializer.Serialize(requestBody, JsonOptions);
        var promptHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json))).ToLowerInvariant();
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        client.Timeout = isGemini ? TimeSpan.FromSeconds(90) : TimeSpan.FromSeconds(50);

        using var requestContent = new StringContent(json, Encoding.UTF8, "application/json");
        _logger.LogInformation("[Anamnese IA v2] Chamando {Provider}: model={Model} (anamnese)",
            anamnesisModel.StartsWith("gemini", StringComparison.OrdinalIgnoreCase) ? "Gemini" : "OpenAI", anamnesisModel);

        var response = await client.PostAsync($"{apiBaseUrl}/chat/completions", requestContent, cancellationToken);
        var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("[Anamnese IA v2] Gemini/IA error StatusCode={StatusCode} model={Model}", response.StatusCode, anamnesisModel);
            try
            {
                await _aiInteractionLogRepository.LogAsync(AiInteractionLog.Create(
                    serviceName: nameof(ConsultationAnamnesisService),
                    modelName: anamnesisModel,
                    promptHash: promptHash,
                    success: false,
                    durationMs: (long)(DateTime.UtcNow - startedAt).TotalMilliseconds,
                    errorMessage: responseJson.Length > 500 ? responseJson[..500] : responseJson), cancellationToken);
            }
            catch (Exception logEx)
            {
                _logger.LogWarning(logEx, "[Anamnese IA v2] Falha ao gravar log de erro.");
            }
            // Fallback: se OpenAI (GPT) falhou e Gemini está configurada, tenta com gemini-2.5-flash
            var usedOpenAi = anamnesisModel.StartsWith("gpt", StringComparison.OrdinalIgnoreCase);
            var geminiKey = GetGeminiApiKey();
            if (usedOpenAi && !string.IsNullOrEmpty(geminiKey))
            {
                _logger.LogInformation("[Anamnese IA v2] Fallback para Gemini após falha OpenAI.");
                var fallbackModel = DefaultGeminiModel;
                var geminiUrl = !string.IsNullOrWhiteSpace(_config.Value?.GeminiApiBaseUrl)
                    ? _config.Value!.GeminiApiBaseUrl!.Trim()
                    : GeminiBaseUrl;
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", geminiKey);
                using var fallbackContent = new StringContent(
                    JsonSerializer.Serialize(new { model = fallbackModel, messages = requestBody.messages, max_tokens = 8192, temperature = 0.10 }, JsonOptions),
                    Encoding.UTF8, "application/json");
                var fallbackResponse = await client.PostAsync($"{geminiUrl}/chat/completions", fallbackContent, cancellationToken);
                var fallbackJson = await fallbackResponse.Content.ReadAsStringAsync(cancellationToken);
                if (fallbackResponse.IsSuccessStatusCode)
                {
                    responseJson = fallbackJson;
                    anamnesisModel = fallbackModel;
                }
                else
                {
                    _logger.LogWarning("[Anamnese IA v2] Fallback Gemini também falhou: {StatusCode}", fallbackResponse.StatusCode);
                    return null;
                }
            }
            else
            {
                return null;
            }
        }

        string? content = null;
        try
        {
            using var doc = JsonDocument.Parse(responseJson);
            var choices = doc.RootElement.GetProperty("choices");
            if (choices.GetArrayLength() > 0)
                content = choices[0].GetProperty("message").GetProperty("content").GetString();
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
        try
        {
            using var parsed = JsonDocument.Parse(cleaned);
            var root = parsed.RootElement;

            // Build enriched anamnesis JSON for frontend
            var enrichedObj = new Dictionary<string, object>();

            // Copy all anamnesis fields
            if (root.TryGetProperty("anamnesis", out var anaEl) && anaEl.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in anaEl.EnumerateObject())
                    enrichedObj[prop.Name] = prop.Value.GetRawText();
            }

            // Top-level fields (CID validado contra base local ICD/CID-10)
            var cidRaw = root.TryGetProperty("cid_sugerido", out var cidEl) ? cidEl.GetString()?.Trim() ?? "" : "";
            if (!string.IsNullOrEmpty(cidRaw))
            {
                var cidValidado = Cid10Database.IsValid(cidRaw)
                    ? cidRaw
                    : Cid10Database.Search(cidRaw, 1).FirstOrDefault()?.Code ?? cidRaw;
                enrichedObj["cid_sugerido"] = JsonSerializer.Serialize(cidValidado);
                if (Cid10Database.GetDescription(cidValidado) is { } desc)
                    enrichedObj["cid_descricao"] = JsonSerializer.Serialize(desc);
            }
            else
            {
                AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "cid_sugerido");
            }
            AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "confianca_cid");
            AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "raciocinio_clinico");
            AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "denominador_comum");
            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "alertas_vermelhos");
            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "diagnostico_diferencial");
            AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "classificacao_gravidade");
            AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "exame_fisico_dirigido");
            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "orientacoes_paciente");
            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "criterios_retorno");
            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "perguntas_sugeridas");
            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "lacunas_anamnese");

            // Medicamentos, exames e interações cruzadas
            var hasClinicalContext = AnamnesisResponseParser.HasClinicalContext(root);
            var medicamentosRaw = AnamnesisResponseParser.ParseMedicamentosSugeridosV2(root, hasClinicalContext);
            enrichedObj["medicamentos_sugeridos"] = medicamentosRaw;

            var examesRaw = AnamnesisResponseParser.ParseExamesSugeridosV2(root, hasClinicalContext);
            enrichedObj["exames_sugeridos"] = examesRaw;

            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "interacoes_cruzadas");

            // ═══ FALLBACKS: garantir que dados nunca fiquem vazios ═══
            AnamnesisResponseParser.EnsurePerguntasFallback(root, enrichedObj, transcriptSoFar);
            AnamnesisResponseParser.EnsureSuggestionsFallback(root, enrichedObj, hasClinicalContext);

            var enrichedJson = "{" + string.Join(",", enrichedObj.Select(kv => $"\"{kv.Key}\":{kv.Value}")) + "}";

            // Extract suggestions list — SEMPRE retornar algo (fallback garante sugestões funcionarem sempre)
            var suggestions = AnamnesisResponseParser.ExtractSuggestions(root);
            if (suggestions.Count == 0 && enrichedObj.TryGetValue("suggestions_fallback", out var fbVal))
            {
                try
                {
                    var fallback = JsonSerializer.Deserialize<List<string>>(fbVal.ToString() ?? "[]");
                    if (fallback?.Count > 0)
                        suggestions.AddRange(fallback);
                }
                catch { /* ignore */ }
            }
            if (suggestions.Count == 0)
            {
                suggestions.Add("Avaliação inicial — aguardando mais dados da anamnese para refinar HD e conduta.");
            }

            try
            {
                await _aiInteractionLogRepository.LogAsync(AiInteractionLog.Create(
                    serviceName: nameof(ConsultationAnamnesisService),
                    modelName: anamnesisModel,
                    promptHash: promptHash,
                    success: true,
                    responseSummary: cleaned.Length > 500 ? cleaned[..500] : cleaned,
                    durationMs: (long)(DateTime.UtcNow - startedAt).TotalMilliseconds), cancellationToken);
            }
            catch (Exception logEx)
            {
                _logger.LogWarning(logEx, "[Anamnese IA v2] Falha ao gravar log.");
            }

            _logger.LogInformation("[Anamnese IA v2] SUCESSO: anamnesisLen={Len} suggestions={Count} durationMs={Ms}",
                enrichedJson.Length, suggestions.Count, (long)(DateTime.UtcNow - startedAt).TotalMilliseconds);

            return new ConsultationAnamnesisResult(enrichedJson, suggestions, Array.Empty<EvidenceItemDto>());
        }
        catch (Exception ex)
        {
            var preview = cleaned.Length > 400 ? cleaned[..400] + "..." : cleaned;
            _logger.LogWarning(ex, "[Anamnese IA v2] Falha ao parsear JSON de resposta. Preview={Preview}", preview);
            return null;
        }
    }

}
