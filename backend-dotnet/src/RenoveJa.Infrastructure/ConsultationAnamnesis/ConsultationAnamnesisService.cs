using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
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
    private static readonly Regex CidCodeRegex = new(@"\b([A-Z]\d{2}(?:\.\d+)?)\b", RegexOptions.Compiled);

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<OpenAIConfig> _config;
    private readonly ILogger<ConsultationAnamnesisService> _logger;
    private readonly IEvidenceSearchService _evidenceSearchService;
    private readonly IAiInteractionLogRepository _aiInteractionLogRepository;

    public ConsultationAnamnesisService(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        ILogger<ConsultationAnamnesisService> logger,
        IEvidenceSearchService evidenceSearchService,
        IAiInteractionLogRepository aiInteractionLogRepository)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
        _evidenceSearchService = evidenceSearchService;
        _aiInteractionLogRepository = aiInteractionLogRepository;
    }

    private string GetAnamnesisModel()
    {
        var specific = _config.Value?.ModelAnamnesis?.Trim();
        if (!string.IsNullOrEmpty(specific)) return specific;
        if (!string.IsNullOrEmpty(GetOpenAiApiKey())) return _config.Value?.Model ?? DefaultOpenAiModel;
        return GetGeminiApiKey() != null ? DefaultGeminiModel : (_config.Value?.Model ?? DefaultOpenAiModel);
    }

    private string GetEvidenceModel()
    {
        var specific = _config.Value?.ModelEvidence?.Trim();
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
        var processedTranscript = PreprocessTranscript(transcriptSoFar);
        _logger.LogInformation("[Anamnese IA v4] Transcript preprocessado: originalLen={OrigLen} processedLen={ProcLen}",
            transcriptSoFar.Length, processedTranscript.Length);

        var systemPrompt = BuildSystemPromptV2();

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

        var requestBody = new
        {
            model = anamnesisModel,
            messages = new object[]
            {
                new { role = "system", content = (object)systemPrompt },
                new { role = "user", content = (object)userContent }
            },
            max_tokens = 16000,
            temperature = 0.10
        };

        var startedAt = DateTime.UtcNow;
        var json = JsonSerializer.Serialize(requestBody, JsonOptions);
        var promptHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json))).ToLowerInvariant();
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        client.Timeout = TimeSpan.FromSeconds(50);

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
                    JsonSerializer.Serialize(new { model = fallbackModel, messages = requestBody.messages, max_tokens = 16000, temperature = 0.10 }, JsonOptions),
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

        var cleaned = CleanJsonResponse(content);
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
                CopyIfExists(root, enrichedObj, "cid_sugerido");
            }
            CopyIfExists(root, enrichedObj, "confianca_cid");
            CopyIfExists(root, enrichedObj, "raciocinio_clinico");
            CopyIfExists(root, enrichedObj, "denominador_comum");
            CopyArrayIfExists(root, enrichedObj, "alertas_vermelhos");
            CopyArrayIfExists(root, enrichedObj, "diagnostico_diferencial");
            CopyIfExists(root, enrichedObj, "classificacao_gravidade");
            CopyIfExists(root, enrichedObj, "exame_fisico_dirigido");
            CopyArrayIfExists(root, enrichedObj, "orientacoes_paciente");
            CopyArrayIfExists(root, enrichedObj, "criterios_retorno");
            CopyArrayIfExists(root, enrichedObj, "perguntas_sugeridas");
            CopyArrayIfExists(root, enrichedObj, "lacunas_anamnese");

            // Medicamentos, exames e interações cruzadas
            var hasClinicalContext = HasClinicalContext(root);
            var medicamentosRaw = ParseMedicamentosSugeridosV2(root, hasClinicalContext);
            enrichedObj["medicamentos_sugeridos"] = medicamentosRaw;

            var examesRaw = ParseExamesSugeridosV2(root, hasClinicalContext);
            enrichedObj["exames_sugeridos"] = examesRaw;

            CopyArrayIfExists(root, enrichedObj, "interacoes_cruzadas");

            // ═══ FALLBACKS: garantir que dados nunca fiquem vazios ═══
            EnsurePerguntasFallback(root, enrichedObj, transcriptSoFar);
            EnsureSuggestionsFallback(root, enrichedObj, hasClinicalContext);

            var enrichedJson = "{" + string.Join(",", enrichedObj.Select(kv => $"\"{kv.Key}\":{kv.Value}")) + "}";

            // Extract suggestions list — SEMPRE retornar algo (fallback garante sugestões funcionarem sempre)
            var suggestions = ExtractSuggestions(root);
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

            // Evidências científicas multi-fonte
            var evidence = await FetchAndTranslateEvidenceAsync(root, apiKey, cancellationToken, transcriptSoFar);

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

            _logger.LogInformation("[Anamnese IA v2] SUCESSO: anamnesisLen={Len} suggestions={Count} evidence={EvidCount} durationMs={Ms}",
                enrichedJson.Length, suggestions.Count, evidence.Count, (long)(DateTime.UtcNow - startedAt).TotalMilliseconds);

            return new ConsultationAnamnesisResult(enrichedJson, suggestions, evidence);
        }
        catch (Exception ex)
        {
            var preview = cleaned.Length > 400 ? cleaned[..400] + "..." : cleaned;
            _logger.LogWarning(ex, "[Anamnese IA v2] Falha ao parsear JSON de resposta. Preview={Preview}", preview);
            return null;
        }
    }

    /// <summary>
    /// Pré-processa o transcript bruto do Deepgram/Daily para facilitar a compreensão pela IA.
    /// 1. Consolida linhas consecutivas do mesmo locutor (evita fragmentação "[Paciente] Eu" "[Paciente] tenho")
    /// 2. Remove hesitações puras (linhas com apenas "É", "Eh", "Hm", "Aí", "Né", "Pronto", "Talk")
    /// 3. Remove linhas duplicadas adjacentes
    /// </summary>
    private static string PreprocessTranscript(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return raw;

        var lines = raw.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length == 0)
            return raw;

        // Hesitações puras (linhas que são só noise) — case-insensitive
        var pureHesitations = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "é", "eh", "hm", "hmm", "aí", "né", "pronto", "talk", "o", "a", "e",
            "então", "nesse", "pra", "que", "bom", "isso", "presidente", "gente",
            "qual", "pai", "uma"
        };

        var consolidated = new List<(string Speaker, string Text)>();

        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (string.IsNullOrEmpty(trimmed))
                continue;

            // Parse "[Médico] texto" or "[Paciente] texto"
            string speaker;
            string text;
            if (trimmed.StartsWith("[") && trimmed.IndexOf(']') is var closeBracket and > 0)
            {
                speaker = trimmed[1..closeBracket].Trim();
                text = trimmed[(closeBracket + 1)..].Trim();
            }
            else
            {
                speaker = "";
                text = trimmed;
            }

            // Skip pure hesitation lines
            var cleanedForCheck = text.TrimEnd('.', ',', '?', '!', ';', ':').Trim();
            if (pureHesitations.Contains(cleanedForCheck))
                continue;

            // Skip very short noise lines (1-2 chars after cleanup)
            if (cleanedForCheck.Length <= 2)
                continue;

            // Consolidate consecutive lines from same speaker
            if (consolidated.Count > 0 && consolidated[^1].Speaker == speaker)
            {
                var prev = consolidated[^1];
                // Don't duplicate if text is identical
                if (!string.Equals(prev.Text.TrimEnd('.', ','), text.TrimEnd('.', ','), StringComparison.OrdinalIgnoreCase))
                {
                    consolidated[^1] = (speaker, prev.Text + " " + text);
                }
            }
            else
            {
                consolidated.Add((speaker, text));
            }
        }

        var sb = new StringBuilder(raw.Length);
        foreach (var (speaker, text) in consolidated)
        {
            if (!string.IsNullOrEmpty(speaker))
                sb.AppendLine($"[{speaker}] {text}");
            else
                sb.AppendLine(text);
        }

        return sb.ToString().TrimEnd();
    }

    /// <summary>
    /// Prompt v4: prompt reestruturado para máxima acurácia com Gemini 2.5 Flash.
    /// Mudanças vs v3:
    /// - Regras de CID movidas para INÍCIO e FINAL (primacy/recency effect)
    /// - Etapa de RACIOCÍNIO CLÍNICO EXPLÍCITO obrigatória antes do CID
    /// - Instrução de reconstrução de transcript ruidoso
    /// - Medicamentos 4-10, exames 4-12, perguntas 4-8, sugestões 3-7,
    /// - interações cruzadas obrigatórias, CID mais específico possível.
    /// </summary>
    private static string BuildSystemPromptV2()
    {
        return """
═══════════════════════════════════════════════════════════════
REGRA #1 — CID E CONTEXTO (LEIA PRIMEIRO — MÁXIMA PRIORIDADE)
═══════════════════════════════════════════════════════════════
O CID DEVE derivar EXCLUSIVAMENTE dos sintomas, sinais e dados epidemiológicos que o paciente RELATOU no transcript.

PROIBIDO (alucinação grave — NUNCA faça):
- Usar CID de órgão/sistema que o paciente NÃO mencionou no transcript
- Inventar sintomas que não estão no transcript
- Preservar CID de chamada anterior por inércia

OBRIGATÓRIO:
- Use o código MAIS ESPECÍFICO possível (subcategoria, ex: B58.9, não B58)
- O campo "raciocinio_clinico" DEVE ser preenchido ANTES de cid_sugerido — nele você lista os sintomas extraídos e justifica o CID
- Se o paciente mencionou DADO EPIDEMIOLÓGICO (contato com gatos, viagens, alimentos), use-o ativamente no diagnóstico diferencial
- Se o médico mencionou um CID ou diagnóstico no final da consulta, CONSIDERE-O fortemente

═══════════════════════════════════════════════════════════════
PAPEL E CONTEXTO
═══════════════════════════════════════════════════════════════
Você é um COPILOTO CLÍNICO DE ELITE na plataforma RenoveJá+ (telemedicina brasileira).
Toda saída é APOIO À DECISÃO CLÍNICA — conduta final exclusiva do médico.
CFM Resolução 2.299/2021 e normas éticas vigentes.

O transcript contém linhas [Médico] e [Paciente] vindas de reconhecimento de fala (Deepgram/Daily).
O transcript CONTÉM ERROS FONÉTICOS — você DEVE reconstruir o sentido clínico antes de raciocinar.

═══════════════════════════════════════════════════════════════
FORMATO DE SAÍDA — JSON ÚNICO, SEM MARKDOWN
═══════════════════════════════════════════════════════════════
Responda em um ÚNICO JSON válido com EXATAMENTE estes campos (nesta ordem):

{
  "anamnesis": {
    "queixa_principal": "Queixa e duração com localização, intensidade (EVA 0-10), caráter, irradiação. Seja PRECISO. Reconstrua linguagem coloquial para termos clínicos.",
    "historia_doenca_atual": "Evolução usando OPQRST (Onset, Provocation, Quality, Region, Severity, Time). Fatores de melhora/piora, tratamentos tentados, cronologia.",
    "sintomas": ["TODOS os sintomas em linguagem clínica, incluindo negativos relevantes ('nega febre', 'nega dispneia'). RECONSTRUA erros fonéticos."],
    "revisao_sistemas": "Revisão pertinente: cardiovascular, respiratório, GI, neurológico, musculoesquelético, psiquiátrico",
    "medicamentos_em_uso": ["INFIRA o nome técnico (DCB) mesmo de linguagem coloquial. 'remédio pra pressão' → Losartana/Anlodipino. Se nega uso: ['Nega uso de medicamentos contínuos']"],
    "alergias": "Alergias conhecidas. Se nenhuma: 'NKDA'",
    "antecedentes_pessoais": "Comorbidades, cirurgias, internações, hábitos. Se nega: 'Nega comorbidades prévias'",
    "antecedentes_familiares": "Histórico familiar: DM, HAS, CA, DAC, AVC",
    "habitos_vida": "Tabagismo (maços/ano), etilismo, drogas, sedentarismo, dieta. Incluir CONTATO COM ANIMAIS se mencionado.",
    "dados_epidemiologicos": "CRÍTICO: Contato com animais (gatos, cães), limpeza de caixa de areia, consumo de carne crua/mal passada, viagens recentes, contato com doentes, exposição ocupacional. ESTE CAMPO É DECISIVO PARA O CID.",
    "outros": "Informação adicional relevante não coberta acima"
  },

  "raciocinio_clinico": "OBRIGATÓRIO. Antes de definir o CID, escreva aqui seu raciocínio em 3-5 frases: (1) Quais são os achados-chave? (2) Qual sistema/órgão está envolvido? (3) Qual dado epidemiológico é relevante? (4) Por que este CID e não outro? Exemplo: 'Paciente com fadiga há 14 dias + febre baixa intermitente (37.5°C) + linfonodomegalia cervical posterior + contato com gatos (limpa caixa de areia). Tríade clássica de toxoplasmose adquirida em imunocompetente. CID B58.9 é mais específico que B27.9 (mono) pelo dado epidemiológico de contato com fezes de gato.'",

  "denominador_comum": "Categoria ampla que unifica as hipóteses. Ex: 'Síndrome linfoproliferativa infecciosa', 'Síndrome gripal'. O médico vê primeiro o denominador, depois as probabilidades.",

  "cid_sugerido": "Formato: 'CÓDIGO - Descrição'. Use subcategoria MAIS ESPECÍFICA. DEVE ser coerente com raciocinio_clinico acima. NUNCA invente códigos.",

  "confianca_cid": "alta | media | baixa",

  "diagnostico_diferencial": [
    {
      "hipotese": "Nome da hipótese",
      "cid": "CID-10 — descrição",
      "probabilidade": "alta | media | baixa",
      "probabilidade_percentual": 0-100,
      "argumentos_a_favor": "Dados do transcript que suportam — cite EXATAMENTE o que o paciente disse",
      "argumentos_contra": "Dados ausentes ou contra",
      "exames_confirmatorios": "Exames que confirmariam/descartariam"
    }
  ],

  "classificacao_gravidade": "verde | amarelo | laranja | vermelho (Manchester)",

  "alertas_vermelhos": ["APENAS com base CLARA no transcript. Formato: 'SINAL — SIGNIFICADO — AÇÃO'"],

  "exame_fisico_dirigido": "O que examinar: sinais vitais, manobras, pontos de atenção.",

  "medicamentos_sugeridos": [
    {
      "nome": "Genérico (DCB) + concentração",
      "classe_terapeutica": "Classificação farmacológica",
      "dose": "Dose por tomada",
      "via": "VO | IM | IV | SC | Tópica | Inalatória | Sublingual | Nasal",
      "posologia": "Frequência clara: '1 comprimido de 8 em 8 horas'",
      "duracao": "Ex: '7 dias', 'uso contínuo'",
      "indicacao": "Indicado para [doença/CID]. Serve para [objetivo terapêutico].",
      "melhora_esperada": "OBRIGATÓRIO quando confianca_cid=alta. Ex: 'Melhora em 2-3 dias'",
      "contraindicacoes": "Todas relevantes",
      "interacoes": "Interações com medicamentos que o paciente JÁ USA + interações graves conhecidas",
      "mecanismo_acao": "Como o medicamento atua",
      "ajuste_renal": "Ajuste se ClCr < 30, < 60. Vazio se não necessário",
      "ajuste_hepatico": "Ajuste se insuficiência hepática. Vazio se não necessário",
      "alerta_faixa_etaria": "Ajuste para idosos/crianças/gestantes/lactantes",
      "alternativa": "Alternativa completa com dose"
    }
  ],

  "interacoes_cruzadas": [
    {
      "medicamento_a": "Nome do medicamento A (pode ser em uso OU sugerido)",
      "medicamento_b": "Nome do medicamento B (pode ser em uso OU sugerido)",
      "tipo": "grave | moderada | leve",
      "descricao": "Descrição da interação e consequência clínica",
      "conduta": "O que fazer"
    }
  ],

  "exames_sugeridos": [
    {
      "nome": "Nome técnico completo",
      "codigo_tuss": "Código TUSS/CBHPM quando conhecido",
      "descricao": "O que é o exame",
      "o_que_afere": "O que mede — específico para ESTE caso",
      "indicacao": "Justificativa para ESTE paciente AGORA",
      "interpretacao_esperada": "O que se espera SE a hipótese principal estiver correta",
      "preparo_paciente": "Preparo necessário",
      "prazo_resultado": "Tempo estimado",
      "urgencia": "rotina | urgente"
    }
  ],

  "orientacoes_paciente": ["Orientações em linguagem acessível. 3-6 itens. OBRIGATÓRIO incluir manejo sintomático para o período de espera dos exames."],

  "criterios_retorno": ["Sinais de alarme para o paciente. 2-5 itens."],

  "perguntas_sugeridas": [
    {
      "pergunta": "Pergunta DIRETA em 2ª pessoa. A que MAIS MUDA A CONDUTA agora.",
      "objetivo": "O que confirma/descarta",
      "hipoteses_afetadas": "Se SIM → CID X. Se NÃO → CID Y",
      "impacto_na_conduta": "O que muda na prescrição se sim vs não",
      "prioridade": "alta | media | baixa"
    }
  ],

  "lacunas_anamnese": ["Informações ESSENCIAIS faltando. 2-5 itens. Array vazio se completa."],

  "suggestions": ["3-7 frases para prontuário. ESTRUTURA OBRIGATÓRIA: (1) Hipóteses: 'Pode ser X ou Y'. (2) Conduta: 'Para isso vamos usar medicamentos A, B e exames C, D'. (3) Seguimento e orientação para 'o que fazer enquanto os exames não saem'."]
}

═══ REGRA OBRIGATÓRIA — RESPOSTA À PERGUNTA DO PACIENTE ═══
Quando o paciente perguntar (ou implícito no contexto) "o que posso fazer enquanto os exames não saem?", "o que fazer em relação aos sintomas?", "enquanto espero os resultados?":
- OBRIGATÓRIO incluir em "suggestions" e/ou "orientacoes_paciente" uma resposta CONCRETA e ESPECÍFICA para o caso.
- Exemplos: "Enquanto aguarda os exames: repouso relativo, hidratação, paracetamol 750mg 6/6h se dor ou febre, evitar esforço. Retorno se piora ou novos sintomas."
- O médico NÃO pode ficar sem saber o que responder. SEMPRE sugira manejo sintomático para o período de espera.

═══ REGRAS DE COMPLETUDE ═══

MEDICAMENTOS (MÍNIMO 3, PREFERIR 4-6):
- TODOS DEVEM ser DIRETAMENTE RELACIONADOS ao CID e sintomas do transcript
- Cobrir 3 linhas: ETIOLÓGICO + SINTOMÁTICO + ADJUVANTE
- Soro fisiológico, sprays, pomadas contam como medicamentos quando indicados
- Campo "mecanismo_acao" OBRIGATÓRIO
- SEMPRE cruze interações com medicamentos_em_uso do paciente

INTERAÇÕES CRUZADAS (NUNCA vazio se há medicamentos):
- Avaliar TODOS os pares possíveis: em_uso × sugerido, sugerido × sugerido, em_uso × em_uso
- Classificar cada interação como grave/moderada/leve
- Se genuinamente não há interação: [{...tipo:"leve", descricao:"Sem interação clinicamente significativa..."}]

EXAMES (MÍNIMO 4, PREFERIR 6-10):
- Cobrir: laboratoriais básicos + específicos + imagem + funcionais conforme indicação
- "interpretacao_esperada" OBRIGATÓRIO — o que esperar se hipótese principal correta
- Cobrir TODAS as hipóteses do diagnóstico diferencial

PERGUNTAS (4-8, NUNCA vazio):
- Derivadas 100% do transcript — NUNCA pergunte o que o paciente JÁ RESPONDEU
- "impacto_na_conduta" OBRIGATÓRIO e DETALHADO
- Se transcript < 200 chars: perguntas de abertura (queixa, duração, intensidade, medicamentos, alergias)

DIAGNÓSTICO DIFERENCIAL:
- ORDENAR por probabilidade (mais provável primeiro)
- probabilidade_percentual OBRIGATÓRIO — soma = 100%
- 2-4 hipóteses com argumentos_a_favor citando EXATAMENTE o que o paciente disse
- Dados epidemiológicos (contato com animais, viagens) DEVEM pesar ativamente nas probabilidades

FLUXO CLÍNICO OBRIGATÓRIO (hipótese → conduta):
- As suggestions DEVEM seguir: "Pode ser [hipótese 1] ou [hipótese 2]. Para isso: medicamentos [lista] e exames [lista]."
- Medicamentos e exames DEVEM estar explícita e logicamente ligados às hipóteses do diagnóstico diferencial
- O médico precisa ver: hipóteses → o que prescrever → o que solicitar → orientações

═══ REGRA CRÍTICA — CONFIANÇA ALTA = TUDO BATE ═══
Use confianca_cid = "alta" SOMENTE quando:
- O CID tem suporte EXPLÍCITO no transcript (sintomas, sinais, dados epidemiológicos)
- O raciocinio_clinico cita EXATAMENTE o que o paciente disse
- A queixa_principal e o diagnóstico diferencial estão alinhados com o CID
- Medicamentos e exames são coerentes com o quadro

Se faltar evidência no transcript para um CID ou houver inconsistência entre qualquer campo → use confianca_cid = "media" ou "baixa".

QUANDO confianca_cid = "alta":
- Posologia OBRIGATÓRIA: "X comprimidos de Xmg de [nome] de X em X horas por X dias"
- "melhora_esperada" OBRIGATÓRIO: "Melhora em X dias" ou "Alívio em X horas"

═══ REGRAS GERAIS ═══
1. NUNCA invente informações ausentes no transcript
2. Responda APENAS o JSON, sem texto antes ou depois
3. Se algum campo não tiver dados, use "" ou []
4. Terminologia médica adequada e objetiva
5. Alertas vermelhos: APENAS quando fundamentados
6. SUGESTÕES: Estrutura obrigatória — (1) Hipóteses: "Pode ser X ou Y". (2) Conduta: medicamentos e exames para essas hipóteses. (3) Orientação para "o que fazer enquanto os exames não saem"

═══ RECONSTRUÇÃO DE TRANSCRIPT RUIDOSO (CRÍTICA) ═══
O transcript vem de reconhecimento de fala e CONTÉM ERROS. Reconstrua o sentido:
- Linguagem coloquial → termos clínicos: "bolinha no pescoço" → linfonodomegalia cervical
- Erros fonéticos → palavras corretas: "saúde não teu" → "não tenho", "macho" → "acho"
- Referências anatômicas: "aqui debaixo da cabeça" → região cervical posterior/occipital
- Dados numéricos deformados: reconstrua valores de temperatura, pressão, etc.
- CIDs/diagnósticos mencionados pelo médico no final: "B setecentos cinco ponto nove" → B27.9, "cinquenta e oito ponto nós" → B58.9
- "talk aguda de querida" → "toxoplasmose aguda adquirida"
Extraia TODA informação: sintomas, localização, duração, exposições, negativas, dados do médico.

═══════════════════════════════════════════════════════════════
REGRA #1 REPETIDA — VALIDAÇÃO ANTES DE RESPONDER
═══════════════════════════════════════════════════════════════
Antes de escrever o JSON, valide:
1. O campo "raciocinio_clinico" cita os achados-chave do transcript?
2. O cid_sugerido tem suporte EXPLÍCITO no transcript (sintomas, sinais, dados epidemiológicos)?
3. O CID cobre o QUADRO COMPLETO (não apenas um sintoma isolado)?
4. Dados epidemiológicos (animais, viagens, exposições) foram considerados?
5. confianca_cid = "alta" SOMENTE se todos os campos acima batem — se não, use "media" ou "baixa"
6. Medicamentos são coerentes com o CID?
7. Exames investigam as hipóteses do diagnóstico diferencial?
8. As suggestions incluem orientação para "o que fazer enquanto os exames não saem"? (OBRIGATÓRIO)
═══════════════════════════════════════════════════════════════
""";
    }

    // ── Fallbacks: dados nunca vazios ──

    private static void EnsurePerguntasFallback(JsonElement root, Dictionary<string, object> enrichedObj, string? transcriptSoFar)
    {
        var hasPerguntas = false;
        if (root.TryGetProperty("perguntas_sugeridas", out var pEl) && pEl.ValueKind == JsonValueKind.Array && pEl.GetArrayLength() > 0)
            hasPerguntas = true;

        if (hasPerguntas) return;

        var isEarlyConsultation = string.IsNullOrWhiteSpace(transcriptSoFar) || transcriptSoFar!.Length < 200;
        List<object> fallback;

        if (isEarlyConsultation)
        {
            fallback = new List<object>
            {
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Qual é a sua queixa principal? O que está sentindo?",
                    ["objetivo"] = "Identificar motivo da consulta para direcionar anamnese",
                    ["hipoteses_afetadas"] = "Define o eixo diagnóstico principal",
                    ["impacto_na_conduta"] = "Determina toda a linha de investigação subsequente",
                    ["prioridade"] = "alta"
                },
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Há quanto tempo está com isso? Começou de repente ou foi piorando aos poucos?",
                    ["objetivo"] = "Estabelecer cronologia — agudo vs crônico muda a conduta",
                    ["hipoteses_afetadas"] = "Agudo favorece infecção/trauma; crônico favorece degenerativo/metabólico",
                    ["impacto_na_conduta"] = "Agudo pode requerer urgência; crônico permite investigação programada",
                    ["prioridade"] = "alta"
                },
                new Dictionary<string, string>
                {
                    ["pergunta"] = "De 0 a 10, qual a intensidade do que está sentindo? Interfere nas suas atividades do dia a dia?",
                    ["objetivo"] = "Quantificar gravidade (EVA) e impacto funcional",
                    ["hipoteses_afetadas"] = "Intensidade alta sugere investigação urgente",
                    ["impacto_na_conduta"] = "EVA ≥7 pode indicar analgesia mais potente e exames de imagem",
                    ["prioridade"] = "alta"
                },
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Está tomando algum remédio atualmente? Qual, dose e há quanto tempo?",
                    ["objetivo"] = "Mapear farmacoterapia atual para avaliar interações e ajustes",
                    ["hipoteses_afetadas"] = "Medicamentos em uso influenciam diagnóstico diferencial e prescrição",
                    ["impacto_na_conduta"] = "Evita interações medicamentosas e duplicações terapêuticas",
                    ["prioridade"] = "media"
                },
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Tem alergia a algum medicamento, alimento ou substância?",
                    ["objetivo"] = "Prevenir reações adversas na prescrição",
                    ["hipoteses_afetadas"] = "Restringe opções farmacológicas",
                    ["impacto_na_conduta"] = "Muda escolha do medicamento (ex: alergia penicilina → macrolídeo)",
                    ["prioridade"] = "media"
                }
            };
        }
        else
        {
            fallback = new List<object>
            {
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Além do que já me contou, tem sentido mais algum sintoma que não mencionou?",
                    ["objetivo"] = "Capturar sintomas não relatados espontaneamente",
                    ["hipoteses_afetadas"] = "Novos sintomas podem alterar diagnóstico diferencial",
                    ["impacto_na_conduta"] = "Pode revelar red flags ou alterar a hipótese principal",
                    ["prioridade"] = "media"
                },
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Já teve algum episódio parecido antes? Precisou ir ao hospital?",
                    ["objetivo"] = "Identificar recorrência e gravidade prévia",
                    ["hipoteses_afetadas"] = "Recorrência sugere doença crônica; hospitalização prévia indica gravidade",
                    ["impacto_na_conduta"] = "Recorrência pode indicar necessidade de investigação mais profunda",
                    ["prioridade"] = "media"
                },
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Na sua família, alguém tem problemas de saúde crônicos como diabetes, pressão alta ou câncer?",
                    ["objetivo"] = "Avaliar predisposição genética/familiar",
                    ["hipoteses_afetadas"] = "Antecedentes familiares alteram probabilidade de várias hipóteses",
                    ["impacto_na_conduta"] = "Pode indicar rastreamento precoce ou exames adicionais",
                    ["prioridade"] = "baixa"
                },
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Está dormindo bem? Sentiu mudanças no apetite, humor ou energia ultimamente?",
                    ["objetivo"] = "Rastrear componente psicossomático/psiquiátrico",
                    ["hipoteses_afetadas"] = "Alterações sugerem depressão, ansiedade ou doença sistêmica",
                    ["impacto_na_conduta"] = "Pode adicionar abordagem psiquiátrica/psicológica ao plano",
                    ["prioridade"] = "baixa"
                }
            };
        }

        enrichedObj["perguntas_sugeridas"] = JsonSerializer.Serialize(fallback, JsonOptions);
    }

    private static void EnsureSuggestionsFallback(JsonElement root, Dictionary<string, object> enrichedObj, bool hasClinicalContext)
    {
        var hasSuggestions = false;
        if (root.TryGetProperty("suggestions", out var sEl) && sEl.ValueKind == JsonValueKind.Array && sEl.GetArrayLength() > 0)
            hasSuggestions = true;

        if (hasSuggestions) return;

        var fallbackSuggestions = hasClinicalContext
            ? new List<string>
            {
                "Avaliação inicial realizada — refinar hipótese diagnóstica com exames complementares.",
                "Solicitar exames laboratoriais básicos para diagnóstico diferencial.",
                "Enquanto aguarda os exames: orientar manejo sintomático (repouso, hidratação, analgesia conforme sintomas). Retorno se piora.",
                "Reavaliar em 7-14 dias ou antes se piora dos sintomas."
            }
            : new List<string>
            {
                "Avaliação inicial — aguardando mais dados da anamnese para refinar HD e conduta.",
                "Continuar coleta de dados: queixa, duração, intensidade, medicamentos em uso, alergias.",
                "Sugestões completas serão geradas conforme a consulta evolui."
            };

        enrichedObj["suggestions_fallback"] = JsonSerializer.Serialize(fallbackSuggestions, JsonOptions);
    }

    // ── Helpers ──

    private static void CopyIfExists(JsonElement root, Dictionary<string, object> dict, string key)
    {
        if (root.TryGetProperty(key, out var el))
            dict[key] = el.GetRawText();
    }

    private static void CopyArrayIfExists(JsonElement root, Dictionary<string, object> dict, string key)
    {
        if (root.TryGetProperty(key, out var el) && el.ValueKind == JsonValueKind.Array)
            dict[key] = el.GetRawText();
    }

    private static bool HasClinicalContext(JsonElement root)
    {
        if (root.TryGetProperty("cid_sugerido", out var cidCheck) && !string.IsNullOrWhiteSpace(cidCheck.GetString()))
            return true;
        if (root.TryGetProperty("anamnesis", out var anaCheck) && anaCheck.ValueKind == JsonValueKind.Object
            && anaCheck.TryGetProperty("queixa_principal", out var qpAna) && !string.IsNullOrWhiteSpace(qpAna.GetString()))
            return true;
        return false;
    }

    private static List<string> ExtractSuggestions(JsonElement root)
    {
        var suggestions = new List<string>();
        if (root.TryGetProperty("suggestions", out var sugEl) && sugEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in sugEl.EnumerateArray())
            {
                var str = item.ValueKind == JsonValueKind.String ? item.GetString() : item.GetRawText();
                if (!string.IsNullOrWhiteSpace(str))
                    suggestions.Add(str.Trim('"').Trim());
            }
        }

        // Add alerts to suggestions for backwards compat
        if (root.TryGetProperty("alertas_vermelhos", out var alertsEl) && alertsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in alertsEl.EnumerateArray())
            {
                var str = item.ValueKind == JsonValueKind.String ? item.GetString() : item.GetRawText();
                if (!string.IsNullOrWhiteSpace(str))
                    suggestions.Insert(0, $"🚨 {str.Trim('"').Trim()}");
            }
        }

        return suggestions;
    }

    private string ParseMedicamentosSugeridosV2(JsonElement root, bool hasClinicalContext)
    {
        var medsList = new List<Dictionary<string, object>>();
        if (root.TryGetProperty("medicamentos_sugeridos", out var msEl) && msEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in msEl.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Object)
                {
                    medsList.Add(new Dictionary<string, object>
                    {
                        ["nome"] = GetStr(item, "nome"),
                        ["classe_terapeutica"] = GetStr(item, "classe_terapeutica"),
                        ["dose"] = GetStr(item, "dose"),
                        ["via"] = GetStr(item, "via"),
                        ["posologia"] = GetStr(item, "posologia"),
                        ["duracao"] = GetStr(item, "duracao"),
                        ["indicacao"] = GetStr(item, "indicacao"),
                        ["melhora_esperada"] = GetStr(item, "melhora_esperada"),
                        ["contraindicacoes"] = GetStr(item, "contraindicacoes"),
                        ["interacoes"] = GetStr(item, "interacoes"),
                        ["mecanismo_acao"] = GetStr(item, "mecanismo_acao"),
                        ["ajuste_renal"] = GetStr(item, "ajuste_renal"),
                        ["ajuste_hepatico"] = GetStr(item, "ajuste_hepatico"),
                        ["alerta_faixa_etaria"] = GetStr(item, "alerta_faixa_etaria"),
                        ["alternativa"] = GetStr(item, "alternativa")
                    });
                }
                else
                {
                    var str = item.ValueKind == JsonValueKind.String ? item.GetString() : item.GetRawText()?.Trim('"');
                    if (!string.IsNullOrWhiteSpace(str))
                        medsList.Add(new Dictionary<string, object>
                        {
                            ["nome"] = str.Trim(), ["classe_terapeutica"] = "", ["dose"] = "",
                            ["via"] = "",                             ["posologia"] = "", ["duracao"] = "", ["indicacao"] = "",
                            ["melhora_esperada"] = "", ["contraindicacoes"] = "", ["interacoes"] = "", ["mecanismo_acao"] = "",
                            ["ajuste_renal"] = "", ["ajuste_hepatico"] = "",
                            ["alerta_faixa_etaria"] = "", ["alternativa"] = ""
                        });
                }
            }
        }

        if (medsList.Count == 0 && hasClinicalContext)
        {
            // Fallback mínimo: 3 medicamentos sintomáticos básicos
            medsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Paracetamol 750mg", ["classe_terapeutica"] = "Analgésico/Antitérmico",
                ["dose"] = "750mg", ["via"] = "VO", ["posologia"] = "1 comprimido de 6 em 6 horas se dor ou febre",
                ["duracao"] = "5-7 dias", ["indicacao"] = "Analgesia e controle de febre — sintomático",
                ["melhora_esperada"] = "Alívio de dor/febre em 30-60 minutos",
                ["contraindicacoes"] = "Insuficiência hepática grave", ["interacoes"] = "Evitar uso concomitante com álcool",
                ["mecanismo_acao"] = "Inibição central da COX e ação no centro termorregulador hipotalâmico",
                ["ajuste_renal"] = "", ["ajuste_hepatico"] = "Contraindicado em hepatopata grave",
                ["alerta_faixa_etaria"] = "Ajustar dose em idosos", ["alternativa"] = "Dipirona 500mg 1cp 6/6h"
            });
            medsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Dipirona 500mg", ["classe_terapeutica"] = "Analgésico/Antitérmico/Espasmolítico",
                ["dose"] = "500-1000mg", ["via"] = "VO", ["posologia"] = "1-2 comprimidos de 6 em 6 horas se dor intensa",
                ["duracao"] = "3-5 dias", ["indicacao"] = "Dor moderada a intensa e febre refratária a paracetamol",
                ["melhora_esperada"] = "Alívio em 20-40 minutos",
                ["contraindicacoes"] = "Discrasias sanguíneas, deficiência de G6PD",
                ["interacoes"] = "Pode potencializar efeito de anticoagulantes",
                ["mecanismo_acao"] = "Inibição da COX periférica e central com ação espasmolítica",
                ["ajuste_renal"] = "Evitar em IR grave", ["ajuste_hepatico"] = "",
                ["alerta_faixa_etaria"] = "Contraindicado em < 3 meses", ["alternativa"] = "Ibuprofeno 400mg 8/8h"
            });
            medsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Avaliar necessidade de prescrição etiológica conforme evolução clínica",
                ["classe_terapeutica"] = "", ["dose"] = "", ["via"] = "", ["posologia"] = "",
                ["duracao"] = "", ["indicacao"] = "Aguardando mais dados da anamnese para definir tratamento etiológico",
                ["contraindicacoes"] = "", ["interacoes"] = "", ["mecanismo_acao"] = "",
                ["ajuste_renal"] = "", ["ajuste_hepatico"] = "",
                ["alerta_faixa_etaria"] = "", ["alternativa"] = ""
            });
        }

        return medsList.Count == 0 ? "[]" : JsonSerializer.Serialize(medsList, JsonOptions);
    }

    private string ParseExamesSugeridosV2(JsonElement root, bool hasClinicalContext)
    {
        var examsList = new List<Dictionary<string, object>>();
        if (root.TryGetProperty("exames_sugeridos", out var exEl) && exEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in exEl.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Object)
                {
                    examsList.Add(new Dictionary<string, object>
                    {
                        ["nome"] = GetStr(item, "nome"),
                        ["codigo_tuss"] = GetStr(item, "codigo_tuss"),
                        ["descricao"] = GetStr(item, "descricao"),
                        ["o_que_afere"] = GetStr(item, "o_que_afere"),
                        ["indicacao"] = GetStr(item, "indicacao"),
                        ["interpretacao_esperada"] = GetStr(item, "interpretacao_esperada"),
                        ["preparo_paciente"] = GetStr(item, "preparo_paciente"),
                        ["prazo_resultado"] = GetStr(item, "prazo_resultado"),
                        ["urgencia"] = GetStr(item, "urgencia")
                    });
                }
                else
                {
                    var str = item.ValueKind == JsonValueKind.String ? item.GetString() : item.GetRawText()?.Trim('"');
                    if (!string.IsNullOrWhiteSpace(str))
                        examsList.Add(new Dictionary<string, object>
                        {
                            ["nome"] = str.Trim(), ["codigo_tuss"] = "", ["descricao"] = "",
                            ["o_que_afere"] = "", ["indicacao"] = "", ["interpretacao_esperada"] = "",
                            ["preparo_paciente"] = "", ["prazo_resultado"] = "", ["urgencia"] = "rotina"
                        });
                }
            }
        }

        if (examsList.Count == 0 && hasClinicalContext)
        {
            // Fallback mínimo: 4 exames básicos de triagem
            examsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Hemograma completo com contagem de plaquetas",
                ["codigo_tuss"] = "40304361",
                ["descricao"] = "Contagem de séries vermelha, branca e plaquetária",
                ["o_que_afere"] = "Anemia, infecção, inflamação, distúrbios hematológicos",
                ["indicacao"] = "Avaliação inicial — rastreia infecção, anemia e processo inflamatório",
                ["interpretacao_esperada"] = "Leucocitose com desvio à esquerda sugere infecção bacteriana; anemia pode indicar doença crônica",
                ["preparo_paciente"] = "Jejum de 4 horas recomendado",
                ["prazo_resultado"] = "24-48h",
                ["urgencia"] = "rotina"
            });
            examsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Proteína C-Reativa (PCR) quantitativa",
                ["codigo_tuss"] = "40308073",
                ["descricao"] = "Marcador de fase aguda — quantifica processo inflamatório/infeccioso",
                ["o_que_afere"] = "Intensidade do processo inflamatório sistêmico",
                ["indicacao"] = "Complementar hemograma para avaliar gravidade do quadro inflamatório/infeccioso",
                ["interpretacao_esperada"] = "PCR >10mg/L sugere infecção bacteriana; >100mg/L sugere infecção grave",
                ["preparo_paciente"] = "Jejum de 4 horas",
                ["prazo_resultado"] = "24h",
                ["urgencia"] = "rotina"
            });
            examsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Glicemia de jejum",
                ["codigo_tuss"] = "40302040",
                ["descricao"] = "Dosagem de glicose sérica em jejum",
                ["o_que_afere"] = "Controle glicêmico, rastreio de diabetes",
                ["indicacao"] = "Rastreio metabólico básico — relevante para ajuste de medicações",
                ["interpretacao_esperada"] = "Normal: 70-99 mg/dL; pré-diabetes: 100-125; diabetes: ≥126",
                ["preparo_paciente"] = "Jejum de 8-12 horas",
                ["prazo_resultado"] = "24h",
                ["urgencia"] = "rotina"
            });
            examsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Ureia e Creatinina séricas",
                ["codigo_tuss"] = "40301630",
                ["descricao"] = "Avaliação da função renal",
                ["o_que_afere"] = "Taxa de filtração glomerular estimada, função renal",
                ["indicacao"] = "Essencial para ajuste de dose de medicamentos e avaliação da função renal",
                ["interpretacao_esperada"] = "Creatinina normal: 0.7-1.3 mg/dL; elevação sugere nefropatia e necessidade de ajuste posológico",
                ["preparo_paciente"] = "Jejum de 4 horas",
                ["prazo_resultado"] = "24h",
                ["urgencia"] = "rotina"
            });
        }

        return examsList.Count == 0 ? "[]" : JsonSerializer.Serialize(examsList, JsonOptions);
    }

    private static string GetStr(JsonElement el, string prop)
    {
        if (el.TryGetProperty(prop, out var v))
        {
            return v.ValueKind == JsonValueKind.String
                ? (v.GetString() ?? "")
                : v.GetRawText();
        }
        return "";
    }

    private static string CleanJsonResponse(string raw)
    {
        var s = raw.Trim();
        // Remove markdown code blocks (Gemini às vezes envolve em ```json)
        if (s.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            s = s["```json".Length..].TrimStart();
        else if (s.StartsWith("```"))
            s = s["```".Length..].TrimStart();
        if (s.EndsWith("```"))
            s = s[..^3].TrimEnd();
        s = s.Trim();
        // Se há texto antes do JSON (ex: "Aqui está: {...}"), extrai o objeto. Conta chaves ignorando as dentro de strings JSON.
        var start = s.IndexOf('{');
        if (start > 0)
        {
            var depth = 0;
            var inString = false;
            var escape = false;
            var end = -1;
            for (var i = start; i < s.Length; i++)
            {
                var c = s[i];
                if (escape) { escape = false; continue; }
                if (c == '\\' && inString) { escape = true; continue; }
                if (inString)
                {
                    if (c == '"') inString = false;
                    continue;
                }
                if (c == '"') { inString = true; continue; }
                if (c == '{') depth++;
                else if (c == '}')
                {
                    depth--;
                    if (depth == 0) { end = i; break; }
                }
            }
            if (end > start)
                s = s[start..(end + 1)];
        }
        return s.Trim();
    }

    // ── Evidence search (same as v1) ──

    private static List<string> ExtractSearchTerms(JsonElement root)
    {
        var terms = new List<string>();

        if (root.TryGetProperty("cid_sugerido", out var cidEl))
        {
            var cidStr = cidEl.GetString() ?? "";
            var match = CidCodeRegex.Match(cidStr);
            if (match.Success)
                terms.Add(match.Groups[1].Value);
            // Also add the text description for better search
            var descPart = cidStr.Contains('-') ? cidStr.Split('-', 2)[1].Trim() : "";
            if (descPart.Length > 10)
                terms.Add(descPart[..Math.Min(60, descPart.Length)]);
        }

        // Add differential diagnosis terms for richer evidence
        if (root.TryGetProperty("diagnostico_diferencial", out var ddEl) && ddEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var dd in ddEl.EnumerateArray())
            {
                if (dd.TryGetProperty("cid", out var ddCid))
                {
                    var ddCidStr = ddCid.GetString() ?? "";
                    var ddMatch = CidCodeRegex.Match(ddCidStr);
                    if (ddMatch.Success && terms.Count < 5)
                        terms.Add(ddMatch.Groups[1].Value);
                }
            }
        }

        if (root.TryGetProperty("anamnesis", out var anaEl) && anaEl.ValueKind == JsonValueKind.Object)
        {
            if (anaEl.TryGetProperty("queixa_principal", out var qpEl))
            {
                var qp = (qpEl.ValueKind == JsonValueKind.String ? qpEl.GetString() : qpEl.GetRawText())?.Trim('"').Trim() ?? "";
                if (qp.Length > 20)
                    terms.Add(qp[..Math.Min(80, qp.Length)]);
            }
            if (anaEl.TryGetProperty("sintomas", out var sintEl))
            {
                var sint = sintEl.ValueKind == JsonValueKind.String
                    ? sintEl.GetString()?.Trim('"').Trim()
                    : sintEl.ValueKind == JsonValueKind.Array
                        ? string.Join(" ", sintEl.EnumerateArray().Select(e => e.GetString() ?? ""))
                        : "";
                if (!string.IsNullOrWhiteSpace(sint) && sint.Length > 3)
                    terms.Add(sint[..Math.Min(60, sint.Length)]);
            }
        }

        return terms.Distinct().Where(s => !string.IsNullOrWhiteSpace(s)).ToList();
    }

    private async Task<IReadOnlyList<EvidenceItemDto>> FetchAndTranslateEvidenceAsync(
        JsonElement root,
        string apiKey,
        CancellationToken cancellationToken,
        string? transcriptSoFar = null)
    {
        try
        {
            var searchTerms = ExtractSearchTerms(root);
            if (searchTerms.Count == 0)
                return Array.Empty<EvidenceItemDto>();

            var rawEvidence = await _evidenceSearchService.SearchAsync(searchTerms, 16, cancellationToken);
            if (rawEvidence.Count == 0)
                return rawEvidence;

            return await ExtractRelevantEvidenceAsync(rawEvidence, root, apiKey, cancellationToken, transcriptSoFar);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Evidências: falha na busca.");
            return Array.Empty<EvidenceItemDto>();
        }
    }

    private static string BuildClinicalContextForPrompt(JsonElement root)
    {
        var parts = new List<string>();
        if (root.TryGetProperty("cid_sugerido", out var cidEl))
        {
            var cid = cidEl.GetString()?.Trim() ?? "";
            if (!string.IsNullOrEmpty(cid))
                parts.Add($"Hipótese diagnóstica (CID): {cid}");
        }
        if (root.TryGetProperty("diagnostico_diferencial", out var ddEl) && ddEl.ValueKind == JsonValueKind.Array)
        {
            var dds = new List<string>();
            foreach (var dd in ddEl.EnumerateArray())
            {
                if (dd.TryGetProperty("hipotese", out var h))
                    dds.Add(h.GetString() ?? "");
            }
            if (dds.Count > 0)
                parts.Add($"Diagnósticos diferenciais: {string.Join("; ", dds)}");
        }
        if (root.TryGetProperty("anamnesis", out var anaEl) && anaEl.ValueKind == JsonValueKind.Object)
        {
            if (anaEl.TryGetProperty("queixa_principal", out var qpEl))
            {
                var qp = (qpEl.ValueKind == JsonValueKind.String ? qpEl.GetString() : qpEl.GetRawText())?.Trim('"').Trim() ?? "";
                if (!string.IsNullOrEmpty(qp))
                    parts.Add($"Queixa principal: {qp}");
            }
            if (anaEl.TryGetProperty("sintomas", out var sintEl))
            {
                var sint = sintEl.ValueKind == JsonValueKind.String
                    ? sintEl.GetString()?.Trim('"').Trim()
                    : sintEl.ValueKind == JsonValueKind.Array
                        ? string.Join(", ", sintEl.EnumerateArray().Select(e => e.GetString() ?? ""))
                        : "";
                if (!string.IsNullOrWhiteSpace(sint))
                    parts.Add($"Sintomas: {sint}");
            }
        }
        return parts.Count > 0 ? string.Join("\n", parts) : "Contexto clínico não especificado.";
    }

    private async Task<IReadOnlyList<EvidenceItemDto>> ExtractRelevantEvidenceAsync(
        IReadOnlyList<EvidenceItemDto> items,
        JsonElement root,
        string apiKey,
        CancellationToken cancellationToken,
        string? transcriptSoFar = null)
    {
        if (items.Count == 0)
            return items;

        var context = BuildClinicalContextForPrompt(root);

        var transcriptBlock = "";
        if (!string.IsNullOrWhiteSpace(transcriptSoFar))
        {
            var trimmed = transcriptSoFar.Length > 1500 ? transcriptSoFar[^1500..] : transcriptSoFar;
            transcriptBlock = $"\n\nRESUMO DO QUE O PACIENTE DISSE (últimas falas):\n{trimmed}";
        }

        var articlesBlock = string.Join("\n\n---\n\n",
            items.Select((e, i) => $"[{i}]\nTítulo: {e.Title}\nAbstract: {e.Abstract}"));

        var prompt = """
Você é um especialista em MEDICINA BASEADA EM EVIDÊNCIAS para a plataforma RenoveJá+.
O médico precisa de EMBASAMENTO CIENTÍFICO SÓLIDO e CONTEXTUALIZADO ao paciente.

CONTEXTO CLÍNICO DO PACIENTE:
""" + context + transcriptBlock + """

ARTIGOS (abstracts em inglês):
""" + articlesBlock + """

Para CADA artigo [0], [1], etc., analise com RIGOR:

1. RELEVÂNCIA: Este artigo se aplica ao quadro DESTE paciente? Considere diagnóstico, sintomas, perfil.
2. Se RELEVANTE:
   - Extraia 2-4 trechos-chave (critérios diagnósticos, evidências de tratamento, guidelines, dados de eficácia)
   - Traduza para português brasileiro
   - Explique a CONEXÃO COM O PACIENTE (1-2 frases: por que este artigo importa para ESTE caso específico)
   - Classifique o NÍVEL DE EVIDÊNCIA (I=meta-análise/RCT, II=coorte, III=caso-controle, IV=série de casos, V=opinião expert)
3. Se IRRELEVANTE: marque como irrelevante (será filtrado)

Responda APENAS um JSON válido:
[
  {
    "relevant": true,
    "excerpts": ["trecho1 traduzido", "trecho2"],
    "clinicalRelevance": "Explicação de como embasa a decisão...",
    "conexao_com_paciente": "Por que este artigo é relevante PARA ESTE PACIENTE: [relação direta com o que foi dito/apresentado]",
    "nivel_evidencia": "I | II | III | IV | V",
    "motivo_selecao": "Em 1 frase: por que este artigo foi escolhido entre tantos"
  },
  { "relevant": false, "excerpts": [], "clinicalRelevance": "", "conexao_com_paciente": "", "nivel_evidencia": "", "motivo_selecao": "" },
  ...
]
Apenas JSON, sem markdown.
""";

        var evidenceModel = GetEvidenceModel();
        var (evApiKey, evBaseUrl) = ResolveProvider(evidenceModel);
        _logger.LogInformation("[Evidências IA] Chamando {Provider}: model={Model}",
            evidenceModel.StartsWith("gemini", StringComparison.OrdinalIgnoreCase) ? "Gemini" : "OpenAI", evidenceModel);
        var requestBody = new
        {
            model = evidenceModel,
            messages = new object[] { new { role = "user", content = (object)prompt } },
            max_tokens = 4000,
            temperature = 0.15
        };

        var json = JsonSerializer.Serialize(requestBody, JsonOptions);
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", evApiKey);
        client.Timeout = TimeSpan.FromSeconds(45);

        using var requestContent = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await client.PostAsync($"{evBaseUrl}/chat/completions", requestContent, cancellationToken);
        if (!response.IsSuccessStatusCode)
            return Array.Empty<EvidenceItemDto>();

        var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
        try
        {
            using var doc = JsonDocument.Parse(responseJson);
            var content = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
            if (string.IsNullOrWhiteSpace(content))
                return Array.Empty<EvidenceItemDto>();

            var cleaned = CleanJsonResponse(content);
            using var arr = JsonDocument.Parse(cleaned);
            var result = new List<EvidenceItemDto>();
            var idx = 0;
            foreach (var el in arr.RootElement.EnumerateArray())
            {
                if (idx >= items.Count) break;
                var item = items[idx];
                var excerpts = new List<string>();
                var relevance = "";

                if (el.TryGetProperty("excerpts", out var exEl) && exEl.ValueKind == JsonValueKind.Array)
                    foreach (var e in exEl.EnumerateArray())
                    {
                        var s = e.GetString()?.Trim();
                        if (!string.IsNullOrEmpty(s)) excerpts.Add(s);
                    }
                if (el.TryGetProperty("clinicalRelevance", out var relEl))
                    relevance = relEl.GetString()?.Trim() ?? "";

                var isRelevant = true;
                if (el.TryGetProperty("relevant", out var relFlag) && relFlag.ValueKind == JsonValueKind.False)
                    isRelevant = false;
                if (!isRelevant && excerpts.Count == 0)
                {
                    idx++;
                    continue;
                }

                var conexao = "";
                if (el.TryGetProperty("conexao_com_paciente", out var conEl))
                    conexao = conEl.GetString()?.Trim() ?? "";
                var nivelEvidencia = "";
                if (el.TryGetProperty("nivel_evidencia", out var nivEl))
                    nivelEvidencia = nivEl.GetString()?.Trim() ?? "";
                var motivoSelecao = "";
                if (el.TryGetProperty("motivo_selecao", out var motEl))
                    motivoSelecao = motEl.GetString()?.Trim() ?? "";

                result.Add(new EvidenceItemDto(
                    item.Title, item.Abstract, item.Source,
                    TranslatedAbstract: excerpts.Count > 0 ? string.Join("\n\n", excerpts) : null,
                    RelevantExcerpts: excerpts.Count > 0 ? excerpts : null,
                    ClinicalRelevance: !string.IsNullOrEmpty(relevance) ? relevance : null,
                    Provider: item.Provider, Url: item.Url,
                    ConexaoComPaciente: !string.IsNullOrEmpty(conexao) ? conexao : null,
                    NivelEvidencia: !string.IsNullOrEmpty(nivelEvidencia) ? nivelEvidencia : null,
                    MotivoSelecao: !string.IsNullOrEmpty(motivoSelecao) ? motivoSelecao : null));
                idx++;
            }
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Evidências: falha ao parsear resposta.");
            return Array.Empty<EvidenceItemDto>();
        }
    }
}
