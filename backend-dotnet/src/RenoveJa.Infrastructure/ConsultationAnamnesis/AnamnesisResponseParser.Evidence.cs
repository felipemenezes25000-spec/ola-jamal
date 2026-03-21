using System.Linq;
using System.Text.Json;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>Termos de busca e contexto textual para evidências / prompts auxiliares.</summary>
internal static partial class AnamnesisResponseParser
{
    internal static List<string> ExtractSearchTerms(JsonElement root)
    {
        var terms = new List<string>();

        // Extrair CIDs e descrições do diagnóstico diferencial (fonte principal de termos de busca)
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
                    // Também extrair descrição do CID para busca textual
                    var ddDescPart = ddCidStr.Contains('—') ? ddCidStr.Split('—', 2)[1].Trim()
                        : ddCidStr.Contains('-') ? ddCidStr.Split('-', 2)[1].Trim() : "";
                    if (ddDescPart.Length > 10 && terms.Count < 6)
                        terms.Add(ddDescPart[..Math.Min(60, ddDescPart.Length)]);
                }
                // Extrair nome da hipótese (ex: "Toxoplasmose adquirida")
                if (dd.TryGetProperty("hipotese", out var ddHip) && terms.Count < 6)
                {
                    var hipStr = ddHip.GetString()?.Trim() ?? "";
                    if (hipStr.Length > 5)
                        terms.Add(hipStr[..Math.Min(60, hipStr.Length)]);
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
        if (root.TryGetProperty("diagnostico_diferencial", out var ddEl) && ddEl.ValueKind == JsonValueKind.Array)
        {
            var dds = new List<string>();
            foreach (var dd in ddEl.EnumerateArray())
            {
                var hipotese = dd.TryGetProperty("hipotese", out var h) ? h.GetString() ?? "" : "";
                var cid = dd.TryGetProperty("cid", out var c) ? c.GetString() ?? "" : "";
                if (!string.IsNullOrEmpty(hipotese))
                    dds.Add(!string.IsNullOrEmpty(cid) ? $"{hipotese} ({cid})" : hipotese);
            }
            if (dds.Count > 0)
                parts.Add($"Diagnóstico diferencial: {string.Join("; ", dds)}");
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
