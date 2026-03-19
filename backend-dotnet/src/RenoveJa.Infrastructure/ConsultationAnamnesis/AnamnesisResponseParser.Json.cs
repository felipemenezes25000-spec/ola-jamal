using System.Text.Json;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>Cópia de propriedades JSON e limpeza da resposta bruta do modelo.</summary>
internal static partial class AnamnesisResponseParser
{
    internal static void CopyIfExists(JsonElement root, Dictionary<string, object> dict, string key)
    {
        if (root.TryGetProperty(key, out var el))
            dict[key] = el.GetRawText();
    }

    internal static void CopyArrayIfExists(JsonElement root, Dictionary<string, object> dict, string key)
    {
        if (root.TryGetProperty(key, out var el) && el.ValueKind == JsonValueKind.Array)
            dict[key] = el.GetRawText();
    }

    internal static string GetStr(JsonElement el, string prop)
    {
        if (el.TryGetProperty(prop, out var v))
        {
            return v.ValueKind == JsonValueKind.String
                ? (v.GetString() ?? "")
                : v.GetRawText();
        }
        return "";
    }

    internal static string CleanJsonResponse(string raw)
    {
        var s = raw.Trim();
        if (s.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            s = s["```json".Length..].TrimStart();
        else if (s.StartsWith("```"))
            s = s["```".Length..].TrimStart();
        if (s.EndsWith("```"))
            s = s[..^3].TrimEnd();
        s = s.Trim();
        var start = s.IndexOf('{');
        if (start > 0)
        {
            var depth = 0;
            var inString = false;
            var escape = false;
            var end = -1;
            for (var i = start; i < s.Length; i++)
            {
                var c = s[i];
                if (escape) { escape = false; continue; }
                if (c == '\\' && inString) { escape = true; continue; }
                if (inString)
                {
                    if (c == '"') inString = false;
                    continue;
                }
                if (c == '"') { inString = true; continue; }
                if (c == '{') depth++;
                else if (c == '}')
                {
                    depth--;
                    if (depth == 0) { end = i; break; }
                }
            }
            if (end > start)
                s = s[start..(end + 1)];
        }
        return s.Trim();
    }
}
