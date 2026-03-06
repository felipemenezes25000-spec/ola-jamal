using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.Transcription;

/// <summary>
/// Transcrição de áudio via Deepgram API.
/// Endpoint: POST /v1/listen
/// </summary>
public class DeepgramTranscriptionService : ITranscriptionService
{
    private const string ApiUrl = "https://api.deepgram.com/v1/listen";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<DeepgramConfig> _config;
    private readonly ILogger<DeepgramTranscriptionService> _logger;

    public DeepgramTranscriptionService(
        IHttpClientFactory httpClientFactory,
        IOptions<DeepgramConfig> config,
        ILogger<DeepgramTranscriptionService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public async Task<string?> TranscribeAsync(
        byte[] audioBytes,
        string? fileName = null,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[Deepgram] TranscribeAsync INICIO | fileName={FileName} | audioBytesLen={Len}",
            fileName ?? "(null)", audioBytes?.Length ?? 0);

        var cfg = _config.Value ?? new DeepgramConfig();
        var apiKey = cfg.ApiKey?.Trim();
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("[Deepgram] TRANSCRICAO_NAO_OCORRE: DEEPGRAM_API_KEY não configurada. Verifique Deepgram:ApiKey ou variável Deepgram__ApiKey.");
            return null;
        }

        if (audioBytes == null || audioBytes.Length == 0)
        {
            _logger.LogWarning("[Deepgram] TRANSCRICAO_NAO_OCORRE: Áudio vazio ou nulo recebido.");
            return null;
        }

        var model = string.IsNullOrWhiteSpace(cfg.Model) ? "nova-2" : cfg.Model.Trim();
        var language = string.IsNullOrWhiteSpace(cfg.Language) ? "pt-BR" : cfg.Language.Trim();
        var mime = ResolveMimeType(fileName);
        var url =
            $"{ApiUrl}?model={Uri.EscapeDataString(model)}&language={Uri.EscapeDataString(language)}&smart_format=true&punctuate=true";

        _logger.LogInformation(
            "[Deepgram] Enviando para API: {Bytes} bytes, mime={Mime}, model={Model}, language={Language}",
            audioBytes.Length, mime, model, language);

        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Token", apiKey);
        request.Content = new ByteArrayContent(audioBytes);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(mime);

        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(30);

        string json;
        try
        {
            var response = await client.SendAsync(request, cancellationToken);
            json = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[Deepgram] TRANSCRICAO_NAO_OCORRE: API erro StatusCode={StatusCode} | Response={Response}",
                    response.StatusCode, json.Length > 500 ? json[..500] + "..." : json);
                return null;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Deepgram] TRANSCRICAO_NAO_OCORRE: Exceção ao chamar API Deepgram.");
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            var results = doc.RootElement.GetProperty("results");
            var channels = results.GetProperty("channels");
            if (channels.GetArrayLength() == 0)
            {
                _logger.LogWarning("[Deepgram] TRANSCRICAO_NAO_OCORRE: Resposta JSON sem channels. ResponsePreview={Preview}",
                    json.Length > 300 ? json[..300] + "..." : json);
                return null;
            }
            var alternatives = channels[0].GetProperty("alternatives");
            if (alternatives.GetArrayLength() == 0)
            {
                _logger.LogInformation("[Deepgram] TRANSCRICAO_VAZIA: Nenhuma fala detectada no áudio (Deepgram retornou alternatives vazio).");
                return null;
            }
            var transcript = alternatives[0].GetProperty("transcript").GetString()?.Trim();

            if (!string.IsNullOrWhiteSpace(transcript))
            {
                _logger.LogInformation("[Deepgram] Transcrição OK: {Length} caracteres | preview={Preview}",
                    transcript.Length, transcript.Length > 80 ? transcript[..80] + "..." : transcript);
                return transcript;
            }

            _logger.LogWarning("[Deepgram] TRANSCRICAO_NAO_OCORRE: Resposta sem texto útil (transcript vazio). ResponsePreview={Preview}",
                json.Length > 300 ? json[..300] + "..." : json);
            return null;
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "[Deepgram] TRANSCRICAO_NAO_OCORRE: Falha ao parsear JSON. ResponsePreview={Preview}",
                json.Length > 500 ? json[..500] + "..." : json);
            return null;
        }
    }

    private static string ResolveMimeType(string? fileName)
    {
        var ext = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
        return ext switch
        {
            ".mp3" => "audio/mpeg",
            ".m4a" => "audio/mp4",
            ".wav" => "audio/wav",
            ".webm" => "audio/webm",
            _ => "application/octet-stream"
        };
    }
}
