using System.Linq;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;

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
    private readonly IAiInteractionLogRepository _aiInteractionLogRepository;

    private const string OpenAiBaseUrl = "https://api.openai.com/v1";
    private const string GeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";

    public OpenAiClinicalSummaryService(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        ILogger<OpenAiClinicalSummaryService> logger,
        IAiInteractionLogRepository aiInteractionLogRepository)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
        _aiInteractionLogRepository = aiInteractionLogRepository;
    }

    public async Task<ClinicalSummaryStructured?> GenerateStructuredAsync(
        ClinicalSummaryInput input,
        CancellationToken cancellationToken = default)
    {
        var (apiKey, baseUrl, model) = ResolveProvider();
        var result = await CallStructuredAsync(input, apiKey, baseUrl, model, cancellationToken);
        if (result != null) return result;

        // Fallback: Gemini falhou e OpenAI configurada → tenta gpt-4o
        var usedGemini = model.StartsWith("gemini", StringComparison.OrdinalIgnoreCase);
        var openAiKey = _config.Value?.ApiKey?.Trim();
        if (usedGemini && !string.IsNullOrEmpty(openAiKey) && !openAiKey.Contains("YOUR_") && !openAiKey.Contains("_HERE"))
        {
            _logger.LogInformation("IA resumo clínico: Fallback para OpenAI gpt-4o após falha Gemini.");
            return await CallStructuredAsync(input, openAiKey!, OpenAiBaseUrl, _config.Value?.Model ?? "gpt-4o", cancellationToken);
        }
        return null;
    }

    private async Task<ClinicalSummaryStructured?> CallStructuredAsync(
        ClinicalSummaryInput input,
        string apiKey,
        string baseUrl,
        string model,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("Nenhuma API configurada (Gemini__ApiKey ou OpenAI__ApiKey) — skipping clinical summary");
            return null;
        }

        try
        {
            var systemPrompt = """
                Você é um assistente clínico da plataforma RenoveJá+ (telemedicina brasileira).
                Sua função é gerar um RESUMO ESTRUTURADO do prontuário no padrão dos melhores EHRs do mundo (Epic, Cerner).

                REGRAS:
                - Use APENAS dados fornecidos. Não invente.
                - CID-10: use APENAS códigos válidos da classificação oficial OMS/SUS.
                - Extraia diagnósticos (CID) das consultas para problemList.
                - Consolide medicamentos das receitas mais recentes em activeMedications.
                - Identifique COMORBIDADES CRÔNICAS e liste separadamente.
                - Identifique TENDÊNCIAS nos exames (ex: glicemia subindo, PA controlada).
                - narrativeSummary: texto fluido de 200-350 palavras, cronológico, linguagem médica.
                - carePlan: plano de cuidado em 3-6 frases (seguimento, exames pendentes, ajustes, orientações).
                - alerts: alergias + pontos críticos + interações medicamentosas potenciais.

                Responda APENAS com um JSON válido, sem markdown, exatamente neste formato:
                {
                  "problemList": [
                    {
                      "cid": "Código CID-10",
                      "descricao": "Descrição completa",
                      "status": "ativo | resolvido | em investigação",
                      "desde": "Data aproximada de início se disponível"
                    }
                  ],
                  "comorbidadesCronicas": ["Lista de condições crônicas ativas: HAS, DM2, etc."],
                  "activeMedications": [
                    {
                      "nome": "Nome genérico + concentração",
                      "posologia": "Dose e frequência",
                      "inicio": "Data aproximada de início se disponível",
                      "indicacao": "Para qual condição"
                    }
                  ],
                  "narrativeSummary": "Texto narrativo completo com timeline clínica...",
                  "tendenciasExames": "Resumo das tendências observadas nos exames (ex: 'Glicemia de jejum em tendência de alta: 98 → 110 → 126'). Vazio se não aplicável.",
                  "carePlan": "Plano de cuidado detalhado: seguimento, exames de controle com periodicidade, ajustes terapêuticos sugeridos, orientações de estilo de vida...",
                  "alerts": [
                    {
                      "tipo": "alergia | interacao | contraindicacao | gravidade",
                      "descricao": "Descrição do alerta",
                      "prioridade": "alta | media | baixa"
                    }
                  ],
                  "lacunasInformacao": ["Informações que estão FALTANDO e que o médico deveria perguntar: alergias não informadas, exames desatualizados, etc."]
                }
                Arrays vazios [] se não houver dados. Strings vazias "" se não aplicável.
                """;

            var userContent = BuildUserContent(input);

            var isGemini = baseUrl.Contains("generativelanguage", StringComparison.OrdinalIgnoreCase);
            var maxTokens = isGemini ? 4096 : 1600;

            var requestBody = new
            {
                model,
                temperature = 0.2,
                max_tokens = maxTokens,
                response_format = new { type = "json_object" },
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userContent }
                }
            };

            var startedAt = DateTime.UtcNow;
            var json = JsonSerializer.Serialize(requestBody);
            var promptHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json))).ToLowerInvariant();
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            client.Timeout = TimeSpan.FromSeconds(50);

            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{baseUrl}/chat/completions", content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("IA clinical summary structured failed: {StatusCode}", response.StatusCode);
                await _aiInteractionLogRepository.LogAsync(AiInteractionLog.Create(
                    serviceName: nameof(OpenAiClinicalSummaryService),
                    modelName: model,
                    promptHash: promptHash,
                    success: false,
                    durationMs: (long)(DateTime.UtcNow - startedAt).TotalMilliseconds,
                    errorMessage: $"HTTP {(int)response.StatusCode}"), cancellationToken);
                // Fallback: Gemini falhou e OpenAI configurada → tenta gpt-4o
                var usedGemini = model.StartsWith("gemini", StringComparison.OrdinalIgnoreCase);
                var openAiKey = _config.Value?.ApiKey?.Trim();
                if (usedGemini && !string.IsNullOrEmpty(openAiKey) && !openAiKey.Contains("YOUR_") && !openAiKey.Contains("_HERE"))
                {
                    _logger.LogInformation("IA resumo clínico: Fallback para OpenAI gpt-4o após falha Gemini.");
                    return await CallStructuredAsync(input, openAiKey!, OpenAiBaseUrl, _config.Value?.Model ?? "gpt-4o", cancellationToken);
                }
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

            await _aiInteractionLogRepository.LogAsync(AiInteractionLog.Create(
                serviceName: nameof(OpenAiClinicalSummaryService),
                modelName: model,
                promptHash: promptHash,
                success: true,
                responseSummary: message.Length > 500 ? message[..500] : message,
                durationMs: (long)(DateTime.UtcNow - startedAt).TotalMilliseconds), cancellationToken);

            var cleaned = CleanJsonResponse(message);
            var result = ParseStructuredSummary(cleaned, _logger);
            if (result == null)
                _logger.LogWarning("Clinical summary: ParseStructuredSummary retornou null. Raw (preview): {Preview}", message.Length > 400 ? message[..400] + "..." : message);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating structured clinical summary");
            return null;
        }
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

    private static ClinicalSummaryStructured? ParseStructuredSummary(string json, ILogger? logger = null)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Problem list — agora é array de objetos ou strings
            var problemList = new List<string>();
            if (root.TryGetProperty("problemList", out var plEl) && plEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in plEl.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.Object)
                    {
                        var cid = item.TryGetProperty("cid", out var c) ? c.GetString() : "";
                        var desc = item.TryGetProperty("descricao", out var d) ? d.GetString() : "";
                        var status = item.TryGetProperty("status", out var s) ? s.GetString() : "";
                        var entry = $"{cid} - {desc}".Trim(' ', '-');
                        if (!string.IsNullOrEmpty(status) && status != "ativo")
                            entry += $" [{status}]";
                        if (!string.IsNullOrEmpty(entry))
                            problemList.Add(entry);
                    }
                    else
                    {
                        var s = item.GetString()?.Trim();
                        if (!string.IsNullOrEmpty(s)) problemList.Add(s);
                    }
                }
            }

            // Active medications — agora é array de objetos ou strings
            var activeMedications = new List<string>();
            if (root.TryGetProperty("activeMedications", out var amEl) && amEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in amEl.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.Object)
                    {
                        var nome = item.TryGetProperty("nome", out var n) ? n.GetString() : "";
                        var poso = item.TryGetProperty("posologia", out var p) ? p.GetString() : "";
                        var entry = !string.IsNullOrEmpty(poso) ? $"{nome} — {poso}" : nome;
                        if (!string.IsNullOrEmpty(entry?.Trim()))
                            activeMedications.Add(entry!.Trim());
                    }
                    else
                    {
                        var s = item.GetString()?.Trim();
                        if (!string.IsNullOrEmpty(s)) activeMedications.Add(s);
                    }
                }
            }

            // Comorbidades crônicas (append to problem list)
            if (root.TryGetProperty("comorbidadesCronicas", out var ccEl) && ccEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in ccEl.EnumerateArray())
                {
                    var s = item.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(s) && !problemList.Any(p => p.Contains(s, StringComparison.OrdinalIgnoreCase)))
                        problemList.Add($"[Crônico] {s}");
                }
            }

            var narrativeSummary = root.TryGetProperty("narrativeSummary", out var ns) ? ns.GetString()?.Trim() : null;

            // Append tendências if present
            if (root.TryGetProperty("tendenciasExames", out var te) && !string.IsNullOrWhiteSpace(te.GetString()))
            {
                var tendencias = te.GetString()!.Trim();
                narrativeSummary = narrativeSummary is { Length: > 0 }
                    ? $"{narrativeSummary}\n\nTendências dos Exames: {tendencias}"
                    : tendencias;
            }

            var carePlan = root.TryGetProperty("carePlan", out var cp) ? cp.GetString()?.Trim() : null;

            // Alerts — agora é array de objetos ou strings
            var alerts = new List<string>();
            if (root.TryGetProperty("alerts", out var alEl) && alEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in alEl.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.Object)
                    {
                        var tipo = item.TryGetProperty("tipo", out var t) ? t.GetString() : "";
                        var desc = item.TryGetProperty("descricao", out var d) ? d.GetString() : "";
                        var prio = item.TryGetProperty("prioridade", out var p) ? p.GetString() : "";
                        var prefix = prio?.ToLower() == "alta" ? "🔴" : prio?.ToLower() == "media" ? "🟡" : "🟢";
                        var entry = $"{prefix} [{tipo?.ToUpper()}] {desc}".Trim();
                        if (entry.Length > 5) alerts.Add(entry);
                    }
                    else
                    {
                        var s = item.GetString()?.Trim();
                        if (!string.IsNullOrEmpty(s)) alerts.Add(s);
                    }
                }
            }

            // Lacunas de informação (append to alerts as low priority)
            if (root.TryGetProperty("lacunasInformacao", out var lacEl) && lacEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in lacEl.EnumerateArray())
                {
                    var s = item.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(s))
                        alerts.Add($"ℹ️ [LACUNA] {s}");
                }
            }

            return new ClinicalSummaryStructured(
                problemList,
                activeMedications,
                narrativeSummary,
                carePlan,
                alerts);
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Clinical summary: falha ao parsear JSON. Cleaned (preview): {Preview}", json.Length > 300 ? json[..300] + "..." : json);
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
        var (apiKey, baseUrl, model) = ResolveProvider();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("Nenhuma API configurada (Gemini__ApiKey ou OpenAI__ApiKey) — skipping clinical summary");
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
                model,
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
            var response = await client.PostAsync($"{baseUrl}/chat/completions", content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("IA clinical summary failed: {StatusCode}", response.StatusCode);
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

    private (string? apiKey, string baseUrl, string model) ResolveProvider()
    {
        var geminiKey = _config.Value?.GeminiApiKey?.Trim();
        if (!string.IsNullOrEmpty(geminiKey) && !geminiKey.Contains("YOUR_") && !geminiKey.Contains("_HERE"))
        {
            var url = !string.IsNullOrWhiteSpace(_config.Value?.GeminiApiBaseUrl)
                ? _config.Value!.GeminiApiBaseUrl!.Trim()
                : GeminiBaseUrl;
            return (geminiKey, url, "gemini-2.5-flash");
        }
        var openAiKey = _config.Value?.ApiKey?.Trim() ?? "";
        return (openAiKey, OpenAiBaseUrl, _config.Value?.Model ?? "gpt-4o");
    }

    private static string BuildUserContent(ClinicalSummaryInput input)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Paciente: {input.PatientName}");
        if (input.PatientBirthDate.HasValue)
        {
            var age = DateTime.Today.Year - input.PatientBirthDate.Value.Year;
            sb.AppendLine($"Data de nascimento: {input.PatientBirthDate:dd/MM/yyyy} (idade: ~{age} anos)");
        }
        if (!string.IsNullOrWhiteSpace(input.PatientGender))
            sb.AppendLine($"Sexo: {input.PatientGender}");
        if (input.Allergies.Count > 0)
            sb.AppendLine($"ALERGIAS: {string.Join(", ", input.Allergies)}");
        else
            sb.AppendLine("ALERGIAS: Não informadas (PERGUNTAR ao paciente)");
        sb.AppendLine();

        if (input.Consultations.Count > 0)
        {
            sb.AppendLine("--- CONSULTAS (ordem cronológica) ---");
            foreach (var c in input.Consultations.OrderBy(x => x.Date))
            {
                sb.AppendLine($"Data: {c.Date:dd/MM/yyyy}");
                if (!string.IsNullOrWhiteSpace(c.Symptoms))
                    sb.AppendLine($"  Queixa: {c.Symptoms}");
                if (!string.IsNullOrWhiteSpace(c.Cid))
                    sb.AppendLine($"  CID: {c.Cid}");
                if (!string.IsNullOrWhiteSpace(c.Conduct))
                    sb.AppendLine($"  Conduta: {c.Conduct}");
                if (!string.IsNullOrWhiteSpace(c.AnamnesisSnippet))
                    sb.AppendLine($"  Anamnese: {c.AnamnesisSnippet}");
                sb.AppendLine();
            }
        }

        if (input.Prescriptions.Count > 0)
        {
            sb.AppendLine("--- RECEITAS (ordem cronológica) ---");
            foreach (var p in input.Prescriptions.OrderBy(x => x.Date))
            {
                sb.AppendLine($"Data: {p.Date:dd/MM/yyyy} | Tipo: {p.Type}");
                sb.AppendLine($"  Medicamentos: {string.Join(", ", p.Medications)}");
                if (!string.IsNullOrWhiteSpace(p.Notes))
                    sb.AppendLine($"  Obs: {p.Notes}");
                sb.AppendLine();
            }
        }

        if (input.Exams.Count > 0)
        {
            sb.AppendLine("--- EXAMES (ordem cronológica) ---");
            foreach (var e in input.Exams.OrderBy(x => x.Date))
            {
                sb.AppendLine($"Data: {e.Date:dd/MM/yyyy}");
                sb.AppendLine($"  Exames: {string.Join(", ", e.Exams)}");
                if (!string.IsNullOrWhiteSpace(e.Symptoms))
                    sb.AppendLine($"  Queixa: {e.Symptoms}");
                if (!string.IsNullOrWhiteSpace(e.Notes))
                    sb.AppendLine($"  Obs/Resultados: {e.Notes}");
                sb.AppendLine();
            }
        }

        sb.AppendLine("INSTRUÇÕES FINAIS:");
        sb.AppendLine("1. Gere o JSON estruturado consolidando TODAS as informações acima.");
        sb.AppendLine("2. Identifique comorbidades crônicas implícitas (ex: uso contínuo de losartana = HAS).");
        sb.AppendLine("3. Identifique tendências nos exames (valores subindo/descendo/estáveis).");
        sb.AppendLine("4. Liste lacunas de informação que o médico deveria preencher.");
        sb.AppendLine("5. No carePlan, seja específico: quais exames repetir, quando retornar, o que ajustar.");
        return sb.ToString();
    }
}
