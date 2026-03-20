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

                // Verificar se o CID da hipótese é de substância sem evidência no transcript
                var cidCode = Regex.Match(cid, @"\b([A-Z]\d{2}(?:\.\d+)?)\b").Groups[1].Value;
                var isCidBlockedByTranscript = IsSubstanceCidWithoutEvidence(cidCode, transcriptLower);
                if (isCidBlockedByTranscript && probPct >= 20)
                    issues.Add($"CRÍTICO: Hipótese '{hipotese}' ({cid}) usa CID de substância sem menção no transcript!");

                // Verificar se os argumentos a favor realmente estão no transcript
                var aFavorWords = aFavor.ToLowerInvariant()
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                    .Where(w => w.Length > 3)
                    .ToArray();
                var aFavorMatched = aFavorWords.Count(w => transcriptLower.Contains(w));
                var aFavorRatio = aFavorWords.Length > 0 ? (double)aFavorMatched / aFavorWords.Length : 0;

                var isGrounded = !isCidBlockedByTranscript &&
                    (aFavorRatio >= 0.3 || HasSemanticMatch(aFavor.ToLowerInvariant(), transcriptLower));

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

            // CID de substância sem menção no transcript
            if (IsSubstanceCidWithoutEvidence(cidCode, transcriptLower))
                issues.Add($"CRÍTICO: CID {cidCode} (substância) sem menção no transcript!");

            // MELHORIA 1: Validação cruzada CID × sintomas esperados
            var cidMismatch = ValidateCidAgainstExpectedSymptoms(cidCode, transcriptLower);
            if (cidMismatch != null)
                issues.Add(cidMismatch);

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
    /// MELHORIA 1: Valida se o CID sugerido tem sintomas esperados no transcript.
    /// Retorna uma issue string se houver mismatch, null se OK.
    /// </summary>
    private static string? ValidateCidAgainstExpectedSymptoms(string cidCode, string transcriptLower)
    {
        if (string.IsNullOrWhiteSpace(cidCode)) return null;

        // Mapa: prefixo CID → (descrição, keywords que DEVEM aparecer no transcript para esse CID fazer sentido)
        // Pelo menos 1 keyword do grupo deve estar presente
        var cidExpectedSymptoms = new (string prefix, string description, string[][] keywordGroups)[]
        {
            // Endócrino
            ("E04", "bócio/tireoide", new[] { new[] { "tireoide", "tireóide", "bócio", "bocio", "pescoço", "nódulo cervical", "engolir", "tsh" } }),
            ("E05", "hipertireoidismo", new[] { new[] { "tireoide", "tireóide", "taquicardia", "tremor", "suor", "perda de peso", "tsh" } }),
            ("E06", "tireoidite", new[] { new[] { "tireoide", "tireóide", "pescoço", "dor cervical", "tsh" } }),
            ("E10", "diabetes tipo 1", new[] { new[] { "diabetes", "glicose", "açúcar", "sede", "urina", "glicemia", "insulina" } }),
            ("E11", "diabetes tipo 2", new[] { new[] { "diabetes", "glicose", "açúcar", "sede", "urina", "glicemia" } }),
            ("E66", "obesidade", new[] { new[] { "peso", "obeso", "obesidade", "imc", "gordo", "engordou" } }),

            // Transtornos mentais (não substância)
            ("F20", "esquizofrenia", new[] { new[] { "esquizofrenia", "vozes", "alucinação", "delírio", "pensamento", "psicose" } }),
            ("F30", "mania/bipolar", new[] { new[] { "mania", "bipolar", "euforia", "humor", "insônia" } }),
            ("F32", "depressão", new[] { new[] { "depressão", "triste", "tristeza", "humor", "desânimo", "suicid", "choro" } }),
            ("F41", "ansiedade", new[] { new[] { "ansiedade", "ansioso", "nervoso", "pânico", "angústia", "preocupação" } }),

            // Neurológico
            ("G43", "enxaqueca", new[] { new[] { "enxaqueca", "dor de cabeça", "cefaleia", "cabeça", "migranea" } }),
            ("G40", "epilepsia", new[] { new[] { "epilepsia", "convulsão", "crise", "desmaio", "ausência" } }),

            // Cardiovascular
            ("I10", "hipertensão", new[] { new[] { "pressão", "hipertensão", "pressão alta" } }),
            ("I95", "hipotensão", new[] { new[] { "pressão", "hipotensão", "pressão baixa", "tontura", "tonto", "desmaio" } }),
            ("I20", "angina", new[] { new[] { "peito", "dor no peito", "torácica", "angina", "aperto" } }),

            // Respiratório
            ("J00", "resfriado", new[] { new[] { "coriza", "espirro", "nariz", "resfriado", "gripe" } }),
            ("J03", "amigdalite", new[] { new[] { "garganta", "amígdala", "engolir", "odinofagia" } }),
            ("J06", "IVAS", new[] { new[] { "garganta", "coriza", "tosse", "nariz", "resfriado", "gripe" } }),
            ("J18", "pneumonia", new[] { new[] { "tosse", "febre", "falta de ar", "pneumonia", "pulmão" } }),
            ("J45", "asma", new[] { new[] { "asma", "chiado", "falta de ar", "broncoespasmo", "respirar" } }),

            // Gastrointestinal
            ("K21", "refluxo/DRGE", new[] { new[] { "refluxo", "azia", "queimação", "estômago", "esôfago" } }),
            ("K29", "gastrite", new[] { new[] { "gastrite", "estômago", "azia", "queimação", "epigástri" } }),

            // Musculoesquelético
            ("M54", "dorsalgia/lombalgia", new[] { new[] { "costas", "lombar", "coluna", "dor nas costas", "lombalgia" } }),
            ("M25", "dor articular", new[] { new[] { "articulação", "junta", "joelho", "ombro", "dor articular" } }),
            ("M35", "hipermobilidade", new[] { new[] { "hipermobilidade", "flexibilidade", "articulação", "deslocamento", "junta" } }),

            // Tecido conjuntivo / genético
            ("Q79", "Ehlers-Danlos/congênito", new[] { new[] { "pele", "elástica", "flexibilidade", "articulação", "hematoma", "roxo", "equimose" } }),

            // Infecciosas
            ("B58", "toxoplasmose", new[] { new[] { "gato", "linfonodo", "gânglio", "febre", "toxoplasmose" } }),
            ("B27", "mononucleose", new[] { new[] { "garganta", "linfonodo", "gânglio", "febre", "cansaço", "fadiga" } }),

            // Dermatológico
            ("L20", "dermatite atópica", new[] { new[] { "pele", "coceira", "prurido", "eczema", "dermatite" } }),
            ("L50", "urticária", new[] { new[] { "urticária", "coceira", "prurido", "vergão", "alergia", "placa" } }),

            // Urinário
            ("N39", "ITU", new[] { new[] { "urina", "ardência", "disúria", "urgência", "xixi", "bexiga" } }),

            // Anemia
            ("D50", "anemia ferropriva", new[] { new[] { "cansaço", "fraqueza", "palidez", "anemia", "ferro", "tontura" } }),
            ("D64", "anemia NE", new[] { new[] { "cansaço", "fraqueza", "palidez", "anemia", "tontura" } }),
        };

        foreach (var (prefix, description, keywordGroups) in cidExpectedSymptoms)
        {
            if (!cidCode.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) continue;

            // Pelo menos 1 keyword de pelo menos 1 grupo deve estar no transcript
            var anyGroupMatched = keywordGroups.Any(group =>
                group.Any(kw => transcriptLower.Contains(kw)));

            if (!anyGroupMatched)
                return $"CRÍTICO: CID {cidCode} ({description}) sem sintomas esperados no transcript! Nenhuma keyword encontrada.";

            return null; // Matched — OK
        }

        return null; // CID não está no dicionário — sem validação
    }

    /// <summary>
    /// Verifica se um CID é de substância (F10-F19) sem evidência no transcript.
    /// </summary>
    private static bool IsSubstanceCidWithoutEvidence(string cidCode, string transcriptLower)
    {
        if (string.IsNullOrWhiteSpace(cidCode)) return false;

        var substanceMap = new (string prefix, string[] keywords)[]
        {
            ("F10", new[] { "álcool", "alcool", "bebida", "cerveja", "vinho", "cachaça", "etilismo", "etilista", "beber" }),
            ("F11", new[] { "opioid", "morfina", "heroína", "heroina", "codeína", "codeina", "tramadol", "fentanil" }),
            ("F12", new[] { "cannabis", "maconha", "marijuana", "thc" }),
            ("F13", new[] { "sedativo", "benzodiazep", "diazepam", "clonazepam", "alprazolam" }),
            ("F14", new[] { "cocaína", "cocaina", "crack" }),
            ("F15", new[] { "anfetamina", "metanfetamina", "ritalina" }),
            ("F17", new[] { "tabaco", "cigarro", "fumo", "fumante", "nicotina", "tabagismo" }),
            ("F19", new[] { "droga", "substância", "substancia", "entorpecente" }),
        };

        foreach (var (prefix, keywords) in substanceMap)
        {
            if (!cidCode.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) continue;
            var hasEvidence = keywords.Any(kw => transcriptLower.Contains(kw));
            var negated = keywords.Any(kw =>
                transcriptLower.Contains($"nega {kw}") ||
                transcriptLower.Contains($"não {kw}") ||
                transcriptLower.Contains($"nao {kw}"));
            if (negated) hasEvidence = false;
            return !hasEvidence;
        }
        return false;
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
