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

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// Serviço de anamnese estruturada e sugestões clínicas por IA (GPT-4o) durante a consulta.
/// Gera: anamnese SOAP, CID sugerido, alertas de gravidade, medicamentos sugeridos, hipóteses e evidências (PubMed).
/// Atua como copiloto: a decisão final é sempre do médico.
/// </summary>
public class ConsultationAnamnesisService : IConsultationAnamnesisService
{
    private const string ApiBaseUrl = "https://api.openai.com/v1";
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

    public async Task<ConsultationAnamnesisResult?> UpdateAnamnesisAndSuggestionsAsync(
        string transcriptSoFar,
        string? previousAnamnesisJson,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[Anamnese IA] INICIO transcriptLen={Len} previousAnamnesisLen={PrevLen}",
            transcriptSoFar?.Length ?? 0, previousAnamnesisJson?.Length ?? 0);

        var apiKey = _config.Value?.ApiKey?.Trim();
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("[Anamnese IA] ANAMNESE_NAO_OCORRE: OpenAI:ApiKey não configurada. Defina OpenAI:ApiKey em appsettings ou variável OpenAI__ApiKey.");
            return null;
        }

        if (string.IsNullOrWhiteSpace(transcriptSoFar))
        {
            _logger.LogWarning("[Anamnese IA] ANAMNESE_NAO_OCORRE: Transcript vazio ou nulo.");
            return null;
        }

        var systemPrompt = """
Você é um assistente de apoio à consulta médica, atuando como COPILOTO DO MÉDICO.
Sua função é estruturar a anamnese e fornecer apoio clínico com base no que foi dito na consulta.
Toda saída é APENAS APOIO À DECISÃO CLÍNICA — a conduta final é exclusivamente do médico.
Conformidade com CFM Resolução 2.299/2021 e normas éticas vigentes.

O transcript pode conter linhas prefixadas com [Médico] ou [Paciente] para identificar quem falou.

Responda em um ÚNICO JSON válido, sem markdown, com exatamente estes campos:

{
  "anamnesis": {
    "queixa_principal": "string — escreva como 'Queixa e duração: ...' (o que trouxe o paciente + há quanto tempo)",
    "historia_doenca_atual": "string — escreva como 'Evolução / anamnese: ...' (evolução, início, fatores de melhora/piora, contexto)",
    "sintomas": "string ou array — lista dos sintomas referidos, em linguagem clínica objetiva",
    "medicamentos_em_uso": "string ou array — medicamentos que o paciente já usa",
    "alergias": "string — alergias conhecidas (medicamentos, alimentos, outros)",
    "antecedentes_relevantes": "string — histórico médico, cirurgias, comorbidades relevantes",
    "outros": "string — qualquer informação adicional relevante"
  },
  "cid_sugerido": "string — Hipótese (CID-10) mais provável (ex: 'Hipótese (CID): J06.9 - Infecção aguda das vias aéreas superiores') ou vazio se não há dados suficientes",
  "alertas_vermelhos": ["array de strings — sinais de alarme que requerem atenção imediata, ex: 'Dor torácica com irradiação para o braço esquerdo — avaliar SCA'"],
  "medicamentos_sugeridos": ["array de strings — opções terapêuticas com dosagem indicativa, ex: 'Dipirona 500mg VO 6/6h por 5 dias (analgesia/antitérmica)'"],
  "suggestions": ["array de até 4 strings — use frases curtas em formato clínico, incluindo pelo menos uma hipótese diagnóstica e uma conduta geral, ex: 'Hipótese (CID): J06.9 - Infecção aguda de vias aéreas superiores' e 'Conduta: Visando continuidade do tratamento, prescrevo analgesia sintomática e oriento retorno se piora dos sintomas'"]
}

MODELO RECOMENDADO PARA A NARRATIVA CLÍNICA (guia interno — adapte ao contexto):
- Queixa e duração: ...
- Evolução / anamnese: ...
- Hipótese diagnóstica (CID): ...
- Conduta: Visando continuidade do tratamento, prescrevo/oriento ...

REGRAS:
- Mantenha e enriqueça os campos da anamnese anterior quando não houver informação nova
- Se um campo não tiver dados, use string vazia ou array vazio []
- Não invente informações que não estejam no transcript
- Alertas vermelhos: apenas se houver base clara no transcript (não suponha)
- Medicamentos sugeridos: inclua apenas se a queixa principal estiver clara
- Nas suggestions, dê preferência a frases que possam ser facilmente coladas em um prontuário clínico profissional
- Seja objetivo e use terminologia médica adequada
- Responda APENAS o JSON, sem texto antes ou depois
""";

        var userContent = string.IsNullOrWhiteSpace(previousAnamnesisJson)
            ? $"Transcript da consulta (incluindo identificação de locutor quando disponível):\n\n{transcriptSoFar}"
            : $"Anamnese anterior (mantenha e enriqueça com novas informações do transcript):\n{previousAnamnesisJson}\n\nTranscript atualizado:\n{transcriptSoFar}";

        var requestBody = new
        {
            model = _config.Value?.Model ?? "gpt-4o",
            messages = new object[]
            {
                new { role = "system", content = (object)systemPrompt },
                new { role = "user", content = (object)userContent }
            },
            max_tokens = 2000,
            temperature = 0.3
        };

        var startedAt = DateTime.UtcNow;
        var json = JsonSerializer.Serialize(requestBody, JsonOptions);
        var promptHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json))).ToLowerInvariant();
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        client.Timeout = TimeSpan.FromSeconds(45);

        using var requestContent = new StringContent(json, Encoding.UTF8, "application/json");
        _logger.LogInformation("[Anamnese IA] Chamando OpenAI: model={Model} transcriptPreview={Preview}",
            _config.Value?.Model ?? "gpt-4o", transcriptSoFar.Length > 100 ? transcriptSoFar[..100] + "..." : transcriptSoFar);

        var response = await client.PostAsync($"{ApiBaseUrl}/chat/completions", requestContent, cancellationToken);
        var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("[Anamnese IA] ANAMNESE_NAO_OCORRE: OpenAI API error StatusCode={StatusCode} | Response={Response}",
                response.StatusCode, responseJson.Length > 500 ? responseJson[..500] + "..." : responseJson);
            try
            {
                await _aiInteractionLogRepository.LogAsync(AiInteractionLog.Create(
                    serviceName: nameof(ConsultationAnamnesisService),
                    modelName: _config.Value?.Model ?? "gpt-4o",
                    promptHash: promptHash,
                    success: false,
                    durationMs: (long)(DateTime.UtcNow - startedAt).TotalMilliseconds,
                    errorMessage: responseJson.Length > 500 ? responseJson[..500] : responseJson), cancellationToken);
            }
            catch (Exception logEx)
            {
                _logger.LogWarning(logEx, "[Anamnese IA] Falha ao gravar log de erro em ai_interaction_logs.");
            }
            return null;
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
            _logger.LogWarning(ex, "[Anamnese IA] ANAMNESE_NAO_OCORRE: Falha ao extrair content da resposta OpenAI. ResponsePreview={Preview}",
                responseJson.Length > 500 ? responseJson[..500] + "..." : responseJson);
            return null;
        }

        if (string.IsNullOrWhiteSpace(content))
        {
            _logger.LogWarning("[Anamnese IA] ANAMNESE_NAO_OCORRE: OpenAI retornou content vazio. ResponsePreview={Preview}",
                responseJson.Length > 300 ? responseJson[..300] + "..." : responseJson);
            return null;
        }

        var cleaned = CleanJsonResponse(content);
        try
        {
            using var parsed = JsonDocument.Parse(cleaned);
            var root = parsed.RootElement;

            // Serialize full anamnesis object (including new fields) back to JSON
            var anamnesisJson = root.TryGetProperty("anamnesis", out var a) && a.ValueKind == JsonValueKind.Object
                ? a.GetRawText()
                : "{}";

            // Enrich anamnesis JSON with new top-level fields for the frontend panel
            var enrichedObj = new Dictionary<string, object>();
            if (root.TryGetProperty("anamnesis", out var anaEl) && anaEl.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in anaEl.EnumerateObject())
                    enrichedObj[prop.Name] = prop.Value.GetRawText();
            }
            if (root.TryGetProperty("cid_sugerido", out var cidEl))
                enrichedObj["cid_sugerido"] = cidEl.GetRawText();
            if (root.TryGetProperty("alertas_vermelhos", out var avEl) && avEl.ValueKind == JsonValueKind.Array)
                enrichedObj["alertas_vermelhos"] = avEl.GetRawText();
            if (root.TryGetProperty("medicamentos_sugeridos", out var msEl) && msEl.ValueKind == JsonValueKind.Array)
                enrichedObj["medicamentos_sugeridos"] = msEl.GetRawText();

            var enrichedJson = "{" + string.Join(",", enrichedObj.Select(kv => $"\"{kv.Key}\":{kv.Value}")) + "}";

            // Extract suggestions list
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

            // Also add alerts to suggestions list for backwards compat
            if (root.TryGetProperty("alertas_vermelhos", out var alertsEl) && alertsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in alertsEl.EnumerateArray())
                {
                    var str = item.ValueKind == JsonValueKind.String ? item.GetString() : item.GetRawText();
                    if (!string.IsNullOrWhiteSpace(str))
                        suggestions.Insert(0, $"🚨 {str.Trim('"').Trim()}");
                }
            }

            // Evidências PubMed: busca por CID, sintomas e queixa; traduz abstracts para português
            var evidence = await FetchAndTranslateEvidenceAsync(root, apiKey, cancellationToken);

            try
            {
                await _aiInteractionLogRepository.LogAsync(AiInteractionLog.Create(
                    serviceName: nameof(ConsultationAnamnesisService),
                    modelName: _config.Value?.Model ?? "gpt-4o",
                    promptHash: promptHash,
                    success: true,
                    responseSummary: cleaned.Length > 500 ? cleaned[..500] : cleaned,
                    durationMs: (long)(DateTime.UtcNow - startedAt).TotalMilliseconds), cancellationToken);
            }
            catch (Exception logEx)
            {
                _logger.LogWarning(logEx, "[Anamnese IA] Falha ao gravar em ai_interaction_logs (resultado será retornado mesmo assim). Verifique se a tabela existe.");
            }

            _logger.LogInformation("[Anamnese IA] SUCESSO: anamnesisJsonLen={Len} suggestions={Count} evidence={EvidenceCount} durationMs={Ms}",
                enrichedJson.Length, suggestions.Count, evidence.Count, (long)(DateTime.UtcNow - startedAt).TotalMilliseconds);

            return new ConsultationAnamnesisResult(enrichedJson, suggestions, evidence);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Anamnese IA] ANAMNESE_NAO_OCORRE: Falha ao parsear JSON de resposta. Conteúdo: {Content}",
                cleaned[..Math.Min(300, cleaned.Length)]);
            return null;
        }
    }

    private static string CleanJsonResponse(string raw)
    {
        var s = raw.Trim();
        if (s.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            s = s["```json".Length..];
        else if (s.StartsWith("```"))
            s = s["```".Length..];
        if (s.EndsWith("```"))
            s = s[..^3];
        return s.Trim();
    }

    private static List<string> ExtractSearchTerms(JsonElement root)
    {
        var terms = new List<string>();

        if (root.TryGetProperty("cid_sugerido", out var cidEl))
        {
            var cidStr = cidEl.GetString() ?? "";
            var match = CidCodeRegex.Match(cidStr);
            if (match.Success)
                terms.Add(match.Groups[1].Value);
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
        CancellationToken cancellationToken)
    {
        try
        {
            var searchTerms = ExtractSearchTerms(root);
            if (searchTerms.Count == 0)
                return Array.Empty<EvidenceItemDto>();

            var rawEvidence = await _evidenceSearchService.SearchAsync(searchTerms, 7, cancellationToken);
            if (rawEvidence.Count == 0)
                return rawEvidence;

            return await ExtractRelevantEvidenceAsync(rawEvidence, root, apiKey, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Evidências: falha na busca ou extração.");
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
        CancellationToken cancellationToken)
    {
        if (items.Count == 0)
            return items;

        var context = BuildClinicalContextForPrompt(root);
        var articlesBlock = string.Join("\n\n---\n\n",
            items.Select((e, i) => $"[{i}]\nTítulo: {e.Title}\nAbstract: {e.Abstract}"));

        var prompt = """
Você é um assistente de apoio ao diagnóstico médico. Com base no contexto clínico do paciente e nos abstracts dos artigos, extraia o que REALMENTE ajuda o médico a entender o caso e tomar decisão.

CONTEXTO CLÍNICO DO PACIENTE:
""" + context + """

ARTIGOS (abstracts em inglês):
""" + articlesBlock + """

Para CADA artigo [0], [1], etc., faça:
1. Selecione 2-3 trechos (citações) do abstract que sejam RELEVANTES para o caso — frases que apoiam diagnóstico, conduta ou critérios clínicos.
2. Traduza esses trechos para português brasileiro.
3. Escreva em 1-2 frases a RELEVÂNCIA CLÍNICA: como este artigo ajuda o médico neste caso específico (ex: "Corrobora o uso de X em Y"; "Atenção aos critérios de Z").

Responda APENAS um JSON válido, array de objetos na mesma ordem dos artigos:
[
  { "excerpts": ["trecho1 traduzido", "trecho2 traduzido"], "clinicalRelevance": "Como este artigo ajuda neste caso." },
  ...
]
Se um artigo não for relevante ao caso, use excerpts: [] e clinicalRelevance: "Pouca relevância direta para este caso."
Apenas o JSON, sem markdown.
""";

        var requestBody = new
        {
            model = _config.Value?.Model ?? "gpt-4o",
            messages = new object[] { new { role = "user", content = (object)prompt } },
            max_tokens = 4000,
            temperature = 0.2
        };

        var json = JsonSerializer.Serialize(requestBody, JsonOptions);
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        client.Timeout = TimeSpan.FromSeconds(45);

        using var requestContent = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await client.PostAsync($"{ApiBaseUrl}/chat/completions", requestContent, cancellationToken);
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
                {
                    foreach (var e in exEl.EnumerateArray())
                    {
                        var s = e.GetString()?.Trim();
                        if (!string.IsNullOrEmpty(s))
                            excerpts.Add(s);
                    }
                }
                if (el.TryGetProperty("clinicalRelevance", out var relEl))
                    relevance = relEl.GetString()?.Trim() ?? "";

                result.Add(new EvidenceItemDto(
                    item.Title,
                    item.Abstract,
                    item.Source,
                    TranslatedAbstract: excerpts.Count > 0 ? string.Join("\n\n", excerpts) : null,
                    RelevantExcerpts: excerpts.Count > 0 ? excerpts : null,
                    ClinicalRelevance: !string.IsNullOrEmpty(relevance) ? relevance : null,
                    Provider: item.Provider));
                idx++;
            }
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Evidências: falha ao parsear resposta de extração de trechos.");
            return Array.Empty<EvidenceItemDto>();
        }
    }
}
