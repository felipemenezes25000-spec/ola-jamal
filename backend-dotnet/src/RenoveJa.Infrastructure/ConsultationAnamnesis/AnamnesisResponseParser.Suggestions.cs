using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>Sugestões ao médico, filtro de vaguidão e detecção de contexto clínico.</summary>
internal static partial class AnamnesisResponseParser
{
    internal static bool HasClinicalContext(JsonElement root)
    {
        if (root.TryGetProperty("cid_sugerido", out var cidCheck) && !string.IsNullOrWhiteSpace(cidCheck.GetString()))
            return true;
        if (root.TryGetProperty("anamnesis", out var anaCheck) && anaCheck.ValueKind == JsonValueKind.Object
            && anaCheck.TryGetProperty("queixa_principal", out var qpAna) && !string.IsNullOrWhiteSpace(qpAna.GetString()))
            return true;
        return false;
    }

    internal static List<string> ExtractSuggestions(JsonElement root)
    {
        var suggestions = new List<string>();
        if (root.TryGetProperty("suggestions", out var sugEl) && sugEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in sugEl.EnumerateArray())
            {
                var str = item.ValueKind == JsonValueKind.String ? item.GetString() : item.GetRawText();
                if (!string.IsNullOrWhiteSpace(str))
                    suggestions.Add(str.Trim('"').Trim());
            }
        }

        if (root.TryGetProperty("alertas_vermelhos", out var alertsEl) && alertsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in alertsEl.EnumerateArray())
            {
                var str = item.ValueKind == JsonValueKind.String ? item.GetString() : item.GetRawText();
                if (!string.IsNullOrWhiteSpace(str))
                    suggestions.Insert(0, $"🚨 {str.Trim('"').Trim()}");
            }
        }

        var hasClinicalContext = HasClinicalContext(root);
        return FilterSuggestionsForAssertiveness(suggestions, hasClinicalContext);
    }

    /// <summary>
    /// Remove sugestões vagas ou sem sentido: só mantém frases que citam algo concreto
    /// (medicamento com dose, exame nomeado, hipótese diagnóstica, orientação específica).
    /// </summary>
    internal static List<string> FilterSuggestionsForAssertiveness(List<string> suggestions, bool hasClinicalContext)
    {
        if (suggestions.Count == 0) return suggestions;

        var filtered = new List<string>();
        foreach (var s in suggestions)
        {
            if (string.IsNullOrWhiteSpace(s)) continue;
            if (IsVagueOrMeaningless(s, hasClinicalContext)) continue;
            filtered.Add(s);
        }

        if (filtered.Count == 0)
        {
            filtered.Add(hasClinicalContext
                ? "Conduta e exames conforme hipóteses do painel — revisar medicamentos e orientações acima."
                : "Avaliação inicial — aguardando mais dados da anamnese para refinar HD e conduta.");
        }

        return filtered;
    }

    private static bool IsVagueOrMeaningless(string suggestion, bool hasClinicalContext)
    {
        var t = suggestion.Trim();
        if (t.Length < 15) return true;

        var lower = t.ToLowerInvariant();
        if (!hasClinicalContext && lower.Contains("dados iniciais") && lower.Contains("continuar anamnese")) return false;

        var vagueOnly = new[]
        {
            "avaliar necessidade",
            "refinar hipótese diagnóstica",
            "refinar hipótese",
            "solicitar exames complementares",
            "solicitar exames laboratoriais",
            "solicitar exames",
            "avaliação inicial realizada",
            "sugestões completas serão geradas",
            "aguardando mais dados da anamnese para refinar"
        };
        var isOnlyVague = vagueOnly.Any(v => lower.Contains(v)) && !HasConcreteClinicalContent(t);
        if (isOnlyVague) return true;

        if (hasClinicalContext && (lower.Contains("aguardando mais dados") || lower.Contains("aguardando mais dados da anamnese")) && !HasConcreteClinicalContent(t))
            return true;

        return false;
    }

    private static bool HasConcreteClinicalContent(string text)
    {
        if (Regex.IsMatch(text, @"\d+\s*mg|\d+\s*ml|\d+mg")) return true;
        if (Regex.IsMatch(text, @"\d+/\d+\s*h|\d+\s*em\s*\d+\s*horas|de\s*\d+\s*em\s*\d+")) return true;
        if (CidCodeRegex.IsMatch(text)) return true;
        if (Regex.IsMatch(text, @"hemograma|PCR|proteína\s*c[- ]?reativa|creatinina|glicemia|sorologia|raio|ecg|ultrassom|tomografia|tsh|t4", RegexOptions.IgnoreCase)) return true;
        if (Regex.IsMatch(text, @"(paracetamol|dipirona|ibuprofeno|amoxicilina|azitromicina|losartana|omeprazol|comprimido|cp\.?|VO|oral)", RegexOptions.IgnoreCase)) return true;
        if (Regex.IsMatch(text, @"\b(toxoplasmose|mononucleose|gripal|infeccioso|bacteriano|viral|sinusite|otite|amigdalite|pneumonia|bronquite|rinite)\b", RegexOptions.IgnoreCase)) return true;
        return false;
    }
}
