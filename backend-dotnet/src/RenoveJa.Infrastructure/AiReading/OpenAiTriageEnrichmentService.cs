using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Infrastructure.AiReading;

/// <summary>
/// Enriquecimento de mensagens da Dra. Renova com GPT-4o.
/// GUARDRAILS: IA nunca diagnostica, prescreve ou decide. Apenas personaliza dicas de orientação.
/// O médico sempre tem a decisão final. Juridicamente seguro.
/// </summary>
public class OpenAiTriageEnrichmentService : ITriageEnrichmentService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<OpenAIConfig> _config;
    private readonly ILogger<OpenAiTriageEnrichmentService> _logger;
    private readonly IAiInteractionLogRepository _aiInteractionLogRepository;

    private const string OpenAiBaseUrl = "https://api.openai.com/v1";
    private const string GeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
    private const string DefaultGeminiModel = "gemini-2.5-flash";
    private const int MaxOutputChars = 140;
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);
    /// <summary>Status codes transitórios que merecem retry (503, 502, 429).</summary>
    private static readonly HashSet<int> RetryableStatusCodes = [502, 503, 429];

    /// <summary>Chaves que NUNCA devem ser alteradas pela IA (alertas críticos, conduta médica).</summary>
    private static readonly HashSet<string> NoEnrichKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "rx:controlled", "rx:high_risk", "rx:red_flags", "rx:unreadable", "rx:ai_message",
        "exam:high_risk", "exam:complex", "exam:many", "exam:red_flags",
        "consult:red_flags", "doctor:detail:high_risk", "detail:conduct_available"
    };

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = false
    };

    public OpenAiTriageEnrichmentService(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        ILogger<OpenAiTriageEnrichmentService> logger,
        IAiInteractionLogRepository aiInteractionLogRepository)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
        _aiInteractionLogRepository = aiInteractionLogRepository;
    }

    public async Task<TriageEnrichmentResult?> EnrichAsync(
        TriageEnrichmentInput input,
        CancellationToken cancellationToken = default)
    {
        if (ShouldSkipEnrichment(input.RuleKey))
            return null;

        var (apiKey, baseUrl, model) = ResolveProvider();
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogDebug("Triage IA: nenhuma API configurada (Gemini ou OpenAI), pulando enriquecimento");
            return null;
        }

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(Timeout);

        var result = await CallProviderAsync(input, apiKey, baseUrl, model, cts.Token);
        if (result != null) return result;

        // Fallback: OpenAI falhou e Gemini configurada → tenta gemini-2.5-flash
        var usedOpenAi = model.StartsWith("gpt", StringComparison.OrdinalIgnoreCase);
        var geminiKey = _config.Value?.GeminiApiKey?.Trim();
        if (usedOpenAi && !string.IsNullOrEmpty(geminiKey) && !geminiKey.Contains("YOUR_") && !geminiKey.Contains("_HERE"))
        {
            _logger.LogInformation("Triage IA: Fallback para Gemini após falha OpenAI.");
            using var fallbackCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            fallbackCts.CancelAfter(Timeout);
            var url = !string.IsNullOrWhiteSpace(_config.Value?.GeminiApiBaseUrl) ? _config.Value.GeminiApiBaseUrl.Trim() : GeminiBaseUrl;
            return await CallProviderAsync(input, geminiKey!, url, DefaultGeminiModel, fallbackCts.Token);
        }
        return null;
    }

    private async Task<TriageEnrichmentResult?> CallProviderAsync(
        TriageEnrichmentInput input,
        string apiKey,
        string baseUrl,
        string model,
        CancellationToken cancellationToken)
    {
        try
        {
            var systemPrompt = BuildSystemPrompt();
            var userPrompt = BuildUserPrompt(input);

            var isGemini = baseUrl.Contains("generativelanguage", StringComparison.OrdinalIgnoreCase);
            // Gemini: 2048 tokens para evitar truncamento intermitente
            var maxTokens = isGemini ? 2048 : 150;
            object requestBody = new { model, temperature = 0.4, max_tokens = maxTokens, response_format = new { type = "json_object" }, messages = new[] { new { role = "system", content = systemPrompt }, new { role = "user", content = userPrompt } } };

            var startedAt = DateTime.UtcNow;
            var json = JsonSerializer.Serialize(requestBody, JsonOptions);
            var promptHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json))).ToLowerInvariant();
            var client = _httpClientFactory.CreateClient();
            client.Timeout = Timeout;
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var response = await PostWithRetryAsync(client, baseUrl, json, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Triage IA: falhou {StatusCode}", response.StatusCode);
                await _aiInteractionLogRepository.LogAsync(AiInteractionLog.Create(
                    serviceName: nameof(OpenAiTriageEnrichmentService),
                    modelName: model,
                    promptHash: promptHash,
                    success: false,
                    durationMs: (long)(DateTime.UtcNow - startedAt).TotalMilliseconds,
                    errorMessage: $"HTTP {(int)response.StatusCode}"), cancellationToken);
                return null;
            }

            var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(responseJson);
            var message = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(message))
                return null;

            var result = ParseAndValidate(message, input.RuleText);
            if (result == null)
                _logger.LogWarning("Triage IA: ParseAndValidate retornou null. Raw (preview): {Preview}", message.Length > 300 ? message[..300] + "..." : message);
            await _aiInteractionLogRepository.LogAsync(AiInteractionLog.Create(
                serviceName: nameof(OpenAiTriageEnrichmentService),
                modelName: model,
                promptHash: promptHash,
                success: true,
                responseSummary: message.Length > 500 ? message[..500] : message,
                durationMs: (long)(DateTime.UtcNow - startedAt).TotalMilliseconds), cancellationToken);
            return result;
        }
        catch (OperationCanceledException)
        {
            _logger.LogDebug("Triage IA: timeout ou cancelamento");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Triage IA: erro ao enriquecer");
            return null;
        }
    }

    /// <summary>POST com retry para erros transitórios (502, 503, 429).</summary>
    private async Task<HttpResponseMessage> PostWithRetryAsync(
        HttpClient client,
        string baseUrl,
        string json,
        CancellationToken cancellationToken,
        int maxAttempts = 2)
    {
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{baseUrl}/chat/completions", content, cancellationToken);

            var status = (int)response.StatusCode;
            if (response.IsSuccessStatusCode || !RetryableStatusCodes.Contains(status) || attempt >= maxAttempts)
                return response;

            _logger.LogDebug("Triage IA: {StatusCode} na tentativa {Attempt}/{Max}, aguardando retry", response.StatusCode, attempt, maxAttempts);
            // Dispose failed response before retrying to release underlying connection
            response.Dispose();
            await Task.Delay(TimeSpan.FromMilliseconds(400 * attempt), cancellationToken);
        }

        return new HttpResponseMessage(HttpStatusCode.ServiceUnavailable);
    }

    /// <summary>Prioriza OpenAI (GPT). Fallback para Gemini quando OpenAI ausente.</summary>
    private (string apiKey, string baseUrl, string model) ResolveProvider()
    {
        var openAiKey = _config.Value?.ApiKey?.Trim();
        if (!string.IsNullOrEmpty(openAiKey) && !openAiKey.Contains("YOUR_") && !openAiKey.Contains("_HERE"))
            return (openAiKey, OpenAiBaseUrl, _config.Value?.Model ?? "gpt-4o");
        var geminiKey = _config.Value?.GeminiApiKey?.Trim();
        if (!string.IsNullOrEmpty(geminiKey) && !geminiKey.Contains("YOUR_") && !geminiKey.Contains("_HERE"))
        {
            var url = !string.IsNullOrWhiteSpace(_config.Value?.GeminiApiBaseUrl)
                ? _config.Value.GeminiApiBaseUrl.Trim()
                : GeminiBaseUrl;
            return (geminiKey, url, DefaultGeminiModel);
        }
        return (string.Empty, string.Empty, string.Empty);
    }

    private static bool ShouldSkipEnrichment(string? ruleKey)
    {
        if (string.IsNullOrEmpty(ruleKey)) return true;
        return NoEnrichKeys.Any(k => ruleKey.StartsWith(k, StringComparison.OrdinalIgnoreCase));
    }

    private static string BuildSystemPrompt()
    {
        return """
            Você é a Dra. Renoveja, assistente virtual do app RenoveJá+.
            Você é carinhosa, acolhedora e transmite segurança — como uma amiga que entende de saúde.
            O paciente deve se sentir SEMPRE acompanhado.

            SUA MISSÃO:
            - Ajudar o paciente a navegar o app com confiança
            - Dar sugestões baseadas no histórico (ex.: "pela sua última receita", "pela sua idade")
            - Transmitir cuidado e atenção genuínos
            - SEMPRE direcionar para um profissional quando houver necessidade
            - O médico SEMPRE decide — você orienta e encaminha

            REGRAS ABSOLUTAS (NUNCA QUEBRE):
            - Você NÃO diagnostica, NÃO prescreve, NÃO recomenda tratamentos ou medicamentos específicos
            - Você NÃO dá orientações médicas — apenas sugestões de USO DO APP e lembretes de acompanhamento
            - O médico SEMPRE decide. Você é uma facilitadora que direciona para o profissional
            - Mantenha o MESMO SIGNIFICADO da mensagem original. Torne mais acolhedor e humano
            - Máximo 2 linhas (~120 caracteres). Tom caloroso mas profissional
            - NUNCA use: "diagnóstico", "prescrevo", "indico", "você tem", "recomendo tratamento"

            SUGESTÕES PROATIVAS (quando o contexto tiver dados):
            - Se tiver dias desde última receita: pode mencionar "pelo seu histórico" ou "pela sua última receita"
            - Se tiver idade: pode mencionar "para sua idade" ou "exames de rotina"
            - Sempre reforçar: "o médico avalia", "converse com um médico", "o profissional orienta"

            ESTILO:
            - Use linguagem simples e acessível
            - Evite jargões médicos
            - Transmita empatia: "entendo", "fico feliz", "conte comigo"
            - Quando apropriado, use um toque de leveza (sem emojis)

            Responda APENAS com JSON: { "text": "sua mensagem personalizada" }
            """;
    }

    private static string BuildUserPrompt(TriageEnrichmentInput input)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Contexto: {input.Context}, etapa: {input.Step}");
        sb.AppendLine($"Mensagem original: \"{input.RuleText}\"");
        if (!string.IsNullOrEmpty(input.PrescriptionType))
            sb.AppendLine($"Tipo receita: {input.PrescriptionType}");
        if (!string.IsNullOrEmpty(input.ExamType))
            sb.AppendLine($"Tipo exame: {input.ExamType}");
        if (input.Exams?.Length > 0)
            sb.AppendLine($"Exames: {string.Join(", ", input.Exams.Take(5))}");
        if (!string.IsNullOrEmpty(input.Symptoms) && input.Symptoms.Length < 100)
            sb.AppendLine($"Sintomas (resumo): {PromptSanitizer.SanitizeForPrompt(input.Symptoms)}");
        if (input.TotalRequests.HasValue)
            sb.AppendLine($"Total de pedidos do paciente: {input.TotalRequests}");
        if (input.LastPrescriptionDaysAgo.HasValue)
            sb.AppendLine($"Dias desde última receita assinada: {input.LastPrescriptionDaysAgo}");
        if (input.LastExamDaysAgo.HasValue)
            sb.AppendLine($"Dias desde último exame assinado: {input.LastExamDaysAgo}");
        if (input.PatientAge.HasValue)
            sb.AppendLine($"Idade do paciente: {input.PatientAge} anos");
        if (input.RecentMedications?.Length > 0)
            sb.AppendLine($"Medicamentos recentes: {string.Join(", ", input.RecentMedications.Take(5))}");
        sb.AppendLine();
        sb.AppendLine("Personalize a mensagem mantendo o mesmo significado. Resposta em JSON com campo 'text'.");
        return sb.ToString();
    }

    private TriageEnrichmentResult? ParseAndValidate(string raw, string fallback)
    {
        var json = CleanJson(raw);
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            // Gemini às vezes retorna "message" em vez de "text"
            if (!root.TryGetProperty("text", out var textEl) && !root.TryGetProperty("message", out textEl))
                return null;
            if (textEl.ValueKind != JsonValueKind.String)
                return null;

            var text = textEl.GetString()?.Trim();
            if (string.IsNullOrWhiteSpace(text))
                return null;

            var forbidden = new[]
            {
                "diagnostico", "prescrevo", "prescricao",
                "indico", "indicacao",
                "voce tem", "voce possui",
                "recomendo tratamento", "tratamento recomendado", "recomendo",
                "inicie o tratamento", "ajuste de dose", "dose recomendada",
                "tome 1 comprimido", "tome 2 comprimidos", "tome 500mg", "tome 2x ao dia",
                "deve tomar", "prescrevo"
            };
            var normalized = RemoveDiacritics(text.ToLowerInvariant());
            var blocked = forbidden.FirstOrDefault(f =>
                Regex.IsMatch(normalized, @"\b" + Regex.Escape(f) + @"\b"));
            if (blocked != null)
            {
                _logger.LogWarning("Triage IA: output rejeitado por termo proibido '{Term}'. Text (preview): {Preview}", blocked, text.Length > 100 ? text[..100] + "..." : text);
                return null;
            }

            if (text.Length > MaxOutputChars)
            {
                var lastSpace = text.LastIndexOf(' ', MaxOutputChars);
                text = (lastSpace > 0 ? text[..lastSpace] : text[..MaxOutputChars]).Trim() + "...";
            }

            return new TriageEnrichmentResult(text, true);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Triage IA: falha ao parsear JSON. Cleaned (preview): {Preview}", json.Length > 300 ? json[..300] + "..." : json);
            return null;
        }
    }

    private static string CleanJson(string raw)
    {
        var s = raw.Trim();
        if (s.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            s = s["```json".Length..].TrimStart();
        else if (s.StartsWith("```"))
            s = s["```".Length..].TrimStart();
        if (s.EndsWith("```"))
            s = s[..^3].TrimEnd();
        var start = s.IndexOf('{');
        if (start > 0)
        {
            var depth = 0;
            var inString = false;
            var escape = false;
            for (var i = start; i < s.Length; i++)
            {
                var c = s[i];
                if (escape) { escape = false; continue; }
                if (c == '\\' && inString) { escape = true; continue; }
                if (inString) { if (c == '"') inString = false; continue; }
                if (c == '"') { inString = true; continue; }
                if (c == '{') depth++;
                else if (c == '}') { depth--; if (depth == 0) return s[start..(i + 1)]; }
            }
        }
        return s;
    }

    private static string RemoveDiacritics(string text)
    {
        var normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}
