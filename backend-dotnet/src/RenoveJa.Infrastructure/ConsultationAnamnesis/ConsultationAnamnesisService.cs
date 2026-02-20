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
/// Serviço de anamnese estruturada e sugestões por IA (GPT) durante a consulta.
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
Você é um assistente de apoio à consulta médica. Sua função é ESTRUTURAR a anamnese e sugerir hipóteses/recomendações com base no que o paciente disse. Tudo é APENAS APOIO À DECISÃO CLÍNICA; a conduta final é exclusivamente do médico.

Responda em um ÚNICO JSON com exatamente estes campos (em português, objetivo e ético):

- anamnesis (objeto): atualize apenas com novas informações do transcript; mantenha o que já estava preenchido. Campos: queixa_principal, historia_doenca_atual, sintomas (array ou texto), medicamentos_em_uso (array ou texto), alergias (texto), antecedentes_relevantes (texto), outros (texto opcional).

- suggestions (array de strings): até 3 itens, cada um uma hipótese diagnóstica ou recomendação curta (ex.: "Considerar solicitar glicemia de jejum", "Hipótese: HAS descompensada"). Seja conciso. Se não houver base no transcript, retorne array vazio.

Regras: conteúdo é de consulta médica; seja objetivo; não invente dados que não estejam no transcript; mantenha anamnese anterior quando não houver informação nova.
Responda APENAS com o JSON, sem markdown e sem texto antes ou depois.
""";

        var userContent = string.IsNullOrWhiteSpace(previousAnamnesisJson)
            ? $"Transcript da consulta (até o momento):\n\n{transcriptSoFar}"
            : $"Anamnese anterior (mantenha e atualize com o transcript):\n{previousAnamnesisJson}\n\nTranscript novo:\n{transcriptSoFar}";

        var requestBody = new
        {
            model = _config.Value?.Model ?? "gpt-4o",
            messages = new object[]
            {
                new { role = "system", content = (object)systemPrompt },
                new { role = "user", content = (object)userContent }
            },
            max_tokens = 1500
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
            _logger.LogWarning("Anamnese IA API error: {StatusCode}, {Response}", response.StatusCode, err);
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
            var anamnesisEl = root.TryGetProperty("anamnesis", out var a) ? a : default;
            var suggestionsEl = root.TryGetProperty("suggestions", out var s) ? s : default;

            var anamnesisJson = anamnesisEl.ValueKind == JsonValueKind.Object ? anamnesisEl.GetRawText() : "{}";
            var suggestions = new List<string>();
            if (suggestionsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in suggestionsEl.EnumerateArray())
                {
                    var str = item.ValueKind == JsonValueKind.String ? item.GetString() : item.GetRawText();
                    if (!string.IsNullOrWhiteSpace(str))
                        suggestions.Add(str.Trim());
                }
            }

            return new ConsultationAnamnesisResult(anamnesisJson, suggestions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Anamnese IA: falha ao parsear JSON de resposta.");
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
