using System.Net.Http.Headers;
using System.Text.Json;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;

namespace RenoveJa.Infrastructure.ClinicalEvidence;

/// <summary>
/// Cliente HTTP para PubMed E-utilities (ESearch + EFetch).
/// Busca artigos priorizando Cochrane Reviews, meta-análises e RCTs.
/// API gratuita: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
/// Rate limit: 3 req/s sem API key, 10 req/s com API key.
/// </summary>
public sealed class PubMedClient
{
    private const string ESearchUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
    private const string EFetchUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
    private const string UserAgent = "RenoveJaPlus/1.0 (Telemedicine clinical decision support; contact: dev@renovejasaude.com.br)";
    private const int MaxResults = 8;

    /// <summary>Throttle requests to stay under PubMed's 3 req/s limit (no API key).</summary>
    private static readonly SemaphoreSlim _throttle = new(2, 2);

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PubMedClient> _logger;

    public PubMedClient(IHttpClientFactory httpClientFactory, ILogger<PubMedClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    /// <summary>
    /// Busca artigos no PubMed priorizando Cochrane, depois meta-análises, depois RCTs.
    /// Retorna até <paramref name="maxResults"/> artigos com título, abstract, journal, PMID, tipo de publicação.
    /// </summary>
    public async Task<List<PubMedArticle>> SearchAsync(
        List<string> searchTerms,
        int maxResults = MaxResults,
        CancellationToken cancellationToken = default)
    {
        if (searchTerms.Count == 0)
            return new List<PubMedArticle>();

        // Tier 1+2 sequencial: Cochrane, depois Meta-análise (evita 429 rate limit — PubMed = 3 req/s sem API key)
        var allIds = new HashSet<string>();
        var articles = new List<PubMedArticle>();

        // Cochrane primeiro (gold standard)
        var cochraneIds = await ESearchAsync(BuildCochraneQuery(searchTerms), 3, cancellationToken);
        if (cochraneIds.Count > 0)
        {
            var cochraneArticles = await EFetchAsync(cochraneIds, cancellationToken);
            foreach (var a in cochraneArticles)
                a.EvidenceLevel = "Revisão Sistemática Cochrane";
            articles.AddRange(cochraneArticles);
            foreach (var id in cochraneIds) allIds.Add(id);
        }

        // Meta-análises (desduplicando com Cochrane)
        if (articles.Count < maxResults)
        {
            var metaResult = await ESearchAsync(BuildMetaAnalysisQuery(searchTerms), 3, cancellationToken);
            var metaIds = metaResult.Where(id => !allIds.Contains(id)).ToList();
            if (metaIds.Count > 0)
            {
                var metaArticles = await EFetchAsync(metaIds.Take(maxResults - articles.Count).ToList(), cancellationToken);
                foreach (var a in metaArticles)
                    a.EvidenceLevel = "Meta-análise";
                articles.AddRange(metaArticles);
                foreach (var id in metaIds) allIds.Add(id);
            }
        }

        // Tier 3: RCTs (só se precisa de mais)
        if (articles.Count < maxResults)
        {
            var rctIds = await ESearchAsync(BuildRctQuery(searchTerms), 3, cancellationToken);
            var newIds = rctIds.Where(id => !allIds.Contains(id)).Take(maxResults - articles.Count).ToList();
            if (newIds.Count > 0)
            {
                var rctArticles = await EFetchAsync(newIds, cancellationToken);
                foreach (var a in rctArticles)
                    a.EvidenceLevel = "Ensaio Clínico Randomizado";
                articles.AddRange(rctArticles);
            }
        }

        // Tier 4: Busca geral (fallback para diagnósticos raros — só se 0 resultados)
        if (articles.Count == 0)
        {
            var generalIds = await ESearchAsync(BuildGeneralQuery(searchTerms), Math.Min(4, maxResults), cancellationToken);
            if (generalIds.Count > 0)
            {
                var generalArticles = await EFetchAsync(generalIds, cancellationToken);
                foreach (var a in generalArticles)
                    a.EvidenceLevel ??= "Estudo Clínico";
                articles.AddRange(generalArticles);
            }
        }

        return articles.Take(maxResults).ToList();
    }

    private async Task<List<string>> ESearchAsync(string query, int retMax, CancellationToken ct)
    {
        await _throttle.WaitAsync(ct);
        try
        {
            var client = CreateClient();
            var url = $"{ESearchUrl}?db=pubmed&retmode=json&retmax={retMax}&sort=relevance&term={Uri.EscapeDataString(query)}";
            _logger.LogDebug("[PubMed ESearch] query={Query} retMax={RetMax}", query, retMax);

            var response = await client.GetAsync(url, ct);

            // Retry once on 429 (Too Many Requests) with 1s backoff
            if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
            {
                _logger.LogWarning("[PubMed ESearch] 429 TooManyRequests — retrying in 1s for query={Query}", query);
                await Task.Delay(1000, ct);
                response = await client.GetAsync(url, ct);
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[PubMed ESearch] HTTP {StatusCode} para query={Query}", response.StatusCode, query);
                return new List<string>();
            }

            var json = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            var result = doc.RootElement.GetProperty("esearchresult");

            if (result.TryGetProperty("idlist", out var idList) && idList.ValueKind == JsonValueKind.Array)
            {
                var ids = idList.EnumerateArray()
                    .Select(e => e.GetString() ?? "")
                    .Where(id => !string.IsNullOrEmpty(id))
                    .ToList();
                _logger.LogDebug("[PubMed ESearch] Encontrados {Count} resultados para query={Query}", ids.Count, query);
                return ids;
            }

            return new List<string>();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[PubMed ESearch] Erro na busca: query={Query}", query);
            return new List<string>();
        }
        finally
        {
            _throttle.Release();
        }
    }

    private async Task<List<PubMedArticle>> EFetchAsync(List<string> pmids, CancellationToken ct)
    {
        if (pmids.Count == 0) return new List<PubMedArticle>();

        await _throttle.WaitAsync(ct);
        try
        {
            var client = CreateClient();
            var idsParam = string.Join(",", pmids);
            var url = $"{EFetchUrl}?db=pubmed&retmode=xml&rettype=abstract&id={idsParam}";

            var response = await client.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[PubMed EFetch] HTTP {StatusCode} para ids={Ids}", response.StatusCode, idsParam);
                return new List<PubMedArticle>();
            }

            var xml = await response.Content.ReadAsStringAsync(ct);
            return ParsePubMedXml(xml);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[PubMed EFetch] Erro ao buscar artigos: ids={Ids}", string.Join(",", pmids));
            return new List<PubMedArticle>();
        }
        finally
        {
            _throttle.Release();
        }
    }

    private List<PubMedArticle> ParsePubMedXml(string xml)
    {
        var articles = new List<PubMedArticle>();
        try
        {
            var doc = XDocument.Parse(xml);
            var pubmedArticles = doc.Descendants("PubmedArticle");

            foreach (var pa in pubmedArticles)
            {
                var medlineCitation = pa.Element("MedlineCitation");
                if (medlineCitation == null) continue;

                var pmid = medlineCitation.Element("PMID")?.Value ?? "";
                var article = medlineCitation.Element("Article");
                if (article == null) continue;

                var title = article.Element("ArticleTitle")?.Value?.Trim() ?? "";
                var abstractEl = article.Element("Abstract");
                var abstractText = "";
                if (abstractEl != null)
                {
                    abstractText = string.Join(" ",
                        abstractEl.Elements("AbstractText").Select(e => e.Value?.Trim() ?? ""));
                }

                var journal = article.Element("Journal")?.Element("Title")?.Value?.Trim() ?? "";
                var journalAbbrev = article.Element("Journal")
                    ?.Element("ISOAbbreviation")?.Value?.Trim() ?? journal;

                // Ano de publicação
                var pubDate = article.Element("Journal")?.Element("JournalIssue")?.Element("PubDate");
                var year = pubDate?.Element("Year")?.Value ?? "";
                if (string.IsNullOrEmpty(year))
                {
                    var medlineDate = pubDate?.Element("MedlineDate")?.Value ?? "";
                    if (medlineDate.Length >= 4)
                        year = medlineDate[..4];
                }

                // Tipo de publicação
                var pubTypes = article.Element("PublicationTypeList")?
                    .Elements("PublicationType")
                    .Select(e => e.Value?.Trim() ?? "")
                    .Where(s => !string.IsNullOrEmpty(s))
                    .ToList() ?? new List<string>();

                // DOI
                var doi = article.Element("ELocationID")?
                    .Attributes().Any(a => a.Value == "doi") == true
                    ? article.Element("ELocationID")?.Value ?? ""
                    : "";
                if (string.IsNullOrEmpty(doi))
                {
                    doi = pa.Element("PubmedData")?.Element("ArticleIdList")?
                        .Elements("ArticleId")
                        .FirstOrDefault(e => e.Attribute("IdType")?.Value == "doi")?.Value ?? "";
                }

                articles.Add(new PubMedArticle
                {
                    Pmid = pmid,
                    Title = title,
                    Abstract = abstractText,
                    Journal = journalAbbrev,
                    JournalFull = journal,
                    Year = year,
                    PublicationTypes = pubTypes,
                    Doi = doi,
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[PubMed] Erro ao parsear XML");
        }
        return articles;
    }

    private HttpClient CreateClient()
    {
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.UserAgent.ParseAdd(UserAgent);
        client.Timeout = TimeSpan.FromSeconds(10);
        return client;
    }

    // ── Query builders ──
    // Termos devem chegar em inglês (traduzidos por ClinicalEvidenceService).
    // CID codes (ex: H66) são usados como MeSH Terms para matching preciso.

    /// <summary>Formata um termo para PubMed: CID codes viram MeSH query, texto vira busca livre.</summary>
    private static string FormatTerm(string term)
    {
        // CID code → MeSH term lookup (PubMed automatic term mapping handles ICD→MeSH)
        if (System.Text.RegularExpressions.Regex.IsMatch(term, @"^[A-Z]\d{2}(\.\d+)?$"))
            return $"{term}[MeSH Terms]";
        return $"({term})";
    }

    private static string BuildCochraneQuery(List<string> terms)
    {
        var mainTerm = FormatTerm(terms.First());
        return $"\"Cochrane Database Syst Rev\"[Journal] AND {mainTerm} AND (\"last 5 years\"[PDat])";
    }

    private static string BuildMetaAnalysisQuery(List<string> terms)
    {
        var mainTerm = FormatTerm(terms.First());
        var extra = terms.Count > 1 ? $" AND {FormatTerm(terms[1])}" : "";
        return $"{mainTerm}{extra} AND (meta-analysis[pt]) AND (\"last 5 years\"[PDat])";
    }

    private static string BuildRctQuery(List<string> terms)
    {
        var mainTerm = FormatTerm(terms.First());
        var extra = terms.Count > 1 ? $" AND {FormatTerm(terms[1])}" : "";
        return $"{mainTerm}{extra} AND (randomized controlled trial[pt]) AND (\"last 5 years\"[PDat])";
    }

    private static string BuildGeneralQuery(List<string> terms)
    {
        var combined = string.Join(" AND ", terms.Take(3).Select(t => FormatTerm(t)));
        return $"{combined} AND (\"last 5 years\"[PDat]) AND (hasabstract)";
    }
}

/// <summary>Artigo do PubMed com metadados parseados do XML.</summary>
public sealed class PubMedArticle
{
    public string Pmid { get; set; } = "";
    public string Title { get; set; } = "";
    public string Abstract { get; set; } = "";
    public string Journal { get; set; } = "";
    public string JournalFull { get; set; } = "";
    public string Year { get; set; } = "";
    public List<string> PublicationTypes { get; set; } = new();
    public string Doi { get; set; } = "";
    public string? EvidenceLevel { get; set; }

    public string PubMedUrl => $"https://pubmed.ncbi.nlm.nih.gov/{Pmid}/";
}
