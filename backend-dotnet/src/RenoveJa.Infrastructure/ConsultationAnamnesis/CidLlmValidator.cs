using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// MELHORIA 2: Segundo pass de validação — pergunta ao LLM se o CID faz sentido para o transcript.
/// Chamada rápida, temperatura 0, resposta curta. Custo mínimo por consulta.
/// </summary>
public sealed class CidLlmValidator
{
    private const string GeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = false
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<OpenAIConfig> _config;
    private readonly ILogger<CidLlmValidator> _logger;

    public CidLlmValidator(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        ILogger<CidLlmValidator> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Valida se o CID sugerido faz sentido para o transcript dado.
    /// Retorna (isValid, suggestedCid) onde suggestedCid é alternativa se inválido.
    /// Timeout curto (15s). Se falhar, retorna (true, null) — fail-open, não bloqueia.
    /// </summary>
    public async Task<CidValidationResult> ValidateCidAsync(
        string transcript,
        string cidSugerido,
        string? diagnosticoDiferencialJson,
        CancellationToken cancellationToken)
    {
        var apiKey = GetApiKey();
        if (string.IsNullOrEmpty(apiKey))
            return CidValidationResult.FailOpen();

        var model = GetValidationModel();
        var (_, baseUrl) = ResolveProvider(model);

        var systemPrompt = @"Você é um validador de CID-10 para telemedicina brasileira.
Responda APENAS com JSON: {""valid"": true/false, ""reason"": ""..."", ""suggested_cid"": ""CÓDIGO - Descrição""}
- ""valid"": true se o CID é razoável para os sintomas do transcript
- ""valid"": false se o CID não tem NENHUMA relação com o que o paciente relatou
- ""suggested_cid"": se false, sugira o CID mais provável com base no transcript (formato: ""CÓDIGO - Descrição"")
- ""reason"": explicação em 1 frase

REGRAS:
- CID de álcool (F10.x) é INVÁLIDO se paciente não mencionou álcool
- CID de tireoide (E04.x) é INVÁLIDO se paciente não mencionou pescoço/tireoide
- Avalie APENAS se o CID tem coerência com os SINTOMAS relatados, não com a conduta
- Responda APENAS o JSON, nada mais";

        var userContent = $@"TRANSCRIPT: {(transcript.Length > 1500 ? transcript[..1500] : transcript)}

CID SUGERIDO: {cidSugerido}

DIAGNÓSTICO DIFERENCIAL: {diagnosticoDiferencialJson ?? "não disponível"}

O CID ""{cidSugerido}"" é válido para este transcript?";

        try
        {
            var requestBody = new
            {
                model,
                messages = new object[]
                {
                    new { role = "system", content = (object)systemPrompt },
                    new { role = "user", content = (object)userContent }
                },
                max_tokens = 200,
                temperature = 0.0
            };

            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            client.Timeout = TimeSpan.FromSeconds(15);

            var json = JsonSerializer.Serialize(requestBody, JsonOptions);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"{baseUrl}/chat/completions", content, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[CidValidator] LLM retornou {StatusCode} — fail-open.", response.StatusCode);
                return CidValidationResult.FailOpen();
            }

            var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(responseJson);
            var choices = doc.RootElement.GetProperty("choices");
            var responseContent = choices.GetArrayLength() > 0
                ? choices[0].GetProperty("message").GetProperty("content").GetString() ?? ""
                : "";

            // Limpar markdown
            responseContent = responseContent
                .Replace("```json", "").Replace("```", "")
                .Trim();

            using var resultDoc = JsonDocument.Parse(responseContent);
            var resultRoot = resultDoc.RootElement;

            var isValid = resultRoot.TryGetProperty("valid", out var validEl) && validEl.GetBoolean();
            var reason = resultRoot.TryGetProperty("reason", out var reasonEl) ? reasonEl.GetString() : null;
            var suggestedCid = resultRoot.TryGetProperty("suggested_cid", out var sugEl) ? sugEl.GetString() : null;

            _logger.LogInformation("[CidValidator] CID '{Cid}' validado: valid={Valid}, reason={Reason}, suggested={Suggested}",
                cidSugerido, isValid, reason, suggestedCid);

            return new CidValidationResult(isValid, reason, suggestedCid);
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("[CidValidator] Timeout na validação — fail-open.");
            return CidValidationResult.FailOpen();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[CidValidator] Erro na validação — fail-open.");
            return CidValidationResult.FailOpen();
        }
    }

    private string? GetApiKey()
    {
        // Preferir Gemini (mais barato para validação)
        var geminiKey = _config.Value?.GeminiApiKey?.Trim();
        if (!string.IsNullOrEmpty(geminiKey) && !geminiKey.Contains("YOUR_"))
            return geminiKey;

        var openAiKey = _config.Value?.ApiKey?.Trim();
        return !string.IsNullOrEmpty(openAiKey) && !openAiKey.Contains("YOUR_") ? openAiKey : null;
    }

    private string GetValidationModel()
    {
        var geminiKey = _config.Value?.GeminiApiKey?.Trim();
        if (!string.IsNullOrEmpty(geminiKey) && !geminiKey.Contains("YOUR_"))
            return "gemini-2.5-flash";
        return "gpt-4o-mini";
    }

    private (string apiKey, string baseUrl) ResolveProvider(string model)
    {
        if (model.StartsWith("gemini", StringComparison.OrdinalIgnoreCase))
        {
            var customUrl = _config.Value?.GeminiApiBaseUrl?.Trim();
            var baseUrl = !string.IsNullOrEmpty(customUrl) ? customUrl : GeminiBaseUrl;
            return (GetApiKey()!, baseUrl);
        }
        return (GetApiKey()!, "https://api.openai.com/v1");
    }
}

public sealed record CidValidationResult(bool IsValid, string? Reason, string? SuggestedCid)
{
    public static CidValidationResult FailOpen() => new(true, null, null);
}
