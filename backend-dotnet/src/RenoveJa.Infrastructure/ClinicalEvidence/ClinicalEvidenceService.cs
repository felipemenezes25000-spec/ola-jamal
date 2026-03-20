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
    private const string CacheKeyPrefix = "clinical:evidence:";
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

            // Buscar no PubMed (cascata: Cochrane > Meta > RCT > geral)
            _logger.LogInformation("[ClinicalEvidence] Buscando PubMed: termos={Terms}", string.Join(" | ", searchTerms));
            var articles = await _pubMedClient.SearchAsync(searchTerms, 6, cancellationToken);

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

            var requestBody = new
            {
                model = "gpt-4o",
                messages = new object[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userContent }
                },
                max_tokens = 2000,
                temperature = 0.05
            };

            var jsonBody = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
            });

            using var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
            var response = await client.PostAsync("https://api.openai.com/v1/chat/completions", content, ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[ClinicalEvidence] GPT-4o retornou {StatusCode}", response.StatusCode);
                // Fallback: retorna artigos brutos
                return articles.Take(5).Select(a => BuildFallbackDto(a)).ToList();
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
