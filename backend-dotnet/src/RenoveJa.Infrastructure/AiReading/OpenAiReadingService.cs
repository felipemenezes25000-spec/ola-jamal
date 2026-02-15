using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.AiReading;

/// <summary>
/// Serviço de leitura com GPT-4o para receitas e pedidos de exame.
/// Usa base64 para imagens do nosso storage (evita problemas com bucket privado); URLs externas são usadas diretamente.
/// </summary>
public class OpenAiReadingService : IAiReadingService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<OpenAIConfig> _config;
    private readonly IStorageService _storageService;
    private readonly ILogger<OpenAiReadingService> _logger;

    public OpenAiReadingService(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        IStorageService storageService,
        ILogger<OpenAiReadingService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _storageService = storageService;
        _logger = logger;
    }
    private const string ApiBaseUrl = "https://api.openai.com/v1";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = false
    };

    public async Task<AiPrescriptionAnalysisResult> AnalyzePrescriptionAsync(
        IReadOnlyList<string> imageUrls,
        CancellationToken cancellationToken = default)
    {
        if (imageUrls == null || imageUrls.Count == 0)
            return new AiPrescriptionAnalysisResult(false, null, null, null,
                "Nenhuma imagem de receita enviada.");

        var apiKey = _config.Value?.ApiKey?.Trim();
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("IA receita: OpenAI:ApiKey não configurada. Defina em appsettings.json ou variável OpenAI__ApiKey.");
            return new AiPrescriptionAnalysisResult(true,
                "[Análise por IA não configurada. Defina OpenAI:ApiKey em appsettings ou variável OpenAI__ApiKey.]",
                null, null, null);
        }

        var systemPrompt = """
Você é um assistente que analisa imagens de receitas médicas vencidas para renovação.
Analise a(s) imagem(ns) e responda em JSON com exatamente estes campos:
- readability_ok (boolean): false se a imagem estiver ilegível, borrada ou incompleta; true se conseguir ler.
- message_to_user (string ou null): Se readability_ok for false, escreva uma mensagem curta em português pedindo ao paciente que envie uma foto mais nítida e legível. Ex.: "Não foi possível ler a receita. Envie uma foto mais nítida, com boa iluminação e a receita inteira visível."
- summary_for_doctor (string): Resumo para o médico com medicamento(s), dosagem, médico anterior (se visível) e observações. Em português. Se não leu, use "".
- extracted (objeto): { "medications": ["nome1", "nome2"], "dosage": "texto", "previous_doctor": "nome ou null" }
- risk_level (string): "low", "medium" ou "high" conforme o tipo de medicamento (controlado/azul = medium/high).

Responda APENAS com o JSON, sem markdown e sem texto antes ou depois.
""";

        var userContent = new List<object>
        {
            new { type = "text", text = "Analise a(s) imagem(ns) desta receita médica e retorne o JSON conforme instruído." }
        };
        var resolvedImages = await ResolveImageContentsAsync(imageUrls.Take(5).ToList(), cancellationToken);
        _logger.LogInformation("IA receita: resolvidas {Count}/{Total} imagens para envio à OpenAI", resolvedImages.Count, imageUrls.Count);
        foreach (var imageItem in resolvedImages)
        {
            userContent.Add(imageItem);
        }

        var result = await CallChatAsync(systemPrompt, userContent, apiKey, cancellationToken);
        return ParsePrescriptionResult(result);
    }

    public async Task<AiExamAnalysisResult> AnalyzeExamAsync(
        IReadOnlyList<string>? imageUrls,
        string? textDescription,
        CancellationToken cancellationToken = default)
    {
        var hasImages = imageUrls != null && imageUrls.Count > 0;
        var hasText = !string.IsNullOrWhiteSpace(textDescription);

        if (!hasImages && !hasText)
            return new AiExamAnalysisResult(false, null, null, null,
                "Envie o pedido de exame em texto ou uma imagem do pedido antigo.");

        var apiKey = _config.Value?.ApiKey?.Trim();
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("IA exame: OpenAI:ApiKey não configurada. Defina em appsettings.json ou variável OpenAI__ApiKey.");
            return new AiExamAnalysisResult(true,
                "[Análise por IA não configurada. Defina OpenAI:ApiKey.]",
                null, null, null);
        }

        var systemPrompt = """
Você é um assistente que analisa pedidos de exame (imagem e/ou texto) para o médico.
- Se receber imagem(ns): extraia tipo de exame, indicação clínica e classifique urgência.
- Se receber só texto: ajuste e estruture o texto para o médico (ortografia, clareza), sem inventar dados.

Responda em JSON com exatamente:
- readability_ok (boolean): false se houver imagem mas estiver ilegível; true caso contrário.
- message_to_user (string ou null): Se readability_ok for false, mensagem em português pedindo foto mais nítida.
- summary_for_doctor (string): Resumo/texto estruturado para o médico (copiável para documento). Em português.
- extracted (objeto): { "exam_type": "...", "clinical_indication": "..." } (ou vazio se só texto)
- urgency (string): "routine", "urgent" ou "emergency"

Responda APENAS com o JSON, sem markdown e sem texto antes ou depois.
""";

        var userParts = new List<object>();
        if (hasText)
            userParts.Add(new { type = "text", text = $"Texto do pedido de exame:\n{textDescription}" });
        if (hasImages)
        {
            userParts.Add(new { type = "text", text = "Analise também a(s) imagem(ns) abaixo." });
            foreach (var imageItem in await ResolveImageContentsAsync(imageUrls!.Take(5).ToList(), cancellationToken))
            {
                userParts.Add(imageItem);
            }
        }
        userParts.Insert(0, new { type = "text", text = "Analise o pedido de exame (texto e/ou imagens) e retorne o JSON." });

        var result = await CallChatAsync(systemPrompt, userParts, apiKey, cancellationToken);
        return ParseExamResult(result);
    }

    private async Task<string> CallChatAsync(string systemPrompt, List<object> userContent, string apiKey, CancellationToken cancellationToken)
    {
        var requestBody = new
        {
            model = _config.Value?.Model ?? "gpt-4o",
            messages = new object[]
            {
                new { role = "system", content = (object)systemPrompt },
                new { role = "user", content = (object)userContent }
            },
            max_tokens = 2000
        };

        var json = JsonSerializer.Serialize(requestBody, JsonOptions);
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        client.Timeout = TimeSpan.FromSeconds(60);

        using var requestContent = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await client.PostAsync($"{ApiBaseUrl}/chat/completions", requestContent, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("OpenAI API error: StatusCode={StatusCode}, Response={Response}", response.StatusCode, err);
            throw new InvalidOperationException($"OpenAI API error: {response.StatusCode}. {err}");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        var choices = doc.RootElement.GetProperty("choices");
        if (choices.GetArrayLength() == 0)
        {
            _logger.LogWarning("OpenAI retornou choices vazio. Resposta raw pode conter erro.");
            throw new InvalidOperationException("OpenAI retornou resposta vazia.");
        }
        var message = choices[0].GetProperty("message");
        var contentEl = message.GetProperty("content");
        return contentEl.GetString() ?? "";
    }

    private static AiPrescriptionAnalysisResult ParsePrescriptionResult(string raw)
    {
        var (readabilityOk, messageToUser, summary, extracted, riskLevel) = ParseCommonAndRisk(raw);
        return new AiPrescriptionAnalysisResult(readabilityOk, summary, extracted, riskLevel, messageToUser);
    }

    private static AiExamAnalysisResult ParseExamResult(string raw)
    {
        var (readabilityOk, messageToUser, summary, extracted, _) = ParseCommonAndRisk(raw);
        string? urgency = null;
        try
        {
            var cleaned = CleanJsonResponse(raw);
            using var doc = JsonDocument.Parse(cleaned);
            if (doc.RootElement.TryGetProperty("urgency", out var u))
                urgency = u.GetString();
        }
        catch { /* ignore */ }
        return new AiExamAnalysisResult(readabilityOk, summary, extracted, urgency, messageToUser);
    }

    private static (bool readabilityOk, string? messageToUser, string? summary, string? extracted, string? riskLevel) ParseCommonAndRisk(string raw)
    {
        try
        {
            var cleaned = CleanJsonResponse(raw);
            using var doc = JsonDocument.Parse(cleaned);
            var r = doc.RootElement;
            var readabilityOk = r.TryGetProperty("readability_ok", out var ro) && ro.GetBoolean();
            var messageToUser = r.TryGetProperty("message_to_user", out var mu) ? mu.GetString() : null;
            var summary = r.TryGetProperty("summary_for_doctor", out var s) ? s.GetString() : null;
            var riskLevel = r.TryGetProperty("risk_level", out var rl) ? rl.GetString() : null;
            string? extracted = null;
            if (r.TryGetProperty("extracted", out var ex))
                extracted = ex.GetRawText();
            return (readabilityOk, messageToUser, summary, extracted, riskLevel);
        }
        catch
        {
            return (false, "Resposta da IA em formato inesperado. Tente enviar uma imagem mais legível.", raw, null, null);
        }
    }

    /// <summary>
    /// Resolve imagens: baixa do nosso storage e envia como base64 (acessível mesmo com bucket privado).
    /// URLs externas são usadas diretamente.
    /// </summary>
    private async Task<List<object>> ResolveImageContentsAsync(IReadOnlyList<string> urls, CancellationToken cancellationToken)
    {
        var result = new List<object>();
        for (var i = 0; i < urls.Count; i++)
        {
            var url = urls[i];
            if (string.IsNullOrWhiteSpace(url))
            {
                _logger.LogDebug("IA: URL #{Index} vazia, ignorando", i + 1);
                continue;
            }
            try
            {
                var bytes = await _storageService.DownloadFromStorageUrlAsync(url, cancellationToken);
                if (bytes != null && bytes.Length > 0)
                {
                    var b64 = Convert.ToBase64String(bytes);
                    var mime = "image/jpeg";
                    if (url.Contains(".png", StringComparison.OrdinalIgnoreCase)) mime = "image/png";
                    else if (url.Contains(".webp", StringComparison.OrdinalIgnoreCase)) mime = "image/webp";
                    result.Add(new { type = "image_url", image_url = new { url = $"data:{mime};base64,{b64}" } });
                    _logger.LogDebug("IA: URL #{Index} baixada ok, {Size} bytes, base64 envio", i + 1, bytes.Length);
                }
                else
                {
                    result.Add(new { type = "image_url", image_url = new { url = url } });
                    _logger.LogWarning("IA: URL #{Index} retornou vazio, usando URL direta: {Url}", i + 1, url);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "IA: falha ao baixar URL #{Index} ({Url}), usando URL direta", i + 1, url);
                result.Add(new { type = "image_url", image_url = new { url = url } });
            }
        }
        return result;
    }

    private static string CleanJsonResponse(string raw)
    {
        var s = raw.Trim();
        if (s.StartsWith("```json")) s = s["```json".Length..];
        else if (s.StartsWith("```")) s = s["```".Length..];
        if (s.EndsWith("```")) s = s[..^3];
        return s.Trim();
    }
}
