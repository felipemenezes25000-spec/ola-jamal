using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Interfaces;
using ImageMagick;

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

VALIDAÇÃO OBRIGATÓRIA: A imagem DEVE conter APENAS um documento de receita médica (papel, tela ou PDF) com medicamentos e/ou dosagens legíveis.
RETORNE readability_ok: false E message_to_user com a mensagem adequada se a imagem contiver QUALQUER um dos seguintes:
- ROSTOS DE PESSOAS, SELFIES, FOTOS PESSOAIS, RETRATOS
- ANIMAIS (cães, gatos, pássaros, etc.)
- PAISAGENS, NATUREZA, OBJETOS COMUNS
- COMIDA, BEBIDAS, EMBALAGENS DE MEDICAMENTOS (sem receita)
- TELAS DE CELULAR/COMPUTADOR que não sejam documento médico
- QUALQUER conteúdo que NÃO seja um documento de receita médica com medicamentos e dosagem
Mensagem exemplo: "A imagem não parece ser de uma receita médica. Envie APENAS fotos do documento da receita (papel ou tela com medicamentos e dosagem). Não envie fotos de pessoas, animais, selfies ou outros objetos."
Só prossiga com a análise SE e SOMENTE SE a imagem for claramente um documento médico (receituário com medicamentos).

Analise a(s) imagem(ns) e responda em JSON com exatamente estes campos:

- readability_ok (boolean): false se a imagem estiver ilegível, borrada, incompleta ou NÃO for documento de receita; true se conseguir ler.
- message_to_user (string ou null): Se readability_ok for false, mensagem curta em português pedindo foto mais nítida.
- summary_for_doctor (string): PRONTUÁRIO estruturado para o médico copiar/colar no sistema. Formato:
  "MEDICAMENTOS IDENTIFICADOS:
  • [Nome do medicamento] - [dosagem completa, ex: 1cp 12/12h]
  • [Outro medicamento] - [posologia]
  MÉDICO ANTERIOR: [nome ou "não identificado"]
  OBSERVAÇÕES: [observações relevantes ou "nenhuma"]"
  Se não leu, use "".
- extracted (objeto): { "medications": ["Nome Medicamento 1 - dosagem", "Nome Medicamento 2 - posologia"], "dosage": "texto resumido", "previous_doctor": "nome ou null" }
  IMPORTANTE: medications deve listar cada medicamento de forma completa (nome + posologia) para preenchimento do PDF.
- risk_level (string): "low", "medium" ou "high" (controlado/azul = medium/high).

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

VALIDAÇÃO OBRIGATÓRIA (quando houver imagens): A(s) imagem(ns) DEVE(m) conter APENAS documento de pedido de exame, requisição médica ou laudo.
RETORNE readability_ok: false E message_to_user se a imagem contiver QUALQUER um dos seguintes:
- ROSTOS DE PESSOAS, SELFIES, FOTOS PESSOAIS, RETRATOS
- ANIMAIS (cães, gatos, pássaros, etc.)
- PAISAGENS, NATUREZA, OBJETOS, COMIDA
- TELAS que não sejam documento médico
Mensagem: "A imagem não parece ser de pedido de exame ou documento médico. Envie APENAS imagens do pedido de exame, requisição ou laudo. Não envie fotos de pessoas, animais ou outros objetos."
Só prossiga SE a imagem for claramente um documento médico (pedido de exame, laudo ou requisição).

Responda em JSON com exatamente:
- readability_ok (boolean): false se houver imagem mas estiver ilegível ou NÃO for documento médico; true caso contrário.
- message_to_user (string ou null): Se readability_ok for false, mensagem em português pedindo foto mais nítida.
- summary_for_doctor (string): PRONTUÁRIO estruturado para o médico copiar/colar. Formato:
  "EXAMES SOLICITADOS:
  • [Exame 1]
  • [Exame 2]
  INDICAÇÃO CLÍNICA: [motivo clínico ou sintomas]
  OBSERVAÇÕES: [outras informações relevantes]"
  Em português, ortografia correta.
- extracted (objeto): { "exam_type": "tipo principal", "exams": ["exame1", "exame2"], "clinical_indication": "..." } (ou vazio se só texto)
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
    /// Converte HEIF/HEIC/PDF para JPEG antes de enviar à OpenAI (que só aceita png, jpeg, gif, webp).
    /// Nunca envia URL direta para formatos não suportados (HEIC etc.) – OpenAI rejeita.
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
                if (bytes == null || bytes.Length == 0)
                {
                    if (IsUnsupportedFormatForDirectUrl(url))
                    {
                        _logger.LogWarning("IA: URL #{Index} não pode ser usada (HEIC/HEIF/PDF) e download falhou. Ignorando: {Url}", i + 1, url);
                    }
                    else
                    {
                        result.Add(new { type = "image_url", image_url = new { url = url } });
                        _logger.LogWarning("IA: URL #{Index} retornou vazio, usando URL direta: {Url}", i + 1, url);
                    }
                    continue;
                }
                var (outBytes, mime) = ConvertToOpenAiSupportedFormat(bytes, url);
                var b64 = Convert.ToBase64String(outBytes);
                result.Add(new { type = "image_url", image_url = new { url = $"data:{mime};base64,{b64}" } });
                _logger.LogDebug("IA: URL #{Index} baixada ok, {Size} bytes, mime={Mime}", i + 1, outBytes.Length, mime);
            }
            catch (Exception ex)
            {
                if (IsUnsupportedFormatForDirectUrl(url))
                {
                    _logger.LogWarning(ex, "IA: URL #{Index} HEIC/HEIF/PDF e download/conversão falhou. Ignorando: {Url}", i + 1, url);
                }
                else
                {
                    _logger.LogWarning(ex, "IA: falha ao baixar URL #{Index} ({Url}), usando URL direta", i + 1, url);
                    result.Add(new { type = "image_url", image_url = new { url = url } });
                }
            }
        }
        return result;
    }

    private static bool IsUnsupportedFormatForDirectUrl(string url)
    {
        return url.Contains(".heif", StringComparison.OrdinalIgnoreCase) ||
               url.Contains(".heic", StringComparison.OrdinalIgnoreCase) ||
               url.Contains(".pdf", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Converte imagens HEIF/HEIC/PDF para JPEG (formato aceito pela OpenAI).
    /// Detecta por URL e por magic bytes. png, jpeg, gif, webp são enviados sem conversão.
    /// </summary>
    private (byte[] bytes, string mime) ConvertToOpenAiSupportedFormat(byte[] data, string url)
    {
        var needsConversion = url.Contains(".heif", StringComparison.OrdinalIgnoreCase) ||
                             url.Contains(".heic", StringComparison.OrdinalIgnoreCase) ||
                             url.Contains(".pdf", StringComparison.OrdinalIgnoreCase) ||
                             IsHeicMagicBytes(data) ||
                             IsPdfMagicBytes(data);

        if (!needsConversion)
        {
            var mime = "image/jpeg";
            if (url.Contains(".png", StringComparison.OrdinalIgnoreCase)) mime = "image/png";
            else if (url.Contains(".webp", StringComparison.OrdinalIgnoreCase)) mime = "image/webp";
            else if (url.Contains(".gif", StringComparison.OrdinalIgnoreCase)) mime = "image/gif";
            return (data, mime);
        }

        try
        {
            var isPdf = url.Contains(".pdf", StringComparison.OrdinalIgnoreCase) || IsPdfMagicBytes(data);
            var settings = isPdf ? new MagickReadSettings { Density = new Density(150, 150) } : null;
            using var image = settings != null ? new MagickImage(data, settings) : new MagickImage(data);
            image.Quality = 85;
            using var ms = new MemoryStream();
            image.Write(ms, MagickFormat.Jpeg);
            return (ms.ToArray(), "image/jpeg");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "IA: falha ao converter HEIC/PDF para JPEG: {Url}", url);
            throw new InvalidOperationException($"Não foi possível converter a imagem (HEIC/PDF) para formato suportado: {ex.Message}");
        }
    }

    private static bool IsHeicMagicBytes(byte[] data)
    {
        if (data == null || data.Length < 12) return false;
        return data[4] == 'f' && data[5] == 't' && data[6] == 'y' && data[7] == 'p';
    }

    private static bool IsPdfMagicBytes(byte[] data)
    {
        if (data == null || data.Length < 5) return false;
        return data[0] == '%' && data[1] == 'P' && data[2] == 'D' && data[3] == 'F';
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
