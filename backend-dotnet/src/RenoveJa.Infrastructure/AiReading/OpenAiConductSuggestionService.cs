using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.AiReading;

/// <summary>
/// v2: Conduta mais estruturada com critérios de retorno, orientações ao paciente,
/// template SOAP, e exames com código TUSS.
/// </summary>
public class OpenAiConductSuggestionService : IAiConductSuggestionService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<OpenAIConfig> _config;
    private readonly ILogger<OpenAiConductSuggestionService> _logger;

    private const string OpenAiBaseUrl = "https://api.openai.com/v1";
    private const string GeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";

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
        var (apiKey, baseUrl, model) = ResolveProvider();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("Nenhuma API configurada (Gemini__ApiKey ou OpenAI__ApiKey) — skipping conduct suggestion");
            return null;
        }

        var result = await CallProviderAsync(input, apiKey, baseUrl, model, cancellationToken);
        if (result != null) return result;

        // Fallback: OpenAI falhou e Gemini configurada → tenta gemini-2.5-flash
        var usedOpenAi = model.StartsWith("gpt", StringComparison.OrdinalIgnoreCase);
        var geminiKey = _config.Value?.GeminiApiKey?.Trim();
        if (usedOpenAi && !string.IsNullOrEmpty(geminiKey) && !geminiKey.Contains("YOUR_") && !geminiKey.Contains("_HERE"))
        {
            _logger.LogInformation("IA conduta: Fallback para Gemini após falha OpenAI.");
            var url = !string.IsNullOrWhiteSpace(_config.Value?.GeminiApiBaseUrl) ? _config.Value!.GeminiApiBaseUrl!.Trim() : GeminiBaseUrl;
            return await CallProviderAsync(input, geminiKey!, url, "gemini-2.5-flash", cancellationToken);
        }
        return null;
    }

    private async Task<AiConductSuggestionResult?> CallProviderAsync(
        AiConductSuggestionInput input,
        string apiKey,
        string baseUrl,
        string model,
        CancellationToken cancellationToken)
    {
        try
        {
            var systemPrompt = BuildSystemPromptV2();
            var userPrompt = BuildUserPromptV2(input);
            var isGemini = baseUrl.Contains("generativelanguage", StringComparison.OrdinalIgnoreCase);

            var requestBody = new
            {
                model,
                temperature = 0.25,
                max_tokens = isGemini ? 4096 : 4000,
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
            client.Timeout = isGemini ? TimeSpan.FromSeconds(60) : TimeSpan.FromSeconds(30);

            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{baseUrl}/chat/completions", content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("IA conduct suggestion failed: {StatusCode}", response.StatusCode);
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

            var cleaned = CleanJsonResponse(message);
            return ParseResultV2(cleaned);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating conduct suggestion v2");
            return null;
        }
    }

    private static string BuildSystemPromptV2()
    {
        return """
            Você é um ASSISTENTE CLÍNICO de apoio ao médico na plataforma RenoveJá+ (telemedicina brasileira).
            Sua função é gerar uma conduta ESTRUTURADA que o médico revisará antes de aplicar.

            CONTEXTO:
            - Plataforma de telessaúde brasileira com receitas/exames digitais com assinatura ICP-Brasil
            - O médico tem total autonomia — você fornece um rascunho inteligente

            REGRAS ABSOLUTAS:
            - A decisão final é SEMPRE do médico
            - NÃO diagnostique. NÃO prescreva dosagens ou marcas comerciais
            - Comece a conduta com "Sugestão:" para clareza do caráter auxiliar
            - Se houver medicação controlada (tarja preta/vermelha), sugira acompanhamento presencial

            Responda APENAS com JSON válido, sem markdown:
            {
              "conduct_suggestion": "Conduta estruturada em formato narrativo (até 8 linhas). Estruture: (1) Hipótese diagnóstica provável com CID, (2) Orientação terapêutica geral, (3) Cuidados específicos, (4) Retorno/acompanhamento. Use linguagem profissional médica.",

              "soap_template": {
                "subjetivo": "S — Resumo da queixa principal e HDA em 2-3 frases",
                "objetivo": "O — O que examinar / sinais vitais relevantes",
                "avaliacao": "A — Hipótese diagnóstica principal + CID-10 + diferenciais",
                "plano": "P — Conduta: medicação, exames, orientações, retorno"
              },

              "suggested_exams": [
                {
                  "nome": "Nome técnico do exame",
                  "codigo_tuss": "Código TUSS quando conhecido, senão vazio",
                  "justificativa": "Por que solicitar neste caso",
                  "urgencia": "rotina | urgente",
                  "preparo": "Preparo do paciente (jejum, etc.) ou vazio"
                }
              ],

              "orientacoes_paciente": ["Orientações em linguagem acessível para o paciente. 2-4 itens. Ex: 'Beba pelo menos 2L de água por dia', 'Evite esforço físico intenso por 5 dias'"],

              "criterios_retorno": ["Sinais de alarme para retorno antecipado. 2-3 itens em linguagem acessível. Ex: 'Se a febre não baixar em 48h', 'Se surgir falta de ar ou dor no peito'"],

              "cid_sugerido": "Código CID-10 mais provável — Descrição. Ex: 'J06.9 - Infecção aguda das vias aéreas superiores não especificada'. APENAS códigos válidos CID-10."
            }
            """;
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

    private static string BuildUserPromptV2(AiConductSuggestionInput input)
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
        {
            var age = DateTime.Today.Year - input.PatientBirthDate.Value.Year;
            sb.AppendLine($"Data de nascimento: {input.PatientBirthDate:dd/MM/yyyy} (idade: ~{age} anos)");
        }
        if (!string.IsNullOrWhiteSpace(input.PatientGender))
            sb.AppendLine($"Gênero: {input.PatientGender}");
        if (!string.IsNullOrWhiteSpace(input.Symptoms))
            sb.AppendLine($"Sintomas/Queixa: {input.Symptoms}");
        if (input.Medications?.Count > 0)
            sb.AppendLine($"Medicamentos em uso: {string.Join(", ", input.Medications)}");
        if (input.Exams?.Count > 0)
            sb.AppendLine($"Exames solicitados: {string.Join(", ", input.Exams)}");
        if (!string.IsNullOrWhiteSpace(input.AiSummaryForDoctor))
            sb.AppendLine($"Resumo IA: {input.AiSummaryForDoctor}");
        if (!string.IsNullOrWhiteSpace(input.DoctorNotes))
            sb.AppendLine($"Notas do médico: {input.DoctorNotes}");

        sb.AppendLine();
        sb.AppendLine("Gere a conduta estruturada com template SOAP, exames (com TUSS), orientações ao paciente, critérios de retorno e CID sugerido.");

        return sb.ToString();
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

    private AiConductSuggestionResult? ParseResultV2(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            string? conduct = null;
            if (root.TryGetProperty("conduct_suggestion", out var cs) && cs.ValueKind == JsonValueKind.String)
                conduct = cs.GetString()?.Trim();

            // Parse SOAP template
            string? soapSubjetivo = null, soapObjetivo = null, soapAvaliacao = null, soapPlano = null;
            if (root.TryGetProperty("soap_template", out var soap) && soap.ValueKind == JsonValueKind.Object)
            {
                soapSubjetivo = soap.TryGetProperty("subjetivo", out var s) ? s.GetString() : null;
                soapObjetivo = soap.TryGetProperty("objetivo", out var o) ? o.GetString() : null;
                soapAvaliacao = soap.TryGetProperty("avaliacao", out var a) ? a.GetString() : null;
                soapPlano = soap.TryGetProperty("plano", out var p) ? p.GetString() : null;
            }

            // Parse suggested exams (now structured)
            var exams = new List<string>();
            if (root.TryGetProperty("suggested_exams", out var se) && se.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in se.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.Object)
                    {
                        var nome = item.TryGetProperty("nome", out var n) ? n.GetString()?.Trim() : null;
                        var tuss = item.TryGetProperty("codigo_tuss", out var t) ? t.GetString()?.Trim() : null;
                        var just = item.TryGetProperty("justificativa", out var j) ? j.GetString()?.Trim() : null;
                        if (!string.IsNullOrEmpty(nome))
                        {
                            var examLine = tuss is { Length: > 0 } ? $"{nome} (TUSS: {tuss})" : nome;
                            if (!string.IsNullOrEmpty(just))
                                examLine += $" — {just}";
                            exams.Add(examLine);
                        }
                    }
                    else
                    {
                        var val = item.GetString()?.Trim();
                        if (!string.IsNullOrEmpty(val))
                            exams.Add(val);
                    }
                }
            }

            // Parse orientações and critérios de retorno
            var orientacoes = ParseStringArray(root, "orientacoes_paciente");
            var criteriosRetorno = ParseStringArray(root, "criterios_retorno");

            // Parse CID sugerido
            string? cidSugerido = null;
            if (root.TryGetProperty("cid_sugerido", out var cid) && cid.ValueKind == JsonValueKind.String)
                cidSugerido = cid.GetString()?.Trim();

            // Build enriched conduct with SOAP
            if (!string.IsNullOrWhiteSpace(soapAvaliacao) || !string.IsNullOrWhiteSpace(soapPlano))
            {
                var soapFull = new StringBuilder();
                if (!string.IsNullOrWhiteSpace(conduct))
                    soapFull.AppendLine(conduct);
                soapFull.AppendLine();
                soapFull.AppendLine("--- NOTA SOAP ---");
                if (soapSubjetivo is { Length: > 0 }) soapFull.AppendLine($"S: {soapSubjetivo}");
                if (soapObjetivo is { Length: > 0 }) soapFull.AppendLine($"O: {soapObjetivo}");
                if (soapAvaliacao is { Length: > 0 }) soapFull.AppendLine($"A: {soapAvaliacao}");
                if (soapPlano is { Length: > 0 }) soapFull.AppendLine($"P: {soapPlano}");

                if (cidSugerido is { Length: > 0 })
                    soapFull.AppendLine($"\nCID: {cidSugerido}");

                if (orientacoes.Count > 0)
                {
                    soapFull.AppendLine("\n--- ORIENTAÇÕES AO PACIENTE ---");
                    foreach (var o in orientacoes)
                        soapFull.AppendLine($"• {o}");
                }

                if (criteriosRetorno.Count > 0)
                {
                    soapFull.AppendLine("\n--- CRITÉRIOS DE RETORNO ---");
                    foreach (var c in criteriosRetorno)
                        soapFull.AppendLine($"⚠️ {c}");
                }

                conduct = soapFull.ToString().Trim();
            }

            if (string.IsNullOrWhiteSpace(conduct) && exams.Count == 0)
                return null;

            return new AiConductSuggestionResult(conduct, exams.Count > 0 ? exams : null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse conduct suggestion v2 JSON: {Json}", json);
            return null;
        }
    }

    private static List<string> ParseStringArray(JsonElement root, string prop)
    {
        var list = new List<string>();
        if (!root.TryGetProperty(prop, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return list;
        foreach (var item in arr.EnumerateArray())
        {
            var val = item.GetString()?.Trim();
            if (!string.IsNullOrEmpty(val))
                list.Add(val);
        }
        return list;
    }
}
