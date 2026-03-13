using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Infrastructure.AiReading;

/// <summary>
/// Gera itens de prescrição médica usando GPT-4o com base nos dados clínicos disponíveis.
/// Usa o JSON extraído da receita original como referência primária para garantir fidelidade clínica.
/// </summary>
public class OpenAiPrescriptionGeneratorService : IAiPrescriptionGeneratorService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<OpenAIConfig> _config;
    private readonly ILogger<OpenAiPrescriptionGeneratorService> _logger;

    private const string OpenAiBaseUrl = "https://api.openai.com/v1";
    private const string GeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = false
    };

    public OpenAiPrescriptionGeneratorService(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        ILogger<OpenAiPrescriptionGeneratorService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public async Task<List<PrescriptionMedicationItem>?> GenerateMedicationsAsync(
        AiPrescriptionGeneratorInput input,
        CancellationToken ct = default)
    {
        var (apiKey, baseUrl, model) = ResolveProvider();
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("IAiPrescriptionGeneratorService: Nenhuma API configurada (Gemini__ApiKey ou OpenAI__ApiKey).");
            return null;
        }

        var result = await CallProviderAsync(input, apiKey, baseUrl, model, ct);
        if (result != null) return result;

        // Fallback: OpenAI falhou e Gemini configurada → tenta gemini-2.5-flash
        var usedOpenAi = model.StartsWith("gpt", StringComparison.OrdinalIgnoreCase);
        var geminiKey = _config.Value?.GeminiApiKey?.Trim();
        if (usedOpenAi && !string.IsNullOrEmpty(geminiKey) && !geminiKey.Contains("YOUR_") && !geminiKey.Contains("_HERE"))
        {
            _logger.LogInformation("IA prescrição: Fallback para Gemini após falha OpenAI.");
            var url = !string.IsNullOrWhiteSpace(_config.Value?.GeminiApiBaseUrl) ? _config.Value!.GeminiApiBaseUrl!.Trim() : GeminiBaseUrl;
            return await CallProviderAsync(input, geminiKey!, url, "gemini-2.5-flash", ct);
        }
        return null;
    }

    private async Task<List<PrescriptionMedicationItem>?> CallProviderAsync(
        AiPrescriptionGeneratorInput input,
        string apiKey,
        string baseUrl,
        string model,
        CancellationToken ct)
    {
        var systemPrompt = BuildSystemPrompt(input.Kind);
        var userPrompt = BuildUserPrompt(input);

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

            var requestBody = new
            {
                model,
                temperature = 0.2,
                max_tokens = 2500,
                response_format = new { type = "json_object" },
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                }
            };

            var json = JsonSerializer.Serialize(requestBody, JsonOptions);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{baseUrl}/chat/completions", content, ct);

            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("IA prescrição: status {Status} — {Error}", response.StatusCode, err?.Length > 200 ? err[..200] + "..." : err);
                return null;
            }

            var responseJson = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(responseJson);
            var messageContent = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(messageContent))
                return null;

            var cleaned = CleanJsonResponse(messageContent);
            return ParseMedicationItems(cleaned);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao chamar IA para geração de prescrição");
            return null;
        }
    }

    private static string BuildSystemPrompt(PrescriptionKind kind)
    {
        var kindContext = kind switch
        {
            PrescriptionKind.ControlledSpecial =>
                "Esta é uma RECEITA DE CONTROLE ESPECIAL (Portaria SVS 344/98). " +
                "Quantidade DEVE ser em números e por extenso. " +
                "Máximo 2 medicamentos por receita. " +
                "Nome deve incluir substância ativa, concentração e forma farmacêutica.",
            PrescriptionKind.Antimicrobial =>
                "Esta é uma RECEITA DE ANTIMICROBIANO (RDC 471/2021). " +
                "Validade máxima: 10 dias. " +
                "Posologia deve especificar intervalo de horas e duração do tratamento.",
            _ =>
                "Esta é uma RECEITA SIMPLES (CFM Res. 2.299/2021)."
        };

        return $$"""
Você é um assistente especializado em farmacologia clínica brasileira para o sistema RenoveJá Saúde.
Sua função é gerar itens de prescrição médica para RENOVAÇÃO de receitas existentes.

{{kindContext}}

REGRAS OBRIGATÓRIAS:
1. Baseie-se SEMPRE nos dados da receita original extraída (AiExtractedJson/AiSummaryForDoctor).
2. Nunca invente medicamentos sem base nos dados fornecidos.
3. Siga rigorosamente as normas ANVISA/CFM: nome genérico (DCB), concentração, forma farmacêutica.
4. Posologia completa: dose, frequência, via de administração, duração.
5. Quantidade em unidades (ex: "30 comprimidos", "2 frascos").
6. Se não houver dados suficientes, retorne lista vazia.

FORMATO DE RESPOSTA (JSON obrigatório):
{
  "medications": [
    {
      "name": "Nome genérico (DCB) + concentração + forma farmacêutica",
      "presentation": "Ex: Comprimido revestido 20mg",
      "dosage": "Ex: 1 comprimido via oral a cada 12 horas por 7 dias",
      "quantity": "Ex: 14 comprimidos",
      "observation": "Observação específica se houver (opcional)"
    }
  ]
}
""";
    }

    private static string BuildUserPrompt(AiPrescriptionGeneratorInput input)
    {
        var sb = new StringBuilder();
        sb.AppendLine("DADOS DO PACIENTE:");
        sb.AppendLine($"- Nome: {input.PatientName}");
        if (input.PatientBirthDate.HasValue)
            sb.AppendLine($"- Data de nascimento: {input.PatientBirthDate.Value:dd/MM/yyyy}");
        if (!string.IsNullOrWhiteSpace(input.PatientGender))
            sb.AppendLine($"- Sexo: {input.PatientGender}");

        if (!string.IsNullOrWhiteSpace(input.Symptoms))
        {
            sb.AppendLine();
            sb.AppendLine("SINTOMAS/QUEIXA:");
            sb.AppendLine(input.Symptoms);
        }

        if (!string.IsNullOrWhiteSpace(input.AiSummaryForDoctor))
        {
            sb.AppendLine();
            sb.AppendLine("ANÁLISE DA RECEITA ORIGINAL (IA):");
            sb.AppendLine(input.AiSummaryForDoctor);
        }

        if (!string.IsNullOrWhiteSpace(input.AiExtractedJson))
        {
            sb.AppendLine();
            sb.AppendLine("DADOS EXTRAÍDOS DA RECEITA ORIGINAL (JSON):");
            sb.AppendLine(input.AiExtractedJson);
        }

        if (!string.IsNullOrWhiteSpace(input.DoctorNotes))
        {
            sb.AppendLine();
            sb.AppendLine("OBSERVAÇÕES DO MÉDICO:");
            sb.AppendLine(input.DoctorNotes);
        }

        sb.AppendLine();
        sb.AppendLine("Gere os itens de prescrição para renovação desta receita.");

        return sb.ToString();
    }

    /// <summary>Prioriza OpenAI (GPT). Fallback para Gemini quando OpenAI ausente.</summary>
    private (string? apiKey, string baseUrl, string model) ResolveProvider()
    {
        var openAiKey = _config.Value?.ApiKey?.Trim();
        if (!string.IsNullOrEmpty(openAiKey) && !openAiKey.Contains("YOUR_") && !openAiKey.Contains("_HERE"))
            return (openAiKey, OpenAiBaseUrl, _config.Value?.Model ?? "gpt-4o");
        var geminiKey = _config.Value?.GeminiApiKey?.Trim();
        if (!string.IsNullOrEmpty(geminiKey) && !geminiKey.Contains("YOUR_") && !geminiKey.Contains("_HERE"))
        {
            var url = !string.IsNullOrWhiteSpace(_config.Value?.GeminiApiBaseUrl)
                ? _config.Value!.GeminiApiBaseUrl!.Trim()
                : GeminiBaseUrl;
            return (geminiKey, url, "gemini-2.5-flash");
        }
        return ("", OpenAiBaseUrl, _config.Value?.Model ?? "gpt-4o");
    }

    private static string CleanJsonResponse(string raw)
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

    private List<PrescriptionMedicationItem>? ParseMedicationItems(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("medications", out var medsElement))
                return null;

            var items = new List<PrescriptionMedicationItem>();
            foreach (var med in medsElement.EnumerateArray())
            {
                var name = med.TryGetProperty("name", out var n) ? n.GetString() : null;
                if (string.IsNullOrWhiteSpace(name)) continue;

                items.Add(new PrescriptionMedicationItem(
                    Name: name,
                    Presentation: med.TryGetProperty("presentation", out var p) ? p.GetString() : null,
                    Dosage: med.TryGetProperty("dosage", out var d) ? d.GetString() : null,
                    Quantity: med.TryGetProperty("quantity", out var q) ? q.GetString() : null,
                    Observation: med.TryGetProperty("observation", out var o) ? o.GetString() : null
                ));
            }

            return items.Count > 0 ? items : null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao parsear JSON de medicamentos da IA");
            return null;
        }
    }
}
