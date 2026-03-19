using System.Linq;
using System.Text.Json;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>Termos de busca e contexto textual para evidências / prompts auxiliares.</summary>
internal static partial class AnamnesisResponseParser
{
    internal static List<string> ExtractSearchTerms(JsonElement root)
    {
        var terms = new List<string>();

        if (root.TryGetProperty("cid_sugerido", out var cidEl))
        {
            var cidStr = cidEl.GetString() ?? "";
            var match = CidCodeRegex.Match(cidStr);
            if (match.Success)
                terms.Add(match.Groups[1].Value);
            var descPart = cidStr.Contains('-') ? cidStr.Split('-', 2)[1].Trim() : "";
            if (descPart.Length > 10)
                terms.Add(descPart[..Math.Min(60, descPart.Length)]);
        }

        if (root.TryGetProperty("diagnostico_diferencial", out var ddEl) && ddEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var dd in ddEl.EnumerateArray())
            {
                if (dd.TryGetProperty("cid", out var ddCid))
                {
                    var ddCidStr = ddCid.GetString() ?? "";
                    var ddMatch = CidCodeRegex.Match(ddCidStr);
                    if (ddMatch.Success && terms.Count < 5)
                        terms.Add(ddMatch.Groups[1].Value);
                }
            }
        }

        if (root.TryGetProperty("anamnesis", out var anaEl) && anaEl.ValueKind == JsonValueKind.Object)
        {
            if (anaEl.TryGetProperty("queixa_principal", out var qpEl))
            {
                var qp = (qpEl.ValueKind == JsonValueKind.String ? qpEl.GetString() : qpEl.GetRawText())?.Trim('"').Trim() ?? "";
                if (qp.Length > 20)
                    terms.Add(qp[..Math.Min(80, qp.Length)]);
            }
            if (anaEl.TryGetProperty("sintomas", out var sintEl))
            {
                var sint = sintEl.ValueKind == JsonValueKind.String
                    ? sintEl.GetString()?.Trim('"').Trim()
                    : sintEl.ValueKind == JsonValueKind.Array
                        ? string.Join(" ", sintEl.EnumerateArray().Select(e => e.GetString() ?? ""))
                        : "";
                if (!string.IsNullOrWhiteSpace(sint) && sint.Length > 3)
                    terms.Add(sint[..Math.Min(60, sint.Length)]);
            }
        }

        return terms.Distinct().Where(s => !string.IsNullOrWhiteSpace(s)).ToList();
    }

    internal static string BuildClinicalContextForPrompt(JsonElement root)
    {
        var parts = new List<string>();
        if (root.TryGetProperty("cid_sugerido", out var cidEl))
        {
            var cid = cidEl.GetString()?.Trim() ?? "";
            if (!string.IsNullOrEmpty(cid))
                parts.Add($"Hipótese diagnóstica (CID): {cid}");
        }
        if (root.TryGetProperty("diagnostico_diferencial", out var ddEl) && ddEl.ValueKind == JsonValueKind.Array)
        {
            var dds = new List<string>();
            foreach (var dd in ddEl.EnumerateArray())
            {
                if (dd.TryGetProperty("hipotese", out var h))
                    dds.Add(h.GetString() ?? "");
            }
            if (dds.Count > 0)
                parts.Add($"Diagnósticos diferenciais: {string.Join("; ", dds)}");
        }
        if (root.TryGetProperty("anamnesis", out var anaEl2) && anaEl2.ValueKind == JsonValueKind.Object)
        {
            if (anaEl2.TryGetProperty("queixa_principal", out var qpEl))
            {
                var qp = (qpEl.ValueKind == JsonValueKind.String ? qpEl.GetString() : qpEl.GetRawText())?.Trim('"').Trim() ?? "";
                if (!string.IsNullOrEmpty(qp))
                    parts.Add($"Queixa principal: {qp}");
            }
            if (anaEl2.TryGetProperty("sintomas", out var sintEl))
            {
                var sint = sintEl.ValueKind == JsonValueKind.String
                    ? sintEl.GetString()?.Trim('"').Trim()
                    : sintEl.ValueKind == JsonValueKind.Array
                        ? string.Join(", ", sintEl.EnumerateArray().Select(e => e.GetString() ?? ""))
                        : "";
                if (!string.IsNullOrWhiteSpace(sint))
                    parts.Add($"Sintomas: {sint}");
            }
        }
        return parts.Count > 0 ? string.Join("\n", parts) : "Contexto clínico não especificado.";
    }
}
