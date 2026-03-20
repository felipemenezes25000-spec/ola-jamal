using System.Linq;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>Coerência de CID-10 com diagnóstico diferencial e bloqueios por transcript.</summary>
internal static partial class AnamnesisResponseParser
{
    /// <summary>Categorias de CID que requerem evidência explícita no transcript para serem aceitas.</summary>
    private static readonly (string prefix, string category, string[] requiredKeywords)[] BlockedCidCategories = new[]
    {
        ("F10", "álcool/etilismo", new[] { "álcool", "alcool", "bebida", "cerveja", "vinho", "cachaça", "cachaca", "drink", "etilismo", "etilista", "beber", "alcoolismo", "alcoolista" }),
        ("F11", "opioides", new[] { "opioid", "morfina", "heroína", "heroina", "codeína", "codeina", "tramadol", "fentanil" }),
        ("F12", "cannabis", new[] { "cannabis", "maconha", "marijuana", "thc" }),
        ("F13", "sedativos", new[] { "sedativo", "benzodiazep", "diazepam", "clonazepam", "alprazolam" }),
        ("F14", "cocaína", new[] { "cocaína", "cocaina", "crack", "coca" }),
        ("F15", "estimulantes", new[] { "anfetamina", "metanfetamina", "estimulante", "ritalina" }),
        ("F17", "tabaco", new[] { "tabaco", "cigarro", "fumo", "fumante", "nicotina", "tabagismo", "tabagista" }),
        ("F19", "múltiplas drogas", new[] { "droga", "substância", "substancia", "entorpecente" }),
    };

    /// <summary>
    /// Valida coerência: cid_sugerido DEVE estar em diagnostico_diferencial E ter base no transcript.
    /// Fluxo:
    ///   1. Filtra do diferencial todos os CIDs bloqueados (sem evidência no transcript)
    ///   2. Aplica checagem de coerência (Ehlers-Danlos, etc.) no diferencial filtrado
    ///   3. Seleciona o melhor CID do diferencial filtrado (maior probabilidade)
    ///   4. Fallback: se diferencial vazio após filtros, usa cid_sugerido original (se não bloqueado)
    /// </summary>
    internal static string EnsureCidCoherentWithDifferential(JsonElement root, string cidRaw, ILogger? logger = null, string? transcript = null)
    {
        var transcriptLower = transcript?.ToLowerInvariant() ?? "";

        // 1. Obter todos os CIDs do diagnóstico diferencial
        var allDifferentialCids = GetCidsFromDiagnosticoDiferencial(root);

        // 2. Filtrar CIDs bloqueados (substâncias sem evidência no transcript) do diferencial
        var filteredDifferential = FilterBlockedCidsFromList(allDifferentialCids, transcriptLower, logger);

        // 3. Aplicar check de coerência Ehlers-Danlos no diferencial
        var raciocinio = root.TryGetProperty("raciocinio_clinico", out var racEl) ? racEl.GetString()?.ToLowerInvariant() ?? "" : "";
        if (!string.IsNullOrWhiteSpace(raciocinio))
        {
            var racMentionsEhlers = raciocinio.Contains("ehlers") || raciocinio.Contains("hipermobilidade") || raciocinio.Contains("hiperlaxidão");
            if (racMentionsEhlers)
            {
                // Preferir CIDs musculoesqueléticos (M*) quando raciocínio menciona hipermobilidade
                var musculoskeletalCids = filteredDifferential
                    .Where(dd => ExtractCidCode(dd.cid).StartsWith("M", StringComparison.OrdinalIgnoreCase) ||
                                 ExtractCidCode(dd.cid).StartsWith("Q", StringComparison.OrdinalIgnoreCase))
                    .ToList();
                if (musculoskeletalCids.Count > 0)
                {
                    logger?.LogInformation("[Anamnese] Raciocínio menciona hipermobilidade/Ehlers-Danlos — priorizando CIDs M*/Q* do diferencial.");
                    filteredDifferential = musculoskeletalCids;
                }
            }
        }

        // 4. Selecionar o melhor CID do diferencial filtrado
        var bestFromDifferential = GetBestCidFromList(filteredDifferential, logger);

        if (!string.IsNullOrWhiteSpace(bestFromDifferential))
        {
            var cidFromAi = ExtractCidCode(cidRaw);
            var cidFromDiff = ExtractCidCode(bestFromDifferential);
            if (!string.Equals(cidFromAi, cidFromDiff, StringComparison.OrdinalIgnoreCase))
                logger?.LogWarning("[Anamnese] cid_sugerido da IA ({CidAi}) substituído pelo diferencial filtrado ({CidDiff}).", cidRaw, bestFromDifferential);
            return bestFromDifferential;
        }

        // 5. Diferencial vazio após filtros — tentar o cid_sugerido original (se não bloqueado)
        if (string.IsNullOrWhiteSpace(cidRaw)) return cidRaw;

        if (IsCidBlocked(ExtractCidCode(cidRaw), transcriptLower, logger))
        {
            logger?.LogWarning("[Anamnese] cid_sugerido '{CidRaw}' bloqueado e sem alternativa no diferencial — retornando vazio.", cidRaw);
            return "";
        }

        return cidRaw;
    }

    /// <summary>Verifica se um código CID individual é bloqueado (substância sem evidência no transcript).</summary>
    private static bool IsCidBlocked(string cidCode, string transcriptLower, ILogger? logger)
    {
        foreach (var (prefix, category, keywords) in BlockedCidCategories)
        {
            if (!cidCode.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) continue;

            var hasContext = keywords.Any(kw => transcriptLower.Contains(kw));
            var negaPattern = keywords.Any(kw =>
                transcriptLower.Contains($"nega {kw}") ||
                transcriptLower.Contains($"não {kw}") ||
                transcriptLower.Contains($"nao {kw}"));
            if (negaPattern) hasContext = false;

            if (!hasContext)
            {
                logger?.LogWarning("[Anamnese] BLOQUEADO CID {Prefix}.x alucinado — transcript não menciona {Category}.", prefix, category);
                return true;
            }
        }
        return false;
    }

    /// <summary>Filtra CIDs bloqueados de uma lista do diferencial.</summary>
    private static List<(string cid, string probabilidade, int probabilidadePercentual)> FilterBlockedCidsFromList(
        List<(string cid, string probabilidade, int probabilidadePercentual)> cids,
        string transcriptLower,
        ILogger? logger)
    {
        return cids
            .Where(dd => !IsCidBlocked(ExtractCidCode(dd.cid), transcriptLower, logger))
            .ToList();
    }

    /// <summary>Seleciona o melhor CID de uma lista ordenando por probabilidade.</summary>
    private static string GetBestCidFromList(
        List<(string cid, string probabilidade, int probabilidadePercentual)> cids,
        ILogger? logger)
    {
        if (cids.Count == 0)
        {
            logger?.LogWarning("[Anamnese] Sem CID válido no diferencial após filtros — retornando vazio.");
            return "";
        }

        var ordemProb = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase) { ["alta"] = 3, ["media"] = 2, ["baixa"] = 1 };
        var melhor = cids
            .OrderByDescending(dd => dd.probabilidadePercentual)
            .ThenByDescending(dd => ordemProb.TryGetValue(dd.probabilidade, out var o) ? o : 0)
            .First();
        logger?.LogDebug("[Anamnese] Melhor CID do diferencial filtrado: {Cid} ({Prob}%)", melhor.cid, melhor.probabilidadePercentual);
        return melhor.cid;
    }

    /// <summary>Busca CID alternativo do diagnóstico diferencial, ignorando CIDs com prefix bloqueado (legado).</summary>
    private static string GetFallbackCidFromDifferential(JsonElement root, string blockedPrefix, ILogger? logger)
    {
        var differentialCids = GetCidsFromDiagnosticoDiferencial(root)
            .Where(dd => string.IsNullOrEmpty(blockedPrefix) ||
                         !ExtractCidCode(dd.cid).StartsWith(blockedPrefix, StringComparison.OrdinalIgnoreCase))
            .ToList();

        return GetBestCidFromList(differentialCids, logger);
    }

    private static string ExtractCidCode(string cidStr)
    {
        var m = CidCodeRegex.Match(cidStr ?? "");
        return m.Success ? m.Groups[1].Value.ToUpperInvariant() : (cidStr ?? "").Trim();
    }

    private static List<(string cid, string probabilidade, int probabilidadePercentual)> GetCidsFromDiagnosticoDiferencial(JsonElement root)
    {
        var list = new List<(string, string, int)>();
        if (!root.TryGetProperty("diagnostico_diferencial", out var dd) || dd.ValueKind != JsonValueKind.Array)
        {
            if (!root.TryGetProperty("anamnesis", out var ana) || ana.ValueKind != JsonValueKind.Object
                || !ana.TryGetProperty("diagnostico_diferencial", out dd) || dd.ValueKind != JsonValueKind.Array)
                return list;
        }

        foreach (var item in dd.EnumerateArray())
        {
            var cid = item.TryGetProperty("cid", out var c) ? c.GetString()?.Trim() ?? "" : "";
            var prob = item.TryGetProperty("probabilidade", out var p) ? p.GetString()?.Trim() ?? "" : "";
            var probPct = item.TryGetProperty("probabilidade_percentual", out var pp) && pp.TryGetInt32(out var pct) ? pct : 0;
            if (!string.IsNullOrWhiteSpace(cid))
                list.Add((cid, prob, probPct));
        }
        return list;
    }
}
