using System.Linq;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>Coerência de CID-10 com diagnóstico diferencial e bloqueios por transcript.</summary>
internal static partial class AnamnesisResponseParser
{
    /// <summary>
    /// Valida coerência: cid_sugerido DEVE estar em diagnostico_diferencial.
    /// REGRA PRINCIPAL: Se diagnostico_diferencial tem itens, SEMPRE usar o primeiro "alta" como cid_sugerido.
    /// A IA frequentemente erra em cid_sugerido (ex: F10.2) mas acerta no diagnostico_diferencial.
    /// </summary>
    internal static string EnsureCidCoherentWithDifferential(JsonElement root, string cidRaw, ILogger? logger = null, string? transcript = null)
    {
        var transcriptLower = transcript?.ToLowerInvariant() ?? "";

        var fromDifferential = GetFallbackCidFromDifferential(root, "", logger);
        if (!string.IsNullOrWhiteSpace(fromDifferential))
        {
            var cidFromAi = ExtractCidCode(cidRaw);
            var cidFromDiff = ExtractCidCode(fromDifferential);
            if (!string.Equals(cidFromAi, cidFromDiff, StringComparison.OrdinalIgnoreCase))
                logger?.LogWarning("[Anamnese] cid_sugerido da IA ({CidAi}) substituído pelo diferencial ({CidDiff}) — IA erra consistentemente.", cidRaw, fromDifferential);
            return fromDifferential;
        }

        if (string.IsNullOrWhiteSpace(cidRaw)) return cidRaw;

        var cidCode = ExtractCidCode(cidRaw);

        var blockedCategories = new (string prefix, string category, string[] requiredKeywords)[]
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

        foreach (var (prefix, category, keywords) in blockedCategories)
        {
            if (!cidCode.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) continue;

            var hasContext = keywords.Any(kw => transcriptLower.Contains(kw));
            var negaPattern = keywords.Any(kw => transcriptLower.Contains($"nega {kw}") || transcriptLower.Contains($"não {kw}") || transcriptLower.Contains($"nao {kw}"));
            if (negaPattern) hasContext = false;

            if (!hasContext)
            {
                logger?.LogWarning("[Anamnese] BLOQUEADO CID {Prefix}.x alucinado: {CidRaw} — transcript não menciona {Category}.", prefix, cidRaw, category);
                return GetFallbackCidFromDifferential(root, prefix, logger);
            }
        }

        var raciocinio = root.TryGetProperty("raciocinio_clinico", out var racEl) ? racEl.GetString()?.ToLowerInvariant() ?? "" : "";
        if (!string.IsNullOrWhiteSpace(raciocinio))
        {
            var racMentionsEhlers = raciocinio.Contains("ehlers") || raciocinio.Contains("hipermobilidade") || raciocinio.Contains("hiperlaxidão");
            var cidIsNotMusculoskeletal = cidCode.StartsWith("F", StringComparison.OrdinalIgnoreCase) ||
                                          cidCode.StartsWith("A", StringComparison.OrdinalIgnoreCase) ||
                                          cidCode.StartsWith("B", StringComparison.OrdinalIgnoreCase);
            if (racMentionsEhlers && cidIsNotMusculoskeletal)
            {
                logger?.LogWarning("[Anamnese] CID {CidRaw} incoerente com raciocínio clínico que menciona hipermobilidade/Ehlers-Danlos. Buscando alternativa.", cidRaw);
                var fallback = GetFallbackCidFromDifferential(root, "", logger);
                if (!string.IsNullOrWhiteSpace(fallback)) return fallback;
            }
        }

        var differentialCids = GetCidsFromDiagnosticoDiferencial(root);
        if (differentialCids.Count == 0) return cidRaw;

        var cidInDifferential = differentialCids.Any(dd =>
            string.Equals(ExtractCidCode(dd.cid), cidCode, StringComparison.OrdinalIgnoreCase));

        if (cidInDifferential) return cidRaw;

        var fallbackCid = GetFallbackCidFromDifferential(root, "", logger);
        logger?.LogWarning("[Anamnese] CID incoerente corrigido: original={Original} → replacement={Replacement}", cidRaw, fallbackCid);
        return !string.IsNullOrWhiteSpace(fallbackCid) ? fallbackCid : cidRaw;
    }

    /// <summary>Busca CID alternativo do diagnóstico diferencial, ignorando CIDs com prefix bloqueado.</summary>
    private static string GetFallbackCidFromDifferential(JsonElement root, string blockedPrefix, ILogger? logger)
    {
        var differentialCids = GetCidsFromDiagnosticoDiferencial(root)
            .Where(dd => string.IsNullOrEmpty(blockedPrefix) ||
                         !ExtractCidCode(dd.cid).StartsWith(blockedPrefix, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (differentialCids.Count == 0)
        {
            logger?.LogWarning("[Anamnese] Sem CID alternativo no diferencial — retornando vazio.");
            return "";
        }

        var ordemProb = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase) { ["alta"] = 3, ["media"] = 2, ["baixa"] = 1 };
        var melhor = differentialCids
            .OrderByDescending(dd => dd.probabilidadePercentual)
            .ThenByDescending(dd => ordemProb.TryGetValue(dd.probabilidade, out var o) ? o : 0)
            .First();
        var result = melhor.cid;
        logger?.LogDebug("[Anamnese] CID do diferencial: {Replacement}", result);
        return result;
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
