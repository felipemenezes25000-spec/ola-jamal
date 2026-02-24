using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Consultation;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// Serviço de anamnese estruturada e sugestões clínicas por IA (GPT-4o) durante a consulta.
/// Gera: anamnese SOAP, CID sugerido, alertas de gravidade, medicamentos sugeridos e hipóteses.
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

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<OpenAIConfig> _config;
    private readonly ILogger<ConsultationAnamnesisService> _logger;

    public ConsultationAnamnesisService(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        ILogger<ConsultationAnamnesisService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
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
    "queixa_principal": "string — o que trouxe o paciente à consulta",
    "historia_doenca_atual": "string — evolução, início, fatores de melhora/piora",
    "sintomas": "string ou array — lista dos sintomas referidos",
    "medicamentos_em_uso": "string ou array — medicamentos que o paciente já usa",
    "alergias": "string — alergias conhecidas (medicamentos, alimentos, outros)",
    "antecedentes_relevantes": "string — histórico médico, cirurgias, comorbidades",
    "outros": "string — qualquer informação adicional relevante"
  },
  "cid_sugerido": "string — CID-10 mais provável (ex: J06.9 - Infecção aguda das vias aéreas superiores) ou vazio se não há dados suficientes",
  "alertas_vermelhos": ["array de strings — sinais de alarme que requerem atenção imediata, ex: 'Dor torácica com irradiação para o braço esquerdo — avaliar SCA'"],
  "medicamentos_sugeridos": ["array de strings — opções terapêuticas com dosagem indicativa, ex: 'Dipirona 500mg VO 6/6h por 5 dias (analgesia/antitérmica)'"],
  "suggestions": ["array de até 4 strings — hipóteses diagnósticas ou recomendações clínicas curtas, ex: 'Hipótese: HAS descompensada — verificar adesão ao tratamento'"]
}

REGRAS:
- Mantenha e enriqueça os campos da anamnese anterior quando não houver informação nova
- Se um campo não tiver dados, use string vazia ou array vazio []
- Não invente informações que não estejam no transcript
- Alertas vermelhos: apenas se houver base clara no transcript (não suponha)
- Medicamentos sugeridos: inclua apenas se a queixa principal estiver clara
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

            return new ConsultationAnamnesisResult(enrichedJson, suggestions);
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
}
