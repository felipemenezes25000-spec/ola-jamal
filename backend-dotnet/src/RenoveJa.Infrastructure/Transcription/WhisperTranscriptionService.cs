using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.Transcription;

/// <summary>
/// Transcrição de áudio via OpenAI Whisper API.
/// Endpoint: POST /v1/audio/transcriptions
/// Usa a mesma chave OpenAI (OpenAI:ApiKey) que GPT-4o.
/// </summary>
public class WhisperTranscriptionService : ITranscriptionService
{
    private const string ApiUrl = "https://api.openai.com/v1/audio/transcriptions";
    private const string DefaultModel = "whisper-1";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<OpenAIConfig> _config;
    private readonly ILogger<WhisperTranscriptionService> _logger;

    public WhisperTranscriptionService(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        ILogger<WhisperTranscriptionService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public async Task<string?> TranscribeAsync(
        byte[] audioBytes,
        string? fileName = null,
        string? previousContext = null,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[Whisper] TranscribeAsync INICIO | fileName={FileName} | audioBytesLen={Len} | hasContext={HasCtx}",
            fileName ?? "(null)", audioBytes?.Length ?? 0, !string.IsNullOrWhiteSpace(previousContext));

        var cfg = _config.Value ?? new OpenAIConfig();
        var apiKey = cfg.ApiKey?.Trim();
        if (string.IsNullOrEmpty(apiKey) || apiKey.Contains("YOUR_") || apiKey.Contains("_HERE"))
        {
            _logger.LogWarning("[Whisper] TRANSCRICAO_NAO_OCORRE: OpenAI:ApiKey não configurada. Verifique OpenAI:ApiKey ou variável OpenAI__ApiKey.");
            return null;
        }

        if (audioBytes == null || audioBytes.Length == 0)
        {
            _logger.LogWarning("[Whisper] TRANSCRICAO_NAO_OCORRE: Áudio vazio ou nulo recebido.");
            return null;
        }

        var fileExt = ResolveFileExtension(fileName);
        var safeFileName = string.IsNullOrWhiteSpace(fileName) ? $"audio{fileExt}" : Path.GetFileName(fileName);

        _logger.LogInformation("[Whisper] Enviando para API: {Bytes} bytes, fileName={FileName}",
            audioBytes.Length, safeFileName);

        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(audioBytes), "file", safeFileName);
        content.Add(new StringContent(DefaultModel), "model");
        content.Add(new StringContent("pt"), "language");

        // Prompt de contexto: últimas ~180 palavras do transcript anterior.
        // O Whisper usa isso para manter continuidade entre chunks, evitando
        // palavras cortadas, repetições e erros de contexto nas fronteiras.
        if (!string.IsNullOrWhiteSpace(previousContext))
        {
            var contextTrimmed = TrimToLastWords(previousContext, 180);
            content.Add(new StringContent(contextTrimmed), "prompt");
            _logger.LogDebug("[Whisper] Prompt de contexto: {Len} palavras", contextTrimmed.Split(' ').Length);
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, ApiUrl);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = content;

        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(60);

        string json;
        try
        {
            var response = await client.SendAsync(request, cancellationToken);
            json = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[Whisper] TRANSCRICAO_NAO_OCORRE: API erro StatusCode={StatusCode} | Response={Response}",
                    response.StatusCode, json.Length > 500 ? json[..500] + "..." : json);
                return null;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Whisper] TRANSCRICAO_NAO_OCORRE: Exceção ao chamar API Whisper.");
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            var text = doc.RootElement.TryGetProperty("text", out var textProp)
                ? textProp.GetString()?.Trim()
                : null;

            if (!string.IsNullOrWhiteSpace(text))
            {
                _logger.LogInformation("[Whisper] Transcrição OK: {Length} caracteres | preview={Preview}",
                    text.Length, text.Length > 80 ? text[..80] + "..." : text);
                return text;
            }

            _logger.LogInformation("[Whisper] TRANSCRICAO_VAZIA: Nenhuma fala detectada no áudio.");
            return null;
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "[Whisper] TRANSCRICAO_NAO_OCORRE: Falha ao parsear JSON. ResponsePreview={Preview}",
                json.Length > 500 ? json[..500] + "..." : json);
            return null;
        }
    }

    /// <summary>
    /// Extrai as últimas N palavras de um texto (para prompt de contexto do Whisper).
    /// O Whisper aceita até ~224 tokens como prompt; 180 palavras é um limite seguro.
    /// </summary>
    private static string TrimToLastWords(string text, int maxWords)
    {
        var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length <= maxWords) return text;
        return string.Join(' ', words[^maxWords..]);
    }

    private static string ResolveFileExtension(string? fileName)
    {
        var ext = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
        if (!string.IsNullOrEmpty(ext)) return ext;
        return ".webm";
    }
}
