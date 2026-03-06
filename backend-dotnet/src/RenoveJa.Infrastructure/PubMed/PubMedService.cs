using System.Text.Json;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.DTOs.Consultation;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.PubMed;

/// <summary>
/// Busca artigos no PubMed via E-utilities (esearch + efetch).
/// Limite: 3 req/s sem API key. Retorna título e abstract.
/// </summary>
public class PubMedService : IPubMedService
{
    private const string EutilsBase = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PubMedService> _logger;

    public PubMedService(IHttpClientFactory httpClientFactory, ILogger<PubMedService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<IReadOnlyList<EvidenceItemDto>> SearchAsync(
        IReadOnlyList<string> searchTerms,
        int maxResults = 5,
        CancellationToken cancellationToken = default)
    {
        if (searchTerms == null || searchTerms.Count == 0)
            return Array.Empty<EvidenceItemDto>();

        var query = string.Join(" ", searchTerms.Where(s => !string.IsNullOrWhiteSpace(s)).Take(5));
        if (string.IsNullOrWhiteSpace(query))
            return Array.Empty<EvidenceItemDto>();

        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(15);

        try
        {
            // 1. esearch - get PMIDs
            var searchUrl = $"{EutilsBase}/esearch.fcgi?db=pubmed&term={Uri.EscapeDataString(query)}&retmax={maxResults}&retmode=json";
            var searchResp = await client.GetAsync(searchUrl, cancellationToken);
            if (!searchResp.IsSuccessStatusCode)
            {
                _logger.LogWarning("PubMed esearch failed: {StatusCode}", searchResp.StatusCode);
                return Array.Empty<EvidenceItemDto>();
            }

            var searchJson = await searchResp.Content.ReadAsStringAsync(cancellationToken);
            var pmids = ParsePmidsFromSearch(searchJson);
            if (pmids.Count == 0)
                return Array.Empty<EvidenceItemDto>();

            await Task.Delay(400, cancellationToken); // rate limit ~3 req/s

            // 2. efetch - get abstracts (XML)
            var ids = string.Join(",", pmids);
            var fetchUrl = $"{EutilsBase}/efetch.fcgi?db=pubmed&id={ids}&retmode=xml";
            var fetchResp = await client.GetAsync(fetchUrl, cancellationToken);
            if (!fetchResp.IsSuccessStatusCode)
            {
                _logger.LogWarning("PubMed efetch failed: {StatusCode}", fetchResp.StatusCode);
                return Array.Empty<EvidenceItemDto>();
            }

            var xml = await fetchResp.Content.ReadAsStringAsync(cancellationToken);
            return ParseArticlesFromXml(xml);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "PubMed search failed for query: {Query}", query);
            return Array.Empty<EvidenceItemDto>();
        }
    }

    private static List<string> ParsePmidsFromSearch(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("esearchresult", out var result) &&
                result.TryGetProperty("idlist", out var idlist))
            {
                var list = new List<string>();
                foreach (var id in idlist.EnumerateArray())
                {
                    var s = id.GetString();
                    if (!string.IsNullOrEmpty(s))
                        list.Add(s);
                }
                return list;
            }
        }
        catch { /* ignore */ }
        return new List<string>();
    }

    private static IReadOnlyList<EvidenceItemDto> ParseArticlesFromXml(string xml)
    {
        var items = new List<EvidenceItemDto>();
        try
        {
            var doc = XDocument.Parse(xml);
            var articles = doc.Descendants().Where(e => e.Name.LocalName == "PubmedArticle").ToList();

            foreach (var article in articles)
            {
                var title = article.Descendants().FirstOrDefault(e => e.Name.LocalName == "ArticleTitle")?.Value?.Trim() ?? "";
                var abstractTexts = article.Descendants().Where(e => e.Name.LocalName == "AbstractText").Select(e => e.Value?.Trim()).Where(s => !string.IsNullOrEmpty(s));
                var abstractStr = string.Join(" ", abstractTexts).Trim();
                if (string.IsNullOrEmpty(abstractStr))
                    abstractStr = "(Resumo não disponível)";

                var pmid = article.Descendants().FirstOrDefault(e => e.Name.LocalName == "PMID")?.Value ?? "";
                var source = string.IsNullOrEmpty(pmid) ? "PubMed" : $"PubMed PMID:{pmid}";

                items.Add(new EvidenceItemDto(title, abstractStr, source, null));
            }
        }
        catch (Exception)
        {
            // ignore parse errors
        }
        return items;
    }
}
