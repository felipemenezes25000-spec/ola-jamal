using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.AiReading;

/// <summary>
/// Gera resumo narrativo completo do prontuário do paciente via OpenAI.
/// Consolida consultas, receitas e exames em um texto único para o médico.
/// </summary>
public class OpenAiClinicalSummaryService : IClinicalSummaryService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<OpenAIConfig> _config;
    private readonly ILogger<OpenAiClinicalSummaryService> _logger;

    private const string ApiBaseUrl = "https://api.openai.com/v1";

    public OpenAiClinicalSummaryService(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        ILogger<OpenAiClinicalSummaryService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public async Task<ClinicalSummaryStructured?> GenerateStructuredAsync(
        ClinicalSummaryInput input,
        CancellationToken cancellationToken = default)
    {
        var apiKey = _config.Value?.ApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("OpenAI API key not configured — skipping clinical summary");
            return null;
        }

        try
        {
            var systemPrompt = """
                Você é um assistente clínico da plataforma RenoveJá+ (telemedicina brasileira).
                Sua função é gerar um RESUMO ESTRUTURADO do prontuário no padrão dos melhores EHRs do mundo (Epic, Cerner).

                REGRAS:
                - Use APENAS dados fornecidos. Não invente.
                - Extraia diagnósticos (CID) das consultas para problemList.
                - Consolide medicamentos das receitas mais recentes em activeMedications (formato: "Nome - dosagem").
                - narrativeSummary: texto fluido de 150-250 palavras, cronológico, linguagem médica.
                - carePlan: plano de cuidado em 2-4 frases (seguimento, exames pendentes, orientações).
                - alerts: alergias + pontos críticos (ex: "Alergia a dipirona", "Receita controlada em uso").

                Responda APENAS com um JSON válido, sem markdown, exatamente neste formato:
                {
                  "problemList": ["CID ou diagnóstico 1", "diagnóstico 2"],
                  "activeMedications": ["Medicamento 1 - dosagem", "Medicamento 2 - posologia"],
                  "narrativeSummary": "Texto narrativo completo...",
                  "carePlan": "Plano de cuidado resumido...",
                  "alerts": ["Alerta 1", "Alerta 2"]
                }
                Arrays vazios [] se não houver dados. Strings vazias "" se não aplicável.
                """;

            var userContent = BuildUserContent(input) + "\n\nCom base em TODAS as informações acima, gere o JSON estruturado (problemList, activeMedications, narrativeSummary, carePlan, alerts).";

            var requestBody = new
            {
                model = _config.Value?.Model ?? "gpt-4o",
                temperature = 0.2,
                max_tokens = 1600,
                response_format = new { type = "json_object" },
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userContent }
                }
            };

            var json = JsonSerializer.Serialize(requestBody);
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            client.Timeout = TimeSpan.FromSeconds(50);

            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{ApiBaseUrl}/chat/completions", content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("OpenAI clinical summary structured failed: {StatusCode}", response.StatusCode);
                return null;
            }

            var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(responseJson);
            var message = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(message)) return null;

            return ParseStructuredSummary(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating structured clinical summary");
            return null;
        }
    }

    private static ClinicalSummaryStructured? ParseStructuredSummary(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var problemList = ReadStringArray(root, "problemList");
            var activeMedications = ReadStringArray(root, "activeMedications");
            var narrativeSummary = root.TryGetProperty("narrativeSummary", out var ns) ? ns.GetString()?.Trim() : null;
            var carePlan = root.TryGetProperty("carePlan", out var cp) ? cp.GetString()?.Trim() : null;
            var alerts = ReadStringArray(root, "alerts");

            return new ClinicalSummaryStructured(
                problemList,
                activeMedications,
                narrativeSummary,
                carePlan,
                alerts);
        }
        catch
        {
            return null;
        }
    }

    private static List<string> ReadStringArray(JsonElement root, string prop)
    {
        var list = new List<string>();
        if (!root.TryGetProperty(prop, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return list;
        foreach (var item in arr.EnumerateArray())
        {
            var s = item.GetString()?.Trim();
            if (!string.IsNullOrEmpty(s)) list.Add(s);
        }
        return list;
    }

    public async Task<string?> GenerateAsync(
        ClinicalSummaryInput input,
        CancellationToken cancellationToken = default)
    {
        var apiKey = _config.Value?.ApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("OpenAI API key not configured — skipping clinical summary");
            return null;
        }

        try
        {
            var systemPrompt = """
                Você é um assistente clínico da plataforma RenoveJá+ (telemedicina brasileira).
                Sua função é gerar um RESUMO NARRATIVO COMPLETO do prontuário do paciente para o médico.

                REGRAS:
                - Consolide TODAS as informações em um único texto fluido e organizado
                - Use linguagem médica profissional, objetiva e clara
                - Não invente dados. Use APENAS o que foi fornecido
                - Organize cronologicamente quando fizer sentido
                - Destaque: alergias, medicamentos em uso, diagnósticos (CID), evolução e condutas
                - Máximo 400 palavras (resumo útil para o médico em consulta rápida)
                - O médico decide. Este é apenas um resumo de apoio.

                ESTRUTURA SUGERIDA:
                1. Identificação e dados relevantes (idade, sexo, alergias)
                2. Histórico de consultas (queixas, evolução, CID, condutas)
                3. Medicamentos prescritos (receitas, tipos)
                4. Exames solicitados
                5. Pontos de atenção se houver

                Responda APENAS com o texto do resumo, sem títulos em markdown ou formatação extra.
                """;

            var userContent = BuildUserContent(input);

            var requestBody = new
            {
                model = _config.Value?.Model ?? "gpt-4o",
                temperature = 0.3,
                max_tokens = 1200,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userContent }
                }
            };

            var json = JsonSerializer.Serialize(requestBody);
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            client.Timeout = TimeSpan.FromSeconds(45);

            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{ApiBaseUrl}/chat/completions", content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("OpenAI clinical summary failed: {StatusCode}", response.StatusCode);
                return null;
            }

            var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(responseJson);
            var message = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            return string.IsNullOrWhiteSpace(message) ? null : message.Trim();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating clinical summary");
            return null;
        }
    }

    private static string BuildUserContent(ClinicalSummaryInput input)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Paciente: {input.PatientName}");
        if (input.PatientBirthDate.HasValue)
            sb.AppendLine($"Data de nascimento: {input.PatientBirthDate:dd/MM/yyyy}");
        if (!string.IsNullOrWhiteSpace(input.PatientGender))
            sb.AppendLine($"Sexo: {input.PatientGender}");
        if (input.Allergies.Count > 0)
            sb.AppendLine($"ALERGIAS: {string.Join(", ", input.Allergies)}");
        sb.AppendLine();

        if (input.Consultations.Count > 0)
        {
            sb.AppendLine("--- CONSULTAS ---");
            foreach (var c in input.Consultations)
            {
                sb.AppendLine($"Data: {c.Date:dd/MM/yyyy}");
                if (!string.IsNullOrWhiteSpace(c.Symptoms))
                    sb.AppendLine($"Queixa: {c.Symptoms}");
                if (!string.IsNullOrWhiteSpace(c.Cid))
                    sb.AppendLine($"CID: {c.Cid}");
                if (!string.IsNullOrWhiteSpace(c.Conduct))
                    sb.AppendLine($"Conduta: {c.Conduct}");
                if (!string.IsNullOrWhiteSpace(c.AnamnesisSnippet))
                    sb.AppendLine($"Anamnese: {c.AnamnesisSnippet}");
                sb.AppendLine();
            }
        }

        if (input.Prescriptions.Count > 0)
        {
            sb.AppendLine("--- RECEITAS ---");
            foreach (var p in input.Prescriptions)
            {
                sb.AppendLine($"Data: {p.Date:dd/MM/yyyy} | Tipo: {p.Type}");
                sb.AppendLine($"Medicamentos: {string.Join(", ", p.Medications)}");
                if (!string.IsNullOrWhiteSpace(p.Notes))
                    sb.AppendLine($"Obs: {p.Notes}");
                sb.AppendLine();
            }
        }

        if (input.Exams.Count > 0)
        {
            sb.AppendLine("--- EXAMES ---");
            foreach (var e in input.Exams)
            {
                sb.AppendLine($"Data: {e.Date:dd/MM/yyyy}");
                sb.AppendLine($"Exames: {string.Join(", ", e.Exams)}");
                if (!string.IsNullOrWhiteSpace(e.Symptoms))
                    sb.AppendLine($"Queixa: {e.Symptoms}");
                if (!string.IsNullOrWhiteSpace(e.Notes))
                    sb.AppendLine($"Obs: {e.Notes}");
                sb.AppendLine();
            }
        }

        sb.AppendLine("Gere o resumo narrativo completo consolidando todas as informações acima.");
        return sb.ToString();
    }
}
