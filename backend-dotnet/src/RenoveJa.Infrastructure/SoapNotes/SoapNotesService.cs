using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.SoapNotes;

/// <summary>
/// Gera notas SOAP pós-consulta usando GPT-4o (principal) ou Gemini 2.5 Flash (fallback).
/// Prompt calibrado para o padrão CFM/CRM brasileiro com terminologia médica PT-BR.
/// Chamado de forma assíncrona no FinishConsultation — não bloqueia o fluxo.
/// </summary>
public class SoapNotesService : ISoapNotesService
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly IOptions<OpenAIConfig> _config;
    private readonly ILogger<SoapNotesService> _logger;

    private const string OpenAiBaseUrl = "https://api.openai.com/v1";
    private const string GeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";

    /// <summary>Options for serializing API requests (snake_case for OpenAI/Gemini).</summary>
    private static readonly JsonSerializerOptions JsonOptsRequest = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = false
    };

    /// <summary>Options for deserializing API responses (case-insensitive).</summary>
    private static readonly JsonSerializerOptions JsonOptsResponse = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public SoapNotesService(
        IHttpClientFactory httpFactory,
        IOptions<OpenAIConfig> config,
        ILogger<SoapNotesService> logger)
    {
        _httpFactory = httpFactory;
        _config = config;
        _logger = logger;
    }

    public async Task<SoapNotesResult?> GenerateAsync(
        string transcriptText,
        string? anamnesisJson,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(transcriptText))
        {
            _logger.LogWarning("[SOAP] Transcript vazio — notas SOAP não geradas.");
            return null;
        }

        var (apiKey, baseUrl, model) = ResolveProvider();
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("[SOAP] Nenhuma API configurada (OpenAI ou Gemini).");
            return null;
        }

        var systemPrompt = BuildSystemPrompt();
        var userPrompt = BuildUserPrompt(transcriptText, anamnesisJson);

        try
        {
            var result = await CallProviderAsync(systemPrompt, userPrompt, apiKey, baseUrl, model, cancellationToken);
            if (result != null)
            {
                _logger.LogInformation("[SOAP] Notas SOAP geradas OK. model={Model}", model);
                return result;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[SOAP] Falha no provider primário ({Model}), tentando fallback.", model);
        }

        var geminiKey = _config.Value?.GeminiApiKey?.Trim();
        var usedOpenAi = model.StartsWith("gpt", StringComparison.OrdinalIgnoreCase);
        if (usedOpenAi && !string.IsNullOrEmpty(geminiKey))
        {
            try
            {
                var fallback = await CallProviderAsync(
                    systemPrompt, userPrompt, geminiKey, GeminiBaseUrl, "gemini-2.5-flash", cancellationToken);
                if (fallback != null)
                {
                    _logger.LogInformation("[SOAP] Notas SOAP geradas via fallback Gemini.");
                    return fallback;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[SOAP] Fallback Gemini também falhou.");
            }
        }

        return null;
    }

    private (string apiKey, string baseUrl, string model) ResolveProvider()
    {
        var openAiKey = _config.Value?.ApiKey?.Trim();
        if (!string.IsNullOrEmpty(openAiKey) && !openAiKey.Contains("YOUR_"))
            return (openAiKey, OpenAiBaseUrl, _config.Value?.Model ?? "gpt-4o");

        var geminiKey = _config.Value?.GeminiApiKey?.Trim();
        if (!string.IsNullOrEmpty(geminiKey) && !geminiKey.Contains("YOUR_"))
            return (geminiKey, GeminiBaseUrl, "gemini-2.5-flash");

        return (string.Empty, OpenAiBaseUrl, "gpt-4o");
    }

    private async Task<SoapNotesResult?> CallProviderAsync(
        string systemPrompt, string userPrompt,
        string apiKey, string baseUrl, string model,
        CancellationToken ct)
    {
        var isGemini = baseUrl.Contains("generativelanguage", StringComparison.OrdinalIgnoreCase);
        var body = new
        {
            model,
            temperature = 0.15,
            max_tokens = isGemini ? 8192 : 4096,
            response_format = new { type = "json_object" },
            messages = new object[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user",   content = userPrompt },
            }
        };

        var json = JsonSerializer.Serialize(body, JsonOptsRequest);
        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        client.Timeout = TimeSpan.FromSeconds(90);

        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await client.PostAsync($"{baseUrl}/chat/completions", content, ct);
        var responseJson = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("[SOAP] API error {Status}: {Body}", response.StatusCode,
                responseJson.Length > 400 ? responseJson[..400] : responseJson);
            return null;
        }

        using var doc = JsonDocument.Parse(responseJson);
        var text = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        if (string.IsNullOrWhiteSpace(text)) return null;
        return ParseSoapJson(text);
    }

    private SoapNotesResult? ParseSoapJson(string raw)
    {
        var cleaned = raw.Trim();
        var firstBrace = cleaned.IndexOf('{');
        var lastBrace = cleaned.LastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace)
            cleaned = cleaned[firstBrace..(lastBrace + 1)];

        try
        {
            using var doc = JsonDocument.Parse(cleaned);
            var root = doc.RootElement;

            var terms = new List<MedicalTerm>();
            if (root.TryGetProperty("medical_terms", out var termsEl) && termsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var t in termsEl.EnumerateArray())
                {
                    var term     = t.TryGetProperty("term",     out var te) ? te.GetString() ?? "" : "";
                    var category = t.TryGetProperty("category", out var ca) ? ca.GetString() ?? "condition" : "condition";
                    var icd      = t.TryGetProperty("icd_code", out var ic) ? ic.GetString() : null;
                    if (!string.IsNullOrWhiteSpace(term))
                        terms.Add(new MedicalTerm(term, category, icd));
                }
            }

            return new SoapNotesResult(
                GetStr(root, "subjective", "S"),
                GetStr(root, "objective",  "O"),
                GetStr(root, "assessment", "A"),
                GetStr(root, "plan",       "P"),
                terms,
                cleaned);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[SOAP] Falha ao parsear JSON. Preview={Preview}",
                cleaned.Length > 200 ? cleaned[..200] : cleaned);
            return null;
        }
    }

    private static string GetStr(JsonElement root, string key1, string key2)
    {
        if (root.TryGetProperty(key1, out var v) && v.ValueKind == JsonValueKind.String) return v.GetString() ?? "";
        if (root.TryGetProperty(key2, out var v2) && v2.ValueKind == JsonValueKind.String) return v2.GetString() ?? "";
        return "";
    }

    private static string BuildSystemPrompt() => """
        Você é um assistente médico especializado em documentação clínica para o Brasil.
        Gere notas SOAP ESTRUTURADAS E ENRIQUECIDAS em Português do Brasil, seguindo os padrões do CFM/CRM.
        CAPRICHE: cada seção deve ser DETALHADA, completa e pronta para prontuário.

        REGRAS ABSOLUTAS:
        1. Responda SOMENTE com JSON válido. Nenhum texto fora do JSON.
        2. Use terminologia médica brasileira (PT-BR).
        3. Seja objetivo e clínico. Sem linguagem informal.
        4. Não invente informações que não estejam no transcript ou na anamnese.
        5. Se uma seção não tiver dados, escreva: "Dados insuficientes no transcript."
        6. CID-10: use códigos brasileiros quando disponíveis (subcategoria mais específica).
        7. Medicamentos: nome genérico (DCB) + dose + posologia + duração. Comercial entre parênteses se mencionado.

        FORMATO DE SAÍDA (JSON):
        {
          "subjective": "...",
          "objective": "...",
          "assessment": "...",
          "plan": "...",
          "medical_terms": [
            { "term": "Hipertensão arterial sistêmica", "category": "condition", "icd_code": "I10" },
            { "term": "Losartana 50mg", "category": "medication", "icd_code": null },
            { "term": "Hemograma completo", "category": "exam", "icd_code": null }
          ]
        }

        SEÇÕES — ENRIQUECIDAS (2-5 frases cada, quando houver dados):
        - subjective (S): Queixa principal + duração + localização anatômica + intensidade (EVA) + caráter + irradiação.
          HDA com OPQRST, fatores de melhora/piora, tratamentos tentados. Sintomas associados e negativos relevantes.
        - objective (O): Sinais vitais (se mencionados), exame físico dirigido, achados objetivos.
          Em teleconsulta: observações visuais, dados relatados pelo paciente, resultados de exames citados.
        - assessment (A): Hipótese(s) diagnóstica(s) com CID-10 completo. Raciocínio clínico em 2-3 frases.
          Diagnóstico diferencial quando aplicável. NUNCA invente CIDs sem suporte no transcript/anamnese.
        - plan (P): Conduta DETALHADA — prescrições com medicamento, dose, posologia e duração; exames solicitados
          com nomes completos; orientações ao paciente (3-5 itens); critérios de retorno; data de retorno se mencionada.
        - medical_terms: Todos os termos médicos relevantes. Categorias: condition, medication, procedure, exam.
        """;

    private static string BuildUserPrompt(string transcript, string? anamnesisJson)
    {
        var sb = new StringBuilder();
        sb.AppendLine("=== TRANSCRIPT DA TELECONSULTA ===");
        sb.AppendLine(transcript.Length > 12000 ? transcript[..12000] + "\n[... truncado ...]" : transcript);

        if (!string.IsNullOrWhiteSpace(anamnesisJson))
        {
            sb.AppendLine("\n=== ANAMNESE ESTRUTURADA (use como referência) ===");
            sb.AppendLine(anamnesisJson.Length > 3000 ? anamnesisJson[..3000] + "..." : anamnesisJson);
        }

        sb.AppendLine("\nGere as notas SOAP completas em JSON.");
        return sb.ToString();
    }
}
