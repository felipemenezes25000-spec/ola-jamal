using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;

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

    private const string ApiBaseUrl = "https://api.openai.com/v1";
    private const int MaxOutputChars = 140;
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    /// <summary>Chaves que NUNCA devem ser alteradas pela IA (alertas críticos, conduta médica).</summary>
    private static readonly HashSet<string> NoEnrichKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "rx:controlled", "rx:high_risk", "rx:unreadable", "rx:ai_message",
        "exam:complex", "exam:many", "detail:conduct_available"
    };

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = false
    };

    public OpenAiTriageEnrichmentService(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        ILogger<OpenAiTriageEnrichmentService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public async Task<TriageEnrichmentResult?> EnrichAsync(
        TriageEnrichmentInput input,
        CancellationToken cancellationToken = default)
    {
        if (ShouldSkipEnrichment(input.RuleKey))
            return null;

        var apiKey = _config.Value?.ApiKey?.Trim();
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogDebug("Triage IA: OpenAI não configurada, pulando enriquecimento");
            return null;
        }

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(Timeout);

        try
        {
            var systemPrompt = BuildSystemPrompt();
            var userPrompt = BuildUserPrompt(input);

            var requestBody = new
            {
                model = _config.Value?.Model ?? "gpt-4o",
                temperature = 0.4,
                max_tokens = 150,
                response_format = new { type = "json_object" },
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                }
            };

            var json = JsonSerializer.Serialize(requestBody, JsonOptions);
            var client = _httpClientFactory.CreateClient();
            client.Timeout = Timeout;
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{ApiBaseUrl}/chat/completions", content, cts.Token);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Triage IA: falhou {StatusCode}", response.StatusCode);
                return null;
            }

            var responseJson = await response.Content.ReadAsStringAsync(cts.Token);
            using var doc = JsonDocument.Parse(responseJson);
            var message = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(message))
                return null;

            var result = ParseAndValidate(message, input.RuleText);
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

    private static bool ShouldSkipEnrichment(string? ruleKey)
    {
        if (string.IsNullOrEmpty(ruleKey)) return true;
        return NoEnrichKeys.Any(k => ruleKey.StartsWith(k, StringComparison.OrdinalIgnoreCase));
    }

    private static string BuildSystemPrompt()
    {
        return """
            Você é a Dra. Renova, assistente de orientação do app RenoveJá+.

            REGRAS ABSOLUTAS (NUNCA QUEBRE):
            - Você NÃO diagnostica, NÃO prescreve, NÃO recomenda tratamentos ou medicamentos.
            - Você NÃO dá orientações médicas. Apenas dicas de USO DO APP e lembretes gerais.
            - O médico SEMPRE decide. Você só ajuda o paciente a navegar o app.
            - Mantenha o MESMO SIGNIFICADO da mensagem original. Apenas torne mais acolhedor/contextual.
            - Máximo 2 linhas (~120 caracteres). Tom amigável, profissional.
            - NUNCA use: "diagnóstico", "prescrevo", "indico", "você tem", "recomendo tratamento".
            - Responda APENAS com JSON: { "text": "sua mensagem personalizada" }

            Se a mensagem original já for adequada, pode devolver ela com pequeno ajuste de tom.
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
            sb.AppendLine($"Sintomas (resumo): {input.Symptoms}");
        if (input.TotalRequests.HasValue)
            sb.AppendLine($"Total de pedidos do paciente: {input.TotalRequests}");
        sb.AppendLine();
        sb.AppendLine("Personalize a mensagem mantendo o mesmo significado. Resposta em JSON com campo 'text'.");
        return sb.ToString();
    }

    private TriageEnrichmentResult? ParseAndValidate(string json, string fallback)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("text", out var textEl) || textEl.ValueKind != JsonValueKind.String)
                return null;

            var text = textEl.GetString()?.Trim();
            if (string.IsNullOrWhiteSpace(text))
                return null;

            // Validação: rejeitar se contiver termos que indicam decisão médica (inclui variações sem acento)
            var forbidden = new[]
            {
                "diagnóstico", "diagnostico",
                "prescrevo", "prescrição", "prescricao",
                "indico", "indicação", "indicacao",
                "você tem", "voce tem",
                "recomendo tratamento", "tratamento recomendado"
            };
            var lower = text.ToLowerInvariant();
            if (forbidden.Any(f => lower.Contains(f)))
            {
                _logger.LogDebug("Triage IA: output rejeitado por termo proibido");
                return null;
            }

            if (text.Length > MaxOutputChars)
                text = text[..MaxOutputChars].Trim();

            return new TriageEnrichmentResult(text, true);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Triage IA: falha ao parsear JSON");
            return null;
        }
    }
}
