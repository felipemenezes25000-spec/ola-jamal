using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.AiReading;

public class OpenAiConductSuggestionService : IAiConductSuggestionService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<OpenAIConfig> _config;
    private readonly ILogger<OpenAiConductSuggestionService> _logger;

    private const string ApiBaseUrl = "https://api.openai.com/v1";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = false
    };

    public OpenAiConductSuggestionService(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        ILogger<OpenAiConductSuggestionService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public async Task<AiConductSuggestionResult?> GenerateAsync(
        AiConductSuggestionInput input,
        CancellationToken cancellationToken = default)
    {
        var apiKey = _config.Value?.ApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("OpenAI API key not configured — skipping conduct suggestion");
            return null;
        }

        try
        {
            var systemPrompt = BuildSystemPrompt();
            var userPrompt = BuildUserPrompt(input);

            var requestBody = new
            {
                model = _config.Value?.Model ?? "gpt-4o",
                temperature = 0.3,
                max_tokens = 800,
                response_format = new { type = "json_object" },
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                }
            };

            var json = JsonSerializer.Serialize(requestBody, JsonOptions);
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            client.Timeout = TimeSpan.FromSeconds(30);

            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{ApiBaseUrl}/chat/completions", content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("OpenAI conduct suggestion failed: {StatusCode}", response.StatusCode);
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

            return ParseResult(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating conduct suggestion");
            return null;
        }
    }

    private static string BuildSystemPrompt()
    {
        return """
            Você é um ASSISTENTE CLÍNICO de apoio ao médico na plataforma RenoveJá+.
            Sua função é SUGERIR condutas e orientações que o médico irá REVISAR antes de aplicar.

            CONTEXTO:
            - O RenoveJá+ é uma plataforma de telessaúde brasileira
            - Os médicos atendem por vídeo e emitem receitas/exames digitais com assinatura ICP-Brasil
            - Você auxilia na elaboração da conduta, mas o médico tem total autonomia

            REGRAS ABSOLUTAS:
            - A decisão final é SEMPRE do médico. Você é um rascunho inteligente
            - NÃO diagnostique. NÃO prescreva dosagens ou marcas comerciais
            - NÃO use: "diagnóstico", "você tem", "prescrevo", "determino"
            - Se houver medicação controlada (tarja preta/vermelha), sugira acompanhamento presencial
            - Se o quadro sugerir investigação complementar, proponha exames pertinentes
            - Comece a conduta com "Sugestão:" para deixar claro o caráter auxiliar

            FORMATO DA CONDUTA:
            - Máximo 5 linhas, linguagem profissional médica mas acessível ao paciente
            - Estruture em: (1) orientação geral, (2) cuidados específicos, (3) retorno/acompanhamento
            - Quando pertinente, mencione sinais de alerta para buscar urgência

            EXAMES COMPLEMENTARES:
            - Sugira apenas exames clinicamente relevantes ao contexto
            - Priorize exames básicos antes de complexos
            - Inclua justificativa implícita (ex: "Hemograma completo" em vez de apenas "hemograma")

            Responda APENAS com JSON válido, sem markdown:
            {
              "conduct_suggestion": "string — sugestão de conduta estruturada",
              "suggested_exams": ["array de strings — exames complementares, ou array vazio"]
            }
            """;
    }

    private static string BuildUserPrompt(AiConductSuggestionInput input)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Tipo de solicitação: {input.RequestType}");

        if (!string.IsNullOrWhiteSpace(input.PrescriptionType))
            sb.AppendLine($"Tipo de receita: {input.PrescriptionType}");
        if (!string.IsNullOrWhiteSpace(input.ExamType))
            sb.AppendLine($"Tipo de exame: {input.ExamType}");
        if (!string.IsNullOrWhiteSpace(input.PatientName))
            sb.AppendLine($"Paciente: {input.PatientName}");
        if (input.PatientBirthDate.HasValue)
            sb.AppendLine($"Data de nascimento: {input.PatientBirthDate:dd/MM/yyyy}");
        if (!string.IsNullOrWhiteSpace(input.PatientGender))
            sb.AppendLine($"Gênero: {input.PatientGender}");
        if (!string.IsNullOrWhiteSpace(input.Symptoms))
            sb.AppendLine($"Sintomas: {input.Symptoms}");
        if (input.Medications?.Count > 0)
            sb.AppendLine($"Medicamentos: {string.Join(", ", input.Medications)}");
        if (input.Exams?.Count > 0)
            sb.AppendLine($"Exames: {string.Join(", ", input.Exams)}");
        if (!string.IsNullOrWhiteSpace(input.AiSummaryForDoctor))
            sb.AppendLine($"Resumo IA: {input.AiSummaryForDoctor}");
        if (!string.IsNullOrWhiteSpace(input.DoctorNotes))
            sb.AppendLine($"Notas do médico: {input.DoctorNotes}");

        sb.AppendLine();
        sb.AppendLine("Gere uma sugestão de conduta e exames complementares se aplicável.");

        return sb.ToString();
    }

    private AiConductSuggestionResult? ParseResult(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            string? conduct = null;
            if (root.TryGetProperty("conduct_suggestion", out var cs) && cs.ValueKind == JsonValueKind.String)
                conduct = cs.GetString()?.Trim();

            var exams = new List<string>();
            if (root.TryGetProperty("suggested_exams", out var se) && se.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in se.EnumerateArray())
                {
                    var val = item.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(val))
                        exams.Add(val);
                }
            }

            if (string.IsNullOrWhiteSpace(conduct) && exams.Count == 0)
                return null;

            return new AiConductSuggestionResult(conduct, exams.Count > 0 ? exams : null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse conduct suggestion JSON: {Json}", json);
            return null;
        }
    }
}
