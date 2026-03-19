using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// Chamadas HTTP OpenAI-compatible (GPT / Gemini) para geração de anamnese — isolado do orquestrador.
/// </summary>
public sealed class ConsultationAnamnesisLlmClient
{
    internal const string AiInteractionServiceName = nameof(ConsultationAnamnesisService);

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
    private readonly ILogger<ConsultationAnamnesisLlmClient> _logger;
    private readonly IAiInteractionLogRepository _aiInteractionLogRepository;

    public ConsultationAnamnesisLlmClient(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        ILogger<ConsultationAnamnesisLlmClient> logger,
        IAiInteractionLogRepository aiInteractionLogRepository)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
        _aiInteractionLogRepository = aiInteractionLogRepository;
    }

    /// <summary>
    /// Envia chat/completions e devolve JSON bruto da API (inclui fallback Gemini após falha OpenAI).
    /// </summary>
    public async Task<AnamnesisLlmRawResult?> SendAnamnesisChatAsync(
        string anamnesisModel,
        string systemPrompt,
        string userContent,
        CancellationToken cancellationToken)
    {
        var (apiKey, apiBaseUrl) = ResolveProvider(anamnesisModel);
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("[Anamnese IA v2] ANAMNESE_NAO_OCORRE: Nenhuma API key configurada (Gemini__ApiKey ou OpenAI__ApiKey).");
            return null;
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
                    serviceName: AiInteractionServiceName,
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
                    return new AnamnesisLlmRawResult(fallbackJson, fallbackModel, promptHash, startedAt);
                }

                _logger.LogWarning("[Anamnese IA v2] Fallback Gemini também falhou: {StatusCode}", fallbackResponse.StatusCode);
                return null;
            }

            return null;
        }

        return new AnamnesisLlmRawResult(responseJson, anamnesisModel, promptHash, startedAt);
    }

    internal string GetAnamnesisModel()
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
}

public sealed record AnamnesisLlmRawResult(
    string ResponseJson,
    string ModelUsed,
    string PromptHash,
    DateTime StartedAt);
