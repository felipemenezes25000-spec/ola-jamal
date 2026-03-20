using System.Text.Json;
using System.Text.RegularExpressions;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// Valida se o CID sugerido e o diagnóstico diferencial estão fundamentados (grounded)
/// no transcript real da consulta. Detecta alucinações da IA.
/// </summary>
public static class CidGroundingValidator
{
    /// <summary>
    /// Gera um relatório de grounding comparando transcript vs anamnese.
    /// </summary>
    public static GroundingReport Validate(string transcript, string? anamnesisJson)
    {
        if (string.IsNullOrWhiteSpace(anamnesisJson))
            return new GroundingReport(
                IsGrounded: false,
                Score: 0,
                CidSugerido: null,
                ConfiancaCid: null,
                Issues: new[] { "Anamnese ainda não gerada." },
                TranscriptSymptoms: Array.Empty<string>(),
                AnamnesisSymptoms: Array.Empty<string>(),
                MatchedSymptoms: Array.Empty<string>(),
                UngroundedSymptoms: Array.Empty<string>(),
                DiagnosticoDiferencialReport: Array.Empty<DiferencialGrounding>());

        var transcriptLower = transcript.ToLowerInvariant();
        var issues = new List<string>();

        JsonElement root;
        try
        {
            using var doc = JsonDocument.Parse(anamnesisJson);
            root = doc.RootElement.Clone();
        }
        catch
        {
            return new GroundingReport(
                IsGrounded: false, Score: 0, CidSugerido: null, ConfiancaCid: null,
                Issues: new[] { "Falha ao parsear JSON da anamnese." },
                TranscriptSymptoms: Array.Empty<string>(),
                AnamnesisSymptoms: Array.Empty<string>(),
                MatchedSymptoms: Array.Empty<string>(),
                UngroundedSymptoms: Array.Empty<string>(),
                DiagnosticoDiferencialReport: Array.Empty<DiferencialGrounding>());
        }

        // 1. Extrair sintomas do transcript (palavras-chave clínicas mencionadas)
        var transcriptSymptoms = ExtractClinicalKeywords(transcriptLower);

        // 2. Extrair sintomas da anamnese
        var anamnesisSymptoms = new List<string>();
        if (root.TryGetProperty("anamnesis", out var ana) && ana.ValueKind == JsonValueKind.Object)
        {
            if (ana.TryGetProperty("sintomas", out var sintomasEl) && sintomasEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var s in sintomasEl.EnumerateArray())
                {
                    var val = s.GetString()?.ToLowerInvariant().Trim();
                    if (!string.IsNullOrWhiteSpace(val))
                        anamnesisSymptoms.Add(val);
                }
            }
        }

        // 3. Verificar match: cada sintoma da anamnese tem base no transcript?
        var matched = new List<string>();
        var ungrounded = new List<string>();
        foreach (var symptom in anamnesisSymptoms)
        {
            var words = symptom.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length > 3)
                .ToArray();

            // Pelo menos 40% das palavras significativas devem estar no transcript
            var found = words.Count(w => transcriptLower.Contains(w));
            var ratio = words.Length > 0 ? (double)found / words.Length : 0;

            if (ratio >= 0.4 || HasSemanticMatch(symptom, transcriptLower))
                matched.Add(symptom);
            else
                ungrounded.Add(symptom);
        }

        // 4. CID sugerido
        var cidSugerido = root.TryGetProperty("cid_sugerido", out var cidEl)
            ? cidEl.GetString()?.Trim() : null;
        var confiancaCid = root.TryGetProperty("confianca_cid", out var confEl)
            ? confEl.GetString()?.Trim() : null;

        // 5. Diagnóstico diferencial grounding
        var diffReport = new List<DiferencialGrounding>();
        if (root.TryGetProperty("diagnostico_diferencial", out var ddEl) && ddEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in ddEl.EnumerateArray())
            {
                var hipotese = item.TryGetProperty("hipotese", out var h) ? h.GetString() ?? "" : "";
                var cid = item.TryGetProperty("cid", out var c) ? c.GetString() ?? "" : "";
                var prob = item.TryGetProperty("probabilidade", out var p) ? p.GetString() ?? "" : "";
                var probPct = item.TryGetProperty("probabilidade_percentual", out var pp) && pp.TryGetInt32(out var pct) ? pct : 0;
                var aFavor = item.TryGetProperty("argumentos_a_favor", out var af) ? af.GetString() ?? "" : "";

                // Verificar se os argumentos a favor realmente estão no transcript
                var aFavorWords = aFavor.ToLowerInvariant()
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                    .Where(w => w.Length > 3)
                    .ToArray();
                var aFavorMatched = aFavorWords.Count(w => transcriptLower.Contains(w));
                var aFavorRatio = aFavorWords.Length > 0 ? (double)aFavorMatched / aFavorWords.Length : 0;

                var isGrounded = aFavorRatio >= 0.3 || HasSemanticMatch(aFavor.ToLowerInvariant(), transcriptLower);

                if (!isGrounded && probPct >= 40)
                    issues.Add($"ALERTA: Hipótese '{hipotese}' ({cid}) com {probPct}% sem base no transcript.");

                diffReport.Add(new DiferencialGrounding(
                    Hipotese: hipotese,
                    Cid: cid,
                    Probabilidade: prob,
                    ProbabilidadePercentual: probPct,
                    ArgumentosAFavorGrounded: isGrounded,
                    GroundingRatio: Math.Round(aFavorRatio * 100, 1)));
            }
        }

        // 6. Verificações específicas
        if (!string.IsNullOrWhiteSpace(cidSugerido))
        {
            var cidCode = Regex.Match(cidSugerido, @"\b([A-Z]\d{2}(?:\.\d+)?)\b").Groups[1].Value;

            // CID de álcool sem menção no transcript
            if (cidCode.StartsWith("F10") && !transcriptLower.Contains("álcool") && !transcriptLower.Contains("alcool")
                && !transcriptLower.Contains("bebida") && !transcriptLower.Contains("cerveja") && !transcriptLower.Contains("etilismo"))
            {
                issues.Add($"CRÍTICO: CID F10.x (álcool) sem menção de álcool no transcript!");
            }

            // Verificar se raciocínio clínico cita algo do transcript
            var raciocinio = root.TryGetProperty("raciocinio_clinico", out var racEl)
                ? racEl.GetString()?.ToLowerInvariant() ?? "" : "";
            if (!string.IsNullOrWhiteSpace(raciocinio))
            {
                var racWords = raciocinio.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                    .Where(w => w.Length > 4).ToArray();
                var racInTranscript = racWords.Count(w => transcriptLower.Contains(w));
                var racRatio = racWords.Length > 0 ? (double)racInTranscript / racWords.Length : 0;
                if (racRatio < 0.2)
                    issues.Add($"ALERTA: Raciocínio clínico pouco fundamentado no transcript (apenas {racRatio * 100:F0}% das palavras).");
            }
        }

        // Confiança alta sem grounding forte
        if (string.Equals(confiancaCid, "alta", StringComparison.OrdinalIgnoreCase))
        {
            if (ungrounded.Count > matched.Count)
                issues.Add("ALERTA: Confiança 'alta' mas maioria dos sintomas sem base no transcript.");

            var highProbUngrounded = diffReport.Where(d => d.ProbabilidadePercentual >= 50 && !d.ArgumentosAFavorGrounded).ToList();
            if (highProbUngrounded.Count > 0)
                issues.Add($"CRÍTICO: Confiança 'alta' mas hipótese principal sem argumentos fundamentados no transcript.");
        }

        // Score geral
        var symptomScore = anamnesisSymptoms.Count > 0
            ? (double)matched.Count / anamnesisSymptoms.Count * 100 : 0;
        var diffScore = diffReport.Count > 0
            ? diffReport.Count(d => d.ArgumentosAFavorGrounded) / (double)diffReport.Count * 100 : 0;
        var overallScore = (symptomScore * 0.4 + diffScore * 0.6);

        return new GroundingReport(
            IsGrounded: overallScore >= 50 && issues.Count(i => i.StartsWith("CRÍTICO")) == 0,
            Score: Math.Round(overallScore, 1),
            CidSugerido: cidSugerido,
            ConfiancaCid: confiancaCid,
            Issues: issues.ToArray(),
            TranscriptSymptoms: transcriptSymptoms.ToArray(),
            AnamnesisSymptoms: anamnesisSymptoms.ToArray(),
            MatchedSymptoms: matched.ToArray(),
            UngroundedSymptoms: ungrounded.ToArray(),
            DiagnosticoDiferencialReport: diffReport.ToArray());
    }

    /// <summary>
    /// Extrai palavras-chave clínicas do transcript (sintomas, anatomia, etc.)
    /// </summary>
    private static List<string> ExtractClinicalKeywords(string text)
    {
        var clinicalTerms = new[]
        {
            "dor", "febre", "tosse", "falta de ar", "dispneia", "náusea", "nausea", "vômito", "vomito",
            "diarreia", "constipação", "cefaleia", "dor de cabeça", "tontura", "vertigem",
            "cansaço", "fadiga", "fraqueza", "inchaço", "edema", "coceira", "prurido",
            "sangramento", "perda de peso", "ganho de peso", "insônia", "ansiedade",
            "depressão", "palpitação", "falta de apetite", "dor no peito", "dor abdominal",
            "dor lombar", "dor nas costas", "dor de garganta", "coriza", "congestão",
            "pressão alta", "hipertensão", "diabetes", "glicose", "colesterol",
            "alergia", "asma", "bronquite", "pneumonia", "infecção", "inflamação",
            "queimação", "azia", "refluxo", "gastrite", "úlcera",
            "cabeça", "pescoço", "peito", "abdômen", "barriga", "costas", "lombar",
            "braço", "perna", "joelho", "ombro", "mão", "pé", "tornozelo",
            "olho", "ouvido", "nariz", "boca", "garganta", "orelha",
            "linfonodo", "gânglio", "nódulo", "bolinha", "caroço",
            "remédio", "medicamento", "antibiótico", "anti-inflamatório",
            "cirurgia", "internação", "exame", "ultrassom",
            "gato", "cachorro", "animal", "viagem", "contato",
            "grávida", "gravidez", "menstruação", "ciclo"
        };

        var found = new List<string>();
        foreach (var term in clinicalTerms)
        {
            if (text.Contains(term))
                found.Add(term);
        }
        return found;
    }

    /// <summary>
    /// Verifica match semântico básico (termos clínicos que podem ser sinônimos coloquiais).
    /// </summary>
    private static bool HasSemanticMatch(string symptom, string transcript)
    {
        var mappings = new Dictionary<string, string[]>
        {
            ["cefaleia"] = new[] { "dor de cabeça", "cabeça dói", "cabeça doendo" },
            ["dispneia"] = new[] { "falta de ar", "não consigo respirar", "dificuldade para respirar" },
            ["odinofagia"] = new[] { "dor de garganta", "garganta dói", "doi para engolir" },
            ["mialgia"] = new[] { "dor muscular", "dor no corpo", "corpo doendo" },
            ["artralgia"] = new[] { "dor na junta", "dor articular", "junta dói" },
            ["linfonodomegalia"] = new[] { "gânglio", "linfonodo", "caroço", "bolinha", "íngua" },
            ["epigastralgia"] = new[] { "dor no estômago", "dor na boca do estômago", "queimação" },
            ["lombalgia"] = new[] { "dor lombar", "dor nas costas", "coluna dói" },
            ["emese"] = new[] { "vômito", "vomito", "vomitando", "enjoo" },
            ["pirexia"] = new[] { "febre", "temperatura alta", "febril" },
            ["edema"] = new[] { "inchaço", "inchado", "inchada" },
            ["prurido"] = new[] { "coceira", "coçando", "coça" },
            ["astenia"] = new[] { "fraqueza", "cansaço", "cansada", "cansado", "sem energia" },
            ["nega febre"] = new[] { "não tenho febre", "sem febre", "febre não" },
            ["nega dispneia"] = new[] { "sem falta de ar", "respiro bem", "respiração normal" },
        };

        foreach (var (clinical, colloquials) in mappings)
        {
            if (!symptom.Contains(clinical)) continue;
            if (colloquials.Any(c => transcript.Contains(c)))
                return true;
        }
        return false;
    }
}

/// <summary>Relatório de grounding: transcript vs anamnese.</summary>
public record GroundingReport(
    bool IsGrounded,
    double Score,
    string? CidSugerido,
    string? ConfiancaCid,
    string[] Issues,
    string[] TranscriptSymptoms,
    string[] AnamnesisSymptoms,
    string[] MatchedSymptoms,
    string[] UngroundedSymptoms,
    DiferencialGrounding[] DiagnosticoDiferencialReport);

/// <summary>Grounding de uma hipótese do diagnóstico diferencial.</summary>
public record DiferencialGrounding(
    string Hipotese,
    string Cid,
    string Probabilidade,
    int ProbabilidadePercentual,
    bool ArgumentosAFavorGrounded,
    double GroundingRatio);
