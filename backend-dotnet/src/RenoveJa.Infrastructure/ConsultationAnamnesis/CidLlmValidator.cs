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

        var systemPrompt = @"Você é um validador de CID-10 para telemedicina brasileira. REGRAS ESTRITAS:

RESPONDA APENAS com JSON válido, SEM markdown, SEM explicações:
{""valid"": true/false, ""reason"": ""..."", ""suggested_cid"": ""CÓDIGO - Descrição"", ""confidence"": ""alta/media/baixa""}

CRITÉRIOS DE VALIDAÇÃO:
1. ""valid"": true SOMENTE se o CID tem relação DIRETA com sintomas relatados pelo paciente
2. ""valid"": false se o CID não tem NENHUMA relação com o transcript
3. ""suggested_cid"": se false, sugira o CID MAIS PROVÁVEL baseado APENAS no que o paciente disse
4. ""confidence"": sua confiança na validação (alta = certeza, media = provável, baixa = incerto)

REGRAS ANTI-ALUCINAÇÃO (OBRIGATÓRIO):
- CID de substância (F10-F19) é INVÁLIDO se paciente NÃO mencionou uso de substâncias
- CID de tireoide (E04-E07) é INVÁLIDO se paciente NÃO mencionou pescoço/tireoide/TSH
- CID endócrino (E10-E66) requer menção de sintomas endócrinos específicos
- CID psiquiátrico (F20-F99) requer menção de sintomas psiquiátricos
- CID cardiovascular (I00-I99) requer menção de sintomas cardíacos
- CID respiratório (J00-J99) requer menção de sintomas respiratórios
- NUNCA sugira CID baseado em inferência — use APENAS o que o paciente DISSE
- Se o transcript é curto ou ambíguo, prefira CIDs genéricos (R00-R99 — sintomas)
- Se não há informação suficiente, responda: {""valid"": false, ""reason"": ""Dados insuficientes"", ""suggested_cid"": ""R69 - Causas desconhecidas de morbidade"", ""confidence"": ""baixa""}

CATEGORIAS R (SINTOMAS/SINAIS) — use quando não há diagnóstico claro:
- R05 Tosse | R10 Dor abdominal | R11 Náusea/vômito | R50 Febre | R51 Cefaleia
- R53 Mal-estar/fadiga | R42 Tontura | R06 Dispneia | R00 Palpitações
- R69 Causas desconhecidas de morbidade (fallback genérico)";

        var userContent = $@"TRANSCRIPT DA CONSULTA (o que o paciente realmente disse):
---
{(transcript.Length > 2000 ? transcript[..2000] : transcript)}
---

CID SUGERIDO PELA IA: {cidSugerido}

DIAGNÓSTICO DIFERENCIAL DA IA: {diagnosticoDiferencialJson ?? "não disponível"}

TAREFA: O CID ""{cidSugerido}"" é coerente com o que o paciente relatou no transcript acima?
Lembre-se: valide APENAS com base no que o paciente DISSE, não em inferências.";

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
                max_tokens = 300,
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
            var validatorConfidence = resultRoot.TryGetProperty("confidence", out var confEl) ? confEl.GetString() : "media";

            _logger.LogInformation("[CidValidator] CID '{Cid}' validado: valid={Valid}, reason={Reason}, suggested={Suggested}, confidence={Confidence}",
                cidSugerido, isValid, reason, suggestedCid, validatorConfidence);

            return new CidValidationResult(isValid, reason, suggestedCid, validatorConfidence);
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

public sealed record CidValidationResult(bool IsValid, string? Reason, string? SuggestedCid, string? ValidatorConfidence = "media")
{
    public static CidValidationResult FailOpen() => new(true, null, null, null);
}
