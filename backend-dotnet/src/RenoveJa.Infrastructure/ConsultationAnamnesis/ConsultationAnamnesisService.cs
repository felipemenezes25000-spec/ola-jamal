using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Consultation;
using RenoveJa.Application.Interfaces;

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
    private readonly IPubMedService _pubmedService;

    public ConsultationAnamnesisService(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        ILogger<ConsultationAnamnesisService> logger,
        IPubMedService pubmedService)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
        _pubmedService = pubmedService;
    }

    public async Task<ConsultationAnamnesisResult?> UpdateAnamnesisAndSuggestionsAsync(
        string transcriptSoFar,
        string? previousAnamnesisJson,
        CancellationToken cancellationToken = default)
    {
        var apiKey = _config.Value?.ApiKey?.Trim();
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogDebug("Anamnese IA: OpenAI:ApiKey não configurada.");
            return null;
        }

        if (string.IsNullOrWhiteSpace(transcriptSoFar))
            return null;

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

        var json = JsonSerializer.Serialize(requestBody, JsonOptions);
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        client.Timeout = TimeSpan.FromSeconds(45);

        using var requestContent = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await client.PostAsync($"{ApiBaseUrl}/chat/completions", requestContent, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning("Anamnese IA API error: {StatusCode}, {Body}", response.StatusCode, err);
            return null;
        }

        var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
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
            _logger.LogWarning(ex, "Anamnese IA: falha ao extrair content da resposta.");
            return null;
        }

        if (string.IsNullOrWhiteSpace(content))
            return null;

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

            return new ConsultationAnamnesisResult(enrichedJson, suggestions, evidence);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Anamnese IA: falha ao parsear JSON de resposta. Conteúdo: {Content}", cleaned[..Math.Min(200, cleaned.Length)]);
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

            var rawEvidence = await _pubmedService.SearchAsync(searchTerms, 5, cancellationToken);
            if (rawEvidence.Count == 0)
                return rawEvidence;

            return await TranslateEvidenceAsync(rawEvidence, apiKey, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Evidências PubMed: falha na busca ou tradução.");
            return Array.Empty<EvidenceItemDto>();
        }
    }

    private async Task<IReadOnlyList<EvidenceItemDto>> TranslateEvidenceAsync(
        IReadOnlyList<EvidenceItemDto> items,
        string apiKey,
        CancellationToken cancellationToken)
    {
        if (items.Count == 0)
            return items;

        var toTranslate = items.Select((e, i) => $"[{i}]\nTítulo: {e.Title}\nAbstract: {e.Abstract}").ToList();
        var combined = string.Join("\n\n---\n\n", toTranslate);

        var prompt = "Traduza os abstracts abaixo para português brasileiro. Mantenha o tom técnico/científico.\n" +
            "Responda em JSON com um array de strings na mesma ordem: [\"tradução1\", \"tradução2\", ...].\n" +
            "Apenas o JSON, sem markdown.\n\n" + combined;

        var requestBody = new
        {
            model = _config.Value?.Model ?? "gpt-4o",
            messages = new object[] { new { role = "user", content = (object)prompt } },
            max_tokens = 3000,
            temperature = 0.2
        };

        var json = JsonSerializer.Serialize(requestBody, JsonOptions);
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        client.Timeout = TimeSpan.FromSeconds(30);

        using var requestContent = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await client.PostAsync($"{ApiBaseUrl}/chat/completions", requestContent, cancellationToken);
        if (!response.IsSuccessStatusCode)
            return items;

        var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
        List<string>? translations = null;
        try
        {
            using var doc = JsonDocument.Parse(responseJson);
            var content = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
            if (!string.IsNullOrWhiteSpace(content))
            {
                var cleaned = CleanJsonResponse(content);
                using var arr = JsonDocument.Parse(cleaned);
                translations = new List<string>();
                foreach (var el in arr.RootElement.EnumerateArray())
                    translations.Add(el.GetString() ?? "");
            }
        }
        catch { /* ignore */ }

        if (translations == null || translations.Count != items.Count)
            return items;

        return items.Select((e, i) =>
            new EvidenceItemDto(e.Title, e.Abstract, e.Source,
                i < translations.Count ? translations[i] : null)).ToList();
    }
}
