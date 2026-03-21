using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Consultation;
using RenoveJa.Application.Interfaces;
using RenoveJa.Infrastructure.ConsultationAnamnesis;
using StackExchange.Redis;

namespace RenoveJa.Infrastructure.ClinicalEvidence;

/// <summary>
/// Busca evidências clínicas (Cochrane / PubMed) e usa GPT-4o para validar contra hipótese diagnóstica.
/// Fluxo: Anamnese JSON → ExtractSearchTerms → PubMed (Cochrane > Meta > RCT) → GPT-4o filtra/resume → EvidenceItemDto[].
/// Cache Redis: 14 dias por hash(CID + termos), evita rebater PubMed e GPT em diagnósticos repetidos.
/// </summary>
public sealed class ClinicalEvidenceService : IClinicalEvidenceService
{
    // v2: cache key includes translation version — invalidates old PT-only caches
    private const string CacheKeyPrefix = "clinical:evidence:v2:";
    private static readonly TimeSpan CacheExpiration = TimeSpan.FromDays(14);
    private const int MaxAbstractCharsForGpt = 6000;

    private readonly PubMedClient _pubMedClient;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<OpenAIConfig> _config;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<ClinicalEvidenceService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public ClinicalEvidenceService(
        PubMedClient pubMedClient,
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        IConnectionMultiplexer redis,
        ILogger<ClinicalEvidenceService> logger)
    {
        _pubMedClient = pubMedClient;
        _httpClientFactory = httpClientFactory;
        _config = config;
        _redis = redis;
        _logger = logger;
    }

    public async Task<IReadOnlyList<EvidenceItemDto>> SearchEvidenceAsync(
        string anamnesisJson,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(anamnesisJson))
            return Array.Empty<EvidenceItemDto>();

        try
        {
            using var doc = JsonDocument.Parse(anamnesisJson);
            var root = doc.RootElement;

            // Extrair termos de busca e contexto clínico do AnamnesisResponseParser.Evidence
            var searchTerms = AnamnesisResponseParser.ExtractSearchTerms(root);
            if (searchTerms.Count == 0)
            {
                _logger.LogDebug("[ClinicalEvidence] Sem termos de busca extraídos da anamnese.");
                return Array.Empty<EvidenceItemDto>();
            }

            var clinicalContext = AnamnesisResponseParser.BuildClinicalContextForPrompt(root);

            // Cache: hash dos termos → evita rebater PubMed e GPT
            var cacheKey = BuildCacheKey(searchTerms);
            var cached = await TryGetCacheAsync(cacheKey);
            if (cached != null)
            {
                _logger.LogDebug("[ClinicalEvidence] Cache HIT: {CacheKey} ({Count} itens)", cacheKey, cached.Count);
                return cached;
            }

            // Traduzir termos PT→EN para PubMed (indexado em inglês)
            var englishTerms = await TranslateTermsToEnglishAsync(searchTerms, cancellationToken);
            _logger.LogInformation("[ClinicalEvidence] Termos PT: {PtTerms} → EN: {EnTerms}",
                string.Join(" | ", searchTerms), string.Join(" | ", englishTerms));

            // Buscar no PubMed (cascata: Cochrane > Meta > RCT > geral)
            var articles = await _pubMedClient.SearchAsync(englishTerms, 6, cancellationToken);

            if (articles.Count == 0)
            {
                _logger.LogInformation("[ClinicalEvidence] PubMed retornou 0 artigos para termos={Terms}", string.Join(" | ", searchTerms));
                // Cache vazio por 24h pra não rebater de novo em diagnósticos sem literatura
                await SetCacheAsync(cacheKey, Array.Empty<EvidenceItemDto>(), TimeSpan.FromHours(24));
                return Array.Empty<EvidenceItemDto>();
            }

            // GPT-4o: filtrar e resumir abstracts contra contexto clínico
            var evidenceItems = await FilterWithGptAsync(articles, clinicalContext, cancellationToken);

            // Cache resultado completo
            if (evidenceItems.Count > 0)
                await SetCacheAsync(cacheKey, evidenceItems, CacheExpiration);

            _logger.LogInformation("[ClinicalEvidence] Resultado: {Count} evidências (de {Total} artigos PubMed)",
                evidenceItems.Count, articles.Count);

            return evidenceItems;
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "[ClinicalEvidence] Anamnese JSON inválido.");
            return Array.Empty<EvidenceItemDto>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ClinicalEvidence] Erro ao buscar evidências.");
            return Array.Empty<EvidenceItemDto>();
        }
    }

    /// <summary>
    /// Envia artigos + contexto clínico ao GPT-4o para filtrar, resumir e validar contra hipótese.
    /// Retorna EvidenceItemDto com resumo em português, nível de evidência e confirmação/contestação.
    /// </summary>
    private async Task<IReadOnlyList<EvidenceItemDto>> FilterWithGptAsync(
        List<PubMedArticle> articles,
        string clinicalContext,
        CancellationToken ct)
    {
        var apiKey = _config.Value?.ApiKey?.Trim();
        if (string.IsNullOrEmpty(apiKey) || apiKey.Contains("YOUR_"))
        {
            // Sem OpenAI key: retorna artigos sem filtragem GPT (só dados do PubMed)
            _logger.LogWarning("[ClinicalEvidence] OpenAI API key não configurada. Retornando artigos brutos do PubMed.");
            return articles.Select(a => new EvidenceItemDto(
                Title: a.Title,
                Abstract: TruncateAbstract(a.Abstract, 300),
                Source: $"{a.Journal} ({a.Year})",
                TranslatedAbstract: null,
                RelevantExcerpts: null,
                ClinicalRelevance: null,
                Provider: EvidenceProvider.PubMed,
                Url: a.PubMedUrl,
                ConexaoComPaciente: null,
                NivelEvidencia: a.EvidenceLevel,
                MotivoSelecao: null
            )).ToList();
        }

        // Montar prompt com abstracts truncados
        var articlesText = new StringBuilder();
        var totalChars = 0;
        foreach (var a in articles)
        {
            var abstractTrunc = TruncateAbstract(a.Abstract, 800);
            var entry = $"---\nPMID: {a.Pmid}\nTítulo: {a.Title}\nJornal: {a.Journal} ({a.Year})\nNível: {a.EvidenceLevel}\nAbstract: {abstractTrunc}\n";
            if (totalChars + entry.Length > MaxAbstractCharsForGpt) break;
            articlesText.Append(entry);
            totalChars += entry.Length;
        }

        var systemPrompt = @"Você é um assistente clínico de apoio à decisão médica no Brasil.
Recebe o contexto clínico de um paciente (hipótese diagnóstica, sintomas) e uma lista de artigos científicos do PubMed.

Sua tarefa:
1. Para cada artigo, avalie se CONFIRMA ou CONTESTA a hipótese diagnóstica.
2. Resuma o achado principal em UMA frase em português (máx 120 caracteres).
3. Classifique a relevância: ""confirma"", ""contesta"" ou ""complementa"".
4. Se algum artigo sugere diagnóstico diferencial importante, indique como ""alerta"".

Responda SOMENTE em JSON válido, sem markdown:
[
  {
    ""pmid"": ""12345678"",
    ""resumo"": ""Achado principal em português"",
    ""relevancia"": ""confirma"",
    ""motivo"": ""Breve justificativa de por que este artigo é relevante""
  }
]

Inclua apenas artigos relevantes (descarte os irrelevantes). Máximo 5 artigos no resultado.";

        var userContent = $@"CONTEXTO CLÍNICO DO PACIENTE:
{clinicalContext}

ARTIGOS CIENTÍFICOS ENCONTRADOS:
{articlesText}

Analise e retorne JSON com os artigos relevantes que confirmam ou contestam a hipótese.";

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
            client.Timeout = TimeSpan.FromSeconds(20);

            // Usa gpt-4o por padrão; se falhar e Gemini estiver configurado, faz fallback
            var model = "gpt-4o";
            var baseUrl = "https://api.openai.com/v1";
            var maxTokens = 2000;

            var requestBody = new
            {
                model,
                messages = new object[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userContent }
                },
                max_tokens = maxTokens,
                temperature = 0.05
            };

            var jsonBody = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
            });

            using var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{baseUrl}/chat/completions", content, ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[ClinicalEvidence] GPT-4o retornou {StatusCode}. Tentando fallback Gemini.", response.StatusCode);

                // Fallback: Gemini
                var geminiKey = _config.Value?.GeminiApiKey?.Trim();
                if (!string.IsNullOrEmpty(geminiKey) && !geminiKey.Contains("YOUR_"))
                {
                    var geminiBaseUrl = !string.IsNullOrWhiteSpace(_config.Value?.GeminiApiBaseUrl)
                        ? _config.Value!.GeminiApiBaseUrl!.Trim()
                        : "https://generativelanguage.googleapis.com/v1beta/openai";
                    client.DefaultRequestHeaders.Authorization =
                        new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", geminiKey);

                    var geminiBody = JsonSerializer.Serialize(new
                    {
                        model = "gemini-2.5-flash",
                        messages = requestBody.messages,
                        max_tokens = 2000,
                        temperature = 0.05
                    }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower });

                    using var geminiContent = new StringContent(geminiBody, Encoding.UTF8, "application/json");
                    var geminiResponse = await client.PostAsync($"{geminiBaseUrl}/chat/completions", geminiContent, ct);
                    if (geminiResponse.IsSuccessStatusCode)
                    {
                        response = geminiResponse;
                        _logger.LogInformation("[ClinicalEvidence] Fallback Gemini OK.");
                    }
                    else
                    {
                        _logger.LogWarning("[ClinicalEvidence] Fallback Gemini também falhou: {StatusCode}", geminiResponse.StatusCode);
                        return articles.Take(5).Select(a => BuildFallbackDto(a)).ToList();
                    }
                }
                else
                {
                    return articles.Take(5).Select(a => BuildFallbackDto(a)).ToList();
                }
            }

            var responseJson = await response.Content.ReadAsStringAsync(ct);
            using var responseDoc = JsonDocument.Parse(responseJson);
            var gptContent = responseDoc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "[]";

            // Limpar possíveis markdown fences
            gptContent = gptContent.Trim();
            if (gptContent.StartsWith("```json")) gptContent = gptContent[7..];
            if (gptContent.StartsWith("```")) gptContent = gptContent[3..];
            if (gptContent.EndsWith("```")) gptContent = gptContent[..^3];
            gptContent = gptContent.Trim();

            var gptResults = JsonSerializer.Deserialize<List<GptEvidenceResult>>(gptContent, JsonOptions);
            if (gptResults == null || gptResults.Count == 0)
                return articles.Take(5).Select(a => BuildFallbackDto(a)).ToList();

            // Mapear GPT results → EvidenceItemDto, enriquecendo com dados do PubMed
            var articleMap = articles.ToDictionary(a => a.Pmid, a => a);
            var result = new List<EvidenceItemDto>();

            foreach (var gpt in gptResults.Take(5))
            {
                if (!articleMap.TryGetValue(gpt.Pmid ?? "", out var article))
                    continue;

                var relevanciaEmoji = gpt.Relevancia?.ToLowerInvariant() switch
                {
                    "confirma" => "✅",
                    "contesta" => "⚠️",
                    "complementa" => "ℹ️",
                    "alerta" => "🚨",
                    _ => "📎"
                };

                result.Add(new EvidenceItemDto(
                    Title: article.Title,
                    Abstract: TruncateAbstract(article.Abstract, 300),
                    Source: $"{article.Journal} ({article.Year})",
                    TranslatedAbstract: gpt.Resumo,
                    RelevantExcerpts: null,
                    ClinicalRelevance: $"{relevanciaEmoji} {gpt.Resumo}",
                    Provider: EvidenceProvider.PubMed,
                    Url: article.PubMedUrl,
                    ConexaoComPaciente: gpt.Relevancia,
                    NivelEvidencia: article.EvidenceLevel,
                    MotivoSelecao: gpt.Motivo
                ));
            }

            return result.Count > 0 ? result : articles.Take(5).Select(a => BuildFallbackDto(a)).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[ClinicalEvidence] Erro ao filtrar com GPT-4o. Retornando artigos brutos.");
            return articles.Take(5).Select(a => BuildFallbackDto(a)).ToList();
        }
    }

    // ── Translation PT→EN for PubMed ──

    /// <summary>
    /// CID codes (e.g. H66, E10) são mantidos e convertidos para MeSH terms via GPT-4o-mini.
    /// Termos descritivos em português são traduzidos para inglês médico (MeSH-compatible).
    /// Usa gpt-4o-mini (rápido e barato) com fallback para dicionário estático.
    /// </summary>
    private async Task<List<string>> TranslateTermsToEnglishAsync(
        List<string> portugueseTerms,
        CancellationToken ct)
    {
        if (portugueseTerms.Count == 0)
            return portugueseTerms;

        // Separar CID codes dos termos descritivos
        var cidCodes = new List<string>();
        var descriptiveTerms = new List<string>();
        foreach (var term in portugueseTerms)
        {
            if (System.Text.RegularExpressions.Regex.IsMatch(term, @"^[A-Z]\d{2}(\.\d+)?$"))
                cidCodes.Add(term);
            else
                descriptiveTerms.Add(term);
        }

        // Se só tem CID codes, usar como MeSH terms direto
        if (descriptiveTerms.Count == 0)
            return cidCodes;

        // Tentar tradução via LLM (gpt-4o-mini: ~100ms, ~$0.0001)
        try
        {
            var apiKey = _config.Value?.ApiKey?.Trim();
            if (string.IsNullOrEmpty(apiKey) || apiKey.Contains("YOUR_"))
            {
                // Sem API key: tentar fallback Gemini
                return await TranslateWithGeminiFallbackAsync(cidCodes, descriptiveTerms, ct)
                    ?? FallbackStaticTranslation(cidCodes, descriptiveTerms);
            }

            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
            client.Timeout = TimeSpan.FromSeconds(8);

            var termsJoined = string.Join("\n", descriptiveTerms.Select((t, i) => $"{i + 1}. {t}"));
            var prompt = $@"Translate these Portuguese medical terms to English MeSH-compatible terms for PubMed search.
Return ONLY a JSON array of English terms, one per input line. Keep terms concise (2-4 words max).
If a term contains an ICD code (like H66, E10), return the standard English disease name for that code.

Portuguese terms:
{termsJoined}

Example: [""otitis media"", ""ear pain and fever""]";

            var requestBody = new
            {
                model = "gpt-4o-mini",
                messages = new object[]
                {
                    new { role = "user", content = prompt }
                },
                max_tokens = 200,
                temperature = 0.0
            };

            var jsonBody = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
            });

            using var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
            var response = await client.PostAsync("https://api.openai.com/v1/chat/completions", content, ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[ClinicalEvidence] Tradução GPT-4o-mini falhou: {StatusCode}. Usando fallback.", response.StatusCode);
                return await TranslateWithGeminiFallbackAsync(cidCodes, descriptiveTerms, ct)
                    ?? FallbackStaticTranslation(cidCodes, descriptiveTerms);
            }

            var responseJson = await response.Content.ReadAsStringAsync(ct);
            using var responseDoc = JsonDocument.Parse(responseJson);
            var gptContent = responseDoc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "[]";

            // Limpar markdown fences
            gptContent = gptContent.Trim();
            if (gptContent.StartsWith("```json")) gptContent = gptContent[7..];
            if (gptContent.StartsWith("```")) gptContent = gptContent[3..];
            if (gptContent.EndsWith("```")) gptContent = gptContent[..^3];
            gptContent = gptContent.Trim();

            var translated = JsonSerializer.Deserialize<List<string>>(gptContent);
            if (translated == null || translated.Count == 0)
                return FallbackStaticTranslation(cidCodes, descriptiveTerms);

            // Combinar CID codes + termos traduzidos
            var result = new List<string>(cidCodes);
            result.AddRange(translated.Where(t => !string.IsNullOrWhiteSpace(t)));
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[ClinicalEvidence] Erro na tradução PT→EN. Usando fallback.");
            return FallbackStaticTranslation(cidCodes, descriptiveTerms);
        }
    }

    /// <summary>Fallback Gemini para tradução quando OpenAI falha.</summary>
    private async Task<List<string>?> TranslateWithGeminiFallbackAsync(
        List<string> cidCodes,
        List<string> descriptiveTerms,
        CancellationToken ct)
    {
        var geminiKey = _config.Value?.GeminiApiKey?.Trim();
        if (string.IsNullOrEmpty(geminiKey) || geminiKey.Contains("YOUR_"))
            return null;

        try
        {
            var geminiBaseUrl = !string.IsNullOrWhiteSpace(_config.Value?.GeminiApiBaseUrl)
                ? _config.Value!.GeminiApiBaseUrl!.Trim()
                : "https://generativelanguage.googleapis.com/v1beta/openai";

            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", geminiKey);
            client.Timeout = TimeSpan.FromSeconds(8);

            var termsJoined = string.Join("\n", descriptiveTerms.Select((t, i) => $"{i + 1}. {t}"));
            var prompt = $@"Translate these Portuguese medical terms to English MeSH-compatible terms for PubMed search.
Return ONLY a JSON array of English terms. Keep terms concise (2-4 words max).

Portuguese terms:
{termsJoined}";

            var requestBody = new
            {
                model = "gemini-2.5-flash",
                messages = new object[]
                {
                    new { role = "user", content = prompt }
                },
                max_tokens = 200,
                temperature = 0.0
            };

            var jsonBody = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
            });

            using var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{geminiBaseUrl}/chat/completions", content, ct);

            if (!response.IsSuccessStatusCode) return null;

            var responseJson = await response.Content.ReadAsStringAsync(ct);
            using var responseDoc = JsonDocument.Parse(responseJson);
            var gptContent = responseDoc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "[]";

            gptContent = gptContent.Trim();
            if (gptContent.StartsWith("```json")) gptContent = gptContent[7..];
            if (gptContent.StartsWith("```")) gptContent = gptContent[3..];
            if (gptContent.EndsWith("```")) gptContent = gptContent[..^3];
            gptContent = gptContent.Trim();

            var translated = JsonSerializer.Deserialize<List<string>>(gptContent);
            if (translated == null || translated.Count == 0) return null;

            var result = new List<string>(cidCodes);
            result.AddRange(translated.Where(t => !string.IsNullOrWhiteSpace(t)));
            _logger.LogInformation("[ClinicalEvidence] Tradução Gemini OK: {Count} termos", result.Count);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[ClinicalEvidence] Fallback Gemini para tradução falhou.");
            return null;
        }
    }

    /// <summary>
    /// Fallback estático quando LLM está indisponível.
    /// Usa CID codes como MeSH terms (PubMed aceita H66[MeSH Terms]) e
    /// tenta tradução básica removendo preposições/artigos PT.
    /// </summary>
    private static List<string> FallbackStaticTranslation(List<string> cidCodes, List<string> descriptiveTerms)
    {
        var result = new List<string>(cidCodes);
        // CID codes sozinhos já funcionam razoavelmente no PubMed
        // Para termos descritivos, usar como está (PubMed tem algum matching cross-language via MeSH)
        // Melhor que nada — pelo menos os CID codes vão trazer resultados
        foreach (var term in descriptiveTerms)
        {
            // Se o termo contém um CID code embutido (ex: "H66 - Otite média"), extrair o código
            var cidMatch = System.Text.RegularExpressions.Regex.Match(term, @"\b([A-Z]\d{2}(?:\.\d+)?)\b");
            if (cidMatch.Success)
                result.Add(cidMatch.Groups[1].Value);
        }
        return result.Count > 0 ? result : descriptiveTerms;
    }

    // ── Cache helpers ──

    private string BuildCacheKey(List<string> terms)
    {
        var normalized = string.Join("|", terms.Select(t => t.ToLowerInvariant().Trim()).OrderBy(t => t));
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normalized)))[..16];
        return CacheKeyPrefix + hash;
    }

    private async Task<IReadOnlyList<EvidenceItemDto>?> TryGetCacheAsync(string key)
    {
        try
        {
            var db = _redis.GetDatabase();
            var cached = await db.StringGetAsync(key);
            if (cached.IsNullOrEmpty) return null;
            return JsonSerializer.Deserialize<List<EvidenceItemDto>>(cached!, JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "[ClinicalEvidence] Cache read failed for {Key}", key);
            return null;
        }
    }

    private async Task SetCacheAsync(string key, IReadOnlyList<EvidenceItemDto> items, TimeSpan expiry)
    {
        try
        {
            var db = _redis.GetDatabase();
            var json = JsonSerializer.Serialize(items, JsonOptions);
            await db.StringSetAsync(key, json, expiry);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "[ClinicalEvidence] Cache write failed for {Key}", key);
        }
    }

    // ── Helpers ──

    private static EvidenceItemDto BuildFallbackDto(PubMedArticle a) => new(
        Title: a.Title,
        Abstract: TruncateAbstract(a.Abstract, 300),
        Source: $"{a.Journal} ({a.Year})",
        TranslatedAbstract: null,
        RelevantExcerpts: null,
        ClinicalRelevance: null,
        Provider: EvidenceProvider.PubMed,
        Url: a.PubMedUrl,
        ConexaoComPaciente: null,
        NivelEvidencia: a.EvidenceLevel,
        MotivoSelecao: null
    );

    public async Task<int> ClearCacheAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var server = _redis.GetServers().FirstOrDefault();
            if (server == null) return 0;

            var db = _redis.GetDatabase();
            var keys = server.Keys(pattern: CacheKeyPrefix + "*").ToArray();
            if (keys.Length == 0) return 0;

            foreach (var key in keys)
                await db.KeyDeleteAsync(key);

            _logger.LogWarning("[ClinicalEvidence] Cache limpo: {Count} chaves removidas", keys.Length);
            return keys.Length;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ClinicalEvidence] Erro ao limpar cache");
            return 0;
        }
    }

    private static string TruncateAbstract(string text, int maxLen)
    {
        if (string.IsNullOrEmpty(text)) return "";
        return text.Length <= maxLen ? text : text[..maxLen] + "…";
    }

    /// <summary>Resultado do GPT-4o para cada artigo analisado.</summary>
    private sealed class GptEvidenceResult
    {
        public string? Pmid { get; set; }
        public string? Resumo { get; set; }
        public string? Relevancia { get; set; }
        public string? Motivo { get; set; }
    }
}
