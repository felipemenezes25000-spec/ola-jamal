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
                IsGrounded: false, Score: 0,
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

        // 4. Diagnóstico diferencial grounding
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

        // 5. Verificar se raciocínio clínico cita algo do transcript
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

        // 6. Validação de campos alucinados (sintomas, medicamentos, antecedentes, argumentos)
        issues.AddRange(ValidateSymptomsAgainstTranscript(root, transcriptLower));
        issues.AddRange(ValidateMedicationsAgainstCid(root, transcriptLower));
        issues.AddRange(ValidateAntecedentsAgainstTranscript(root, transcriptLower));
        issues.AddRange(ValidateDifferentialArguments(root, transcriptLower));

        // Hipótese de alta probabilidade sem grounding forte
        var highProbUngrounded = diffReport.Where(d => d.ProbabilidadePercentual >= 50 && !d.ArgumentosAFavorGrounded).ToList();
        if (highProbUngrounded.Count > 0)
            issues.Add($"CRÍTICO: Hipótese principal sem argumentos fundamentados no transcript.");

        // Score geral
        var symptomScore = anamnesisSymptoms.Count > 0
            ? (double)matched.Count / anamnesisSymptoms.Count * 100 : 0;
        var diffScore = diffReport.Count > 0
            ? diffReport.Count(d => d.ArgumentosAFavorGrounded) / (double)diffReport.Count * 100 : 0;
        var overallScore = (symptomScore * 0.4 + diffScore * 0.6);

        return new GroundingReport(
            IsGrounded: overallScore >= 50 && issues.Count(i => i.StartsWith("CRÍTICO")) == 0,
            Score: Math.Round(overallScore, 1),
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
            // ===== INFECCIOSAS (A/B) =====
            ("A02", "salmonelose", new[] { new[] { "salmonela", "salmonelose", "diarreia", "febre", "intoxicação alimentar", "alimento contaminado" } }),
            ("A04", "infecção intestinal bacteriana", new[] { new[] { "diarreia", "dor abdominal", "febre", "cólica", "intestino", "bactéria" } }),
            ("A08", "infecção intestinal viral", new[] { new[] { "diarreia", "vômito", "vomito", "náusea", "nausea", "rotavírus", "norovírus", "virose" } }),
            ("A09", "gastroenterite infecciosa", new[] { new[] { "diarreia", "vômito", "vomito", "desidratação", "febre", "gastroenterite" } }),
            ("A15", "tuberculose pulmonar", new[] { new[] { "tuberculose", "tosse", "escarro", "hemoptise", "febre", "suor noturno", "emagrecimento" } }),
            ("A16", "tuberculose sem confirmação", new[] { new[] { "tuberculose", "tosse", "escarro", "febre", "suor noturno", "emagrecimento" } }),
            ("A38", "escarlatina", new[] { new[] { "escarlatina", "garganta", "febre", "erupção", "vermelhidão", "língua framboesa" } }),
            ("A49", "infecção bacteriana NE", new[] { new[] { "infecção", "bactéria", "febre", "antibiótico" } }),
            ("A60", "herpes genital", new[] { new[] { "herpes", "genital", "lesão", "bolha", "vesícula", "ardência", "íntima" } }),
            ("A63", "IST/DST outra", new[] { new[] { "doença sexual", "dst", "ist", "relação", "sexual", "corrimento", "verruga" } }),
            ("B00", "herpes simples", new[] { new[] { "herpes", "bolha", "vesícula", "lábio", "ardência", "formigamento" } }),
            ("B01", "varicela/catapora", new[] { new[] { "catapora", "varicela", "bolha", "vesícula", "coceira", "febre" } }),
            ("B02", "herpes-zóster", new[] { new[] { "herpes zóster", "cobreiro", "dor", "vesícula", "queimação", "nervo" } }),
            ("B05", "sarampo", new[] { new[] { "sarampo", "febre", "erupção", "tosse", "manchas", "olho vermelho" } }),
            ("B06", "rubéola", new[] { new[] { "rubéola", "febre", "erupção", "manchas", "gânglio", "linfonodo" } }),
            ("B07", "verruga viral", new[] { new[] { "verruga", "hpv", "papiloma", "lesão", "pele" } }),
            ("B08", "infecção viral cutânea", new[] { new[] { "molusco", "virose", "erupção", "pele", "bolha" } }),
            ("B15", "hepatite A", new[] { new[] { "hepatite", "icterícia", "amarelo", "fígado", "náusea", "nausea" } }),
            ("B16", "hepatite B", new[] { new[] { "hepatite", "icterícia", "fígado", "cansaço", "sexual" } }),
            ("B17", "hepatite C aguda", new[] { new[] { "hepatite", "fígado", "cansaço", "icterícia" } }),
            ("B18", "hepatite crônica", new[] { new[] { "hepatite", "fígado", "crônica", "cansaço", "icterícia" } }),
            ("B19", "hepatite NE", new[] { new[] { "hepatite", "fígado", "icterícia", "cansaço" } }),
            ("B27", "mononucleose", new[] { new[] { "garganta", "linfonodo", "gânglio", "febre", "cansaço", "fadiga" } }),
            ("B34", "infecção viral NE", new[] { new[] { "virose", "vírus", "febre", "mal-estar", "corpo" } }),
            ("B35", "dermatofitose/micose", new[] { new[] { "micose", "fungo", "frieira", "pele", "coceira", "unha" } }),
            ("B36", "micose superficial", new[] { new[] { "micose", "pele", "mancha", "pitiríase", "fungo" } }),
            ("B37", "candidíase", new[] { new[] { "candidíase", "candida", "fungo", "corrimento", "coceira", "sapinho" } }),
            ("B58", "toxoplasmose", new[] { new[] { "gato", "linfonodo", "gânglio", "febre", "toxoplasmose" } }),
            ("B86", "escabiose/sarna", new[] { new[] { "sarna", "escabiose", "coceira", "prurido", "noite", "entre os dedos" } }),

            // ===== NEOPLASIAS (C/D benigno) =====
            ("C34", "câncer de pulmão", new[] { new[] { "câncer", "pulmão", "tosse", "hemoptise", "emagrecimento", "tumor" } }),
            ("C50", "câncer de mama", new[] { new[] { "câncer", "mama", "nódulo", "caroço", "mamografia", "tumor" } }),
            ("C61", "câncer de próstata", new[] { new[] { "câncer", "próstata", "psa", "urina", "tumor" } }),
            ("D17", "lipoma", new[] { new[] { "lipoma", "caroço", "nódulo", "gordura", "bolinha", "mole" } }),
            ("D22", "nevo melanocítico", new[] { new[] { "pinta", "nevo", "sinal", "mancha", "melanoma", "escura" } }),
            ("D23", "tumor benigno de pele", new[] { new[] { "pele", "nódulo", "bolinha", "caroço", "benigno" } }),

            // ===== SANGUE (D50+) =====
            ("D50", "anemia ferropriva", new[] { new[] { "cansaço", "fraqueza", "palidez", "anemia", "ferro", "tontura" } }),
            ("D51", "anemia por deficiência de B12", new[] { new[] { "anemia", "b12", "cansaço", "fraqueza", "formigamento", "palidez" } }),
            ("D52", "anemia por deficiência de folato", new[] { new[] { "anemia", "folato", "ácido fólico", "cansaço", "fraqueza", "palidez" } }),
            ("D56", "talassemia", new[] { new[] { "talassemia", "anemia", "cansaço", "palidez", "hemoglobina" } }),
            ("D57", "doença falciforme", new[] { new[] { "falciforme", "crise", "dor", "anemia", "hemoglobina" } }),
            ("D64", "anemia NE", new[] { new[] { "cansaço", "fraqueza", "palidez", "anemia", "tontura" } }),
            ("D69", "púrpura/sangramento", new[] { new[] { "púrpura", "manchas", "roxo", "sangramento", "plaqueta", "equimose", "hematoma" } }),
            ("D72", "distúrbios de leucócitos", new[] { new[] { "leucócito", "glóbulo branco", "infecção", "hemograma", "leucocitose" } }),
            ("D80", "imunodeficiência", new[] { new[] { "imunidade", "infecção", "recorrente", "imunodeficiência", "defesa" } }),

            // ===== ENDÓCRINO (E) =====
            ("E00", "hipotireoidismo congênito", new[] { new[] { "tireoide", "tireóide", "congênito", "teste do pezinho", "neonatal", "tsh" } }),
            ("E03", "hipotireoidismo", new[] { new[] { "tireoide", "tireóide", "cansaço", "engordou", "frio", "constipação", "tsh", "hipotireoidismo" } }),
            ("E04", "bócio/tireoide", new[] { new[] { "tireoide", "tireóide", "bócio", "bocio", "pescoço", "nódulo cervical", "engolir", "tsh" } }),
            ("E05", "hipertireoidismo", new[] { new[] { "tireoide", "tireóide", "taquicardia", "tremor", "suor", "perda de peso", "tsh" } }),
            ("E06", "tireoidite", new[] { new[] { "tireoide", "tireóide", "pescoço", "dor cervical", "tsh" } }),
            ("E07", "distúrbio tireoidiano outro", new[] { new[] { "tireoide", "tireóide", "tsh", "nódulo", "pescoço" } }),
            ("E10", "diabetes tipo 1", new[] { new[] { "diabetes", "glicose", "açúcar", "sede", "urina", "glicemia", "insulina" } }),
            ("E11", "diabetes tipo 2", new[] { new[] { "diabetes", "glicose", "açúcar", "sede", "urina", "glicemia" } }),
            ("E13", "diabetes NE", new[] { new[] { "diabetes", "glicose", "açúcar", "sede", "urina", "glicemia" } }),
            ("E14", "diabetes NE", new[] { new[] { "diabetes", "glicose", "açúcar", "sede", "urina", "glicemia" } }),
            ("E16", "hipoglicemia", new[] { new[] { "hipoglicemia", "glicose baixa", "açúcar baixo", "tremor", "suor frio", "tontura", "desmaio" } }),
            ("E20", "hipoparatireoidismo", new[] { new[] { "paratireoide", "cálcio", "câimbra", "formigamento", "espasmo" } }),
            ("E21", "hiperparatireoidismo", new[] { new[] { "paratireoide", "cálcio", "pedra no rim", "cálculo", "osso", "fraqueza" } }),
            ("E22", "hiperfunção hipofisária", new[] { new[] { "hipófise", "acromegalia", "prolactina", "crescimento", "hormônio" } }),
            ("E23", "hipofunção hipofisária", new[] { new[] { "hipófise", "cansaço", "hormônio", "tireoide", "cortisol" } }),
            ("E24", "síndrome de Cushing", new[] { new[] { "cushing", "cortisol", "estria", "face", "arredondada", "peso", "pressão" } }),
            ("E25", "distúrbio adrenogenital", new[] { new[] { "adrenal", "suprarrenal", "hormônio", "virilização", "testosterona" } }),
            ("E27", "insuficiência adrenal", new[] { new[] { "adrenal", "suprarrenal", "cansaço", "hipotensão", "cortisol", "addison" } }),
            ("E28", "disfunção ovariana", new[] { new[] { "ovário", "menstruação", "ciclo", "hormônio", "irregularidade", "ovário policístico" } }),
            ("E34", "distúrbio endócrino outro", new[] { new[] { "hormônio", "endócrino", "glândula", "metabolismo" } }),
            ("E55", "deficiência de vitamina D", new[] { new[] { "vitamina d", "osso", "cansaço", "fraqueza", "dor óssea", "cálcio" } }),
            ("E56", "deficiência vitamínica outra", new[] { new[] { "vitamina", "deficiência", "cansaço", "fraqueza", "suplemento" } }),
            ("E61", "deficiência mineral", new[] { new[] { "mineral", "cálcio", "zinco", "magnésio", "deficiência", "câimbra" } }),
            ("E66", "obesidade", new[] { new[] { "peso", "obeso", "obesidade", "imc", "gordo", "engordou" } }),
            ("E78", "dislipidemia/colesterol", new[] { new[] { "colesterol", "triglicérides", "triglicerídeos", "gordura no sangue", "dislipidemia", "ldl", "hdl" } }),

            // ===== TRANSTORNOS MENTAIS (F) =====
            ("F20", "esquizofrenia", new[] { new[] { "esquizofrenia", "vozes", "alucinação", "delírio", "pensamento", "psicose" } }),
            ("F23", "transtorno psicótico agudo", new[] { new[] { "psicose", "alucinação", "delírio", "surto", "vozes", "paranoia" } }),
            ("F25", "transtorno esquizoafetivo", new[] { new[] { "esquizoafetivo", "psicose", "humor", "delírio", "alucinação" } }),
            ("F30", "mania/bipolar", new[] { new[] { "mania", "bipolar", "euforia", "humor", "insônia" } }),
            ("F31", "transtorno bipolar", new[] { new[] { "bipolar", "mania", "depressão", "humor", "euforia", "oscilação" } }),
            ("F32", "depressão", new[] { new[] { "depressão", "triste", "tristeza", "humor", "desânimo", "suicid", "choro" } }),
            ("F33", "depressão recorrente", new[] { new[] { "depressão", "recorrente", "triste", "tristeza", "desânimo", "episódio", "volta" } }),
            ("F34", "distimia/ciclotimia", new[] { new[] { "distimia", "triste", "desânimo", "crônico", "humor", "persistente" } }),
            ("F40", "fobia/ansiedade fóbica", new[] { new[] { "fobia", "medo", "evitar", "pânico", "ansiedade", "social" } }),
            ("F41", "ansiedade", new[] { new[] { "ansiedade", "ansioso", "nervoso", "pânico", "angústia", "preocupação" } }),
            ("F42", "TOC", new[] { new[] { "obsessão", "compulsão", "toc", "repetitivo", "ritual", "lavar", "verificar" } }),
            ("F43", "TEPT/reação ao estresse", new[] { new[] { "trauma", "estresse", "pesadelo", "flashback", "pânico", "acidente", "violência", "luto" } }),
            ("F44", "transtorno dissociativo", new[] { new[] { "dissociação", "desmaio", "amnésia", "transe", "fora do corpo", "desconexão" } }),
            ("F45", "transtorno somatoforme", new[] { new[] { "somatização", "dor sem causa", "exame normal", "preocupação", "corpo", "hipocondria" } }),
            ("F48", "neurastenia", new[] { new[] { "cansaço", "esgotamento", "fadiga", "fraqueza", "nervoso", "irritável" } }),
            ("F50", "transtorno alimentar", new[] { new[] { "anorexia", "bulimia", "compulsão alimentar", "peso", "vômito", "emagrecer", "comer" } }),
            ("F51", "transtorno do sono não orgânico", new[] { new[] { "insônia", "sono", "dormir", "pesadelo", "não consegue dormir", "acordar" } }),
            ("F60", "transtorno de personalidade", new[] { new[] { "personalidade", "impulsividade", "instabilidade", "relacionamento", "borderline", "autolesão" } }),
            ("F84", "autismo/TEA", new[] { new[] { "autismo", "tea", "espectro", "comunicação", "social", "repetitivo", "desenvolvimento" } }),
            ("F90", "TDAH", new[] { new[] { "tdah", "desatenção", "hiperatividade", "concentração", "impulsividade", "atenção", "déficit" } }),

            // ===== NEUROLÓGICO (G) =====
            ("G20", "doença de Parkinson", new[] { new[] { "parkinson", "tremor", "rigidez", "lentidão", "equilíbrio", "marcha" } }),
            ("G25", "distúrbio de movimento", new[] { new[] { "tremor", "movimento involuntário", "tique", "distonia", "coreia" } }),
            ("G30", "doença de Alzheimer", new[] { new[] { "alzheimer", "memória", "esquecimento", "demência", "confusão", "cognitivo" } }),
            ("G35", "esclerose múltipla", new[] { new[] { "esclerose múltipla", "formigamento", "fraqueza", "visão", "fadiga", "dormência" } }),
            ("G40", "epilepsia", new[] { new[] { "epilepsia", "convulsão", "crise", "desmaio", "ausência" } }),
            ("G43", "enxaqueca", new[] { new[] { "enxaqueca", "dor de cabeça", "cefaleia", "cabeça", "migranea" } }),
            ("G44", "cefaleia tensional", new[] { new[] { "dor de cabeça", "cefaleia", "cabeça", "tensão", "aperto", "pressão na cabeça" } }),
            ("G45", "AIT/isquemia transitória", new[] { new[] { "ait", "isquemia", "transitório", "fraqueza", "fala", "visão", "tontura", "dormência" } }),
            ("G47", "distúrbio do sono", new[] { new[] { "sono", "insônia", "apneia", "ronco", "sonolência", "dormir" } }),
            ("G50", "neuralgia do trigêmeo", new[] { new[] { "trigêmeo", "neuralgia", "dor facial", "rosto", "face", "choque" } }),
            ("G51", "paralisia de Bell/facial", new[] { new[] { "paralisia facial", "bell", "rosto", "boca torta", "olho não fecha", "face" } }),
            ("G54", "distúrbio de raiz nervosa", new[] { new[] { "nervo", "raiz", "ciática", "dormência", "formigamento", "radiculopatia" } }),
            ("G56", "síndrome do túnel do carpo", new[] { new[] { "carpo", "túnel", "mão", "dormência", "formigamento", "punho" } }),
            ("G62", "polineuropatia", new[] { new[] { "neuropatia", "formigamento", "dormência", "pé", "mão", "queimação", "nervos" } }),
            ("G70", "miastenia gravis", new[] { new[] { "miastenia", "fraqueza", "pálpebra", "cansaço muscular", "engolir", "fadiga" } }),

            // ===== OLHO E OUVIDO (H) =====
            ("H10", "conjuntivite", new[] { new[] { "conjuntivite", "olho vermelho", "coceira no olho", "secreção", "lacrimejamento", "olho" } }),
            ("H25", "catarata senil", new[] { new[] { "catarata", "visão", "embaçado", "turvo", "olho" } }),
            ("H26", "catarata outra", new[] { new[] { "catarata", "visão", "embaçado", "turvo", "olho" } }),
            ("H40", "glaucoma", new[] { new[] { "glaucoma", "pressão no olho", "visão", "olho", "cegueira" } }),
            ("H52", "distúrbio de refração", new[] { new[] { "óculos", "visão", "miopia", "astigmatismo", "hipermetropia", "enxergar" } }),
            ("H60", "otite externa", new[] { new[] { "ouvido", "orelha", "dor de ouvido", "coceira", "secreção", "otite" } }),
            ("H65", "otite média não supurativa", new[] { new[] { "ouvido", "orelha", "dor de ouvido", "otite", "ouvir", "pressão" } }),
            ("H66", "otite média supurativa", new[] { new[] { "ouvido", "orelha", "pus", "secreção", "otite", "febre" } }),

            // ===== CARDIOVASCULAR (I) =====
            ("I10", "hipertensão", new[] { new[] { "pressão", "hipertensão", "pressão alta" } }),
            ("I20", "angina", new[] { new[] { "peito", "dor no peito", "torácica", "angina", "aperto" } }),
            ("I21", "infarto agudo do miocárdio", new[] { new[] { "infarto", "peito", "dor no peito", "aperto", "braço", "suor frio", "mal-estar" } }),
            ("I25", "doença isquêmica crônica", new[] { new[] { "coração", "isquemia", "angina", "peito", "esforço", "cateterismo" } }),
            ("I26", "embolia pulmonar", new[] { new[] { "embolia", "pulmão", "falta de ar", "dor no peito", "perna inchada", "trombose" } }),
            ("I34", "valvopatia mitral", new[] { new[] { "válvula", "sopro", "coração", "mitral", "falta de ar", "prolapso" } }),
            ("I35", "valvopatia aórtica", new[] { new[] { "válvula", "sopro", "coração", "aórtica", "tontura", "desmaio" } }),
            ("I42", "cardiomiopatia", new[] { new[] { "cardiomiopatia", "coração", "falta de ar", "inchaço", "cansaço", "coração grande" } }),
            ("I44", "bloqueio atrioventricular", new[] { new[] { "coração", "bradicardia", "tontura", "desmaio", "bloqueio", "marca-passo" } }),
            ("I45", "distúrbio de condução", new[] { new[] { "coração", "arritmia", "palpitação", "condução", "bloqueio" } }),
            ("I47", "taquicardia paroxística", new[] { new[] { "taquicardia", "palpitação", "coração acelerado", "coração disparado" } }),
            ("I48", "fibrilação/flutter atrial", new[] { new[] { "fibrilação", "arritmia", "palpitação", "coração", "irregular" } }),
            ("I49", "arritmia cardíaca outra", new[] { new[] { "arritmia", "palpitação", "coração", "irregular", "extra-sístole" } }),
            ("I50", "insuficiência cardíaca", new[] { new[] { "insuficiência cardíaca", "falta de ar", "inchaço", "perna inchada", "cansaço", "coração" } }),
            ("I63", "AVC isquêmico", new[] { new[] { "avc", "derrame", "fraqueza", "fala", "dormência", "boca torta", "paralisia" } }),
            ("I64", "AVC NE", new[] { new[] { "avc", "derrame", "fraqueza", "fala", "dormência", "boca torta" } }),
            ("I70", "aterosclerose", new[] { new[] { "aterosclerose", "entupimento", "artéria", "claudicação", "dor na perna", "circulação" } }),
            ("I73", "Raynaud/doença vascular periférica", new[] { new[] { "raynaud", "dedo", "frio", "circulação", "palidez", "cianose", "extremidade" } }),
            ("I80", "flebite/trombose venosa", new[] { new[] { "trombose", "perna inchada", "dor na perna", "flebite", "coágulo", "tvp" } }),
            ("I83", "varizes", new[] { new[] { "varizes", "variz", "veia", "perna", "inchada", "pesada", "circulação" } }),
            ("I84", "hemorroidas", new[] { new[] { "hemorroida", "hemorróida", "sangue", "ânus", "coceira", "dor", "evacuar" } }),
            ("I95", "hipotensão", new[] { new[] { "pressão", "hipotensão", "pressão baixa", "tontura", "tonto", "desmaio" } }),

            // ===== RESPIRATÓRIO (J) =====
            ("J00", "resfriado", new[] { new[] { "coriza", "espirro", "nariz", "resfriado", "gripe" } }),
            ("J01", "sinusite aguda", new[] { new[] { "sinusite", "nariz", "face", "dor na face", "secreção", "congestão" } }),
            ("J02", "faringite", new[] { new[] { "garganta", "faringite", "dor de garganta", "engolir" } }),
            ("J03", "amigdalite", new[] { new[] { "garganta", "amígdala", "engolir", "odinofagia" } }),
            ("J04", "laringite", new[] { new[] { "voz", "rouquidão", "garganta", "laringite", "rouca" } }),
            ("J06", "IVAS", new[] { new[] { "garganta", "coriza", "tosse", "nariz", "resfriado", "gripe" } }),
            ("J10", "influenza identificada", new[] { new[] { "gripe", "influenza", "febre", "corpo", "mialgia", "tosse" } }),
            ("J11", "influenza NE", new[] { new[] { "gripe", "influenza", "febre", "corpo", "mialgia", "tosse" } }),
            ("J18", "pneumonia", new[] { new[] { "tosse", "febre", "falta de ar", "pneumonia", "pulmão" } }),
            ("J20", "bronquite aguda", new[] { new[] { "bronquite", "tosse", "catarro", "peito", "chiado" } }),
            ("J30", "rinite alérgica", new[] { new[] { "rinite", "espirro", "coriza", "nariz", "alergia", "coceira no nariz" } }),
            ("J31", "rinite crônica", new[] { new[] { "rinite", "nariz", "coriza", "congestão", "crônico" } }),
            ("J32", "sinusite crônica", new[] { new[] { "sinusite", "nariz", "face", "secreção", "congestão", "crônico" } }),
            ("J34", "distúrbio nasal", new[] { new[] { "nariz", "septo", "desvio", "obstrução", "pólipo", "sangramento nasal" } }),
            ("J40", "bronquite NE", new[] { new[] { "bronquite", "tosse", "catarro", "peito" } }),
            ("J42", "bronquite crônica", new[] { new[] { "bronquite", "tosse", "catarro", "crônico", "peito" } }),
            ("J43", "enfisema", new[] { new[] { "enfisema", "falta de ar", "pulmão", "cigarro", "fumo" } }),
            ("J44", "DPOC", new[] { new[] { "dpoc", "falta de ar", "tosse", "cigarro", "fumo", "pulmão", "chiado" } }),
            ("J45", "asma", new[] { new[] { "asma", "chiado", "falta de ar", "broncoespasmo", "respirar" } }),
            ("J46", "estado de mal asmático", new[] { new[] { "asma", "crise", "falta de ar", "chiado", "emergência", "grave" } }),
            ("J47", "bronquiectasia", new[] { new[] { "bronquiectasia", "tosse", "catarro", "escarro", "infecção pulmonar" } }),
            ("J84", "doença pulmonar intersticial", new[] { new[] { "intersticial", "fibrose", "pulmão", "falta de ar", "tosse seca" } }),

            // ===== GASTROINTESTINAL (K) =====
            ("K04", "patologia periapical/dental", new[] { new[] { "dente", "dor de dente", "abscesso", "gengiva", "dental" } }),
            ("K08", "distúrbio dentário", new[] { new[] { "dente", "dental", "perda de dente", "gengiva" } }),
            ("K10", "distúrbio mandibular", new[] { new[] { "mandíbula", "maxilar", "atm", "mordida", "boca" } }),
            ("K20", "esofagite", new[] { new[] { "esôfago", "esofagite", "queimação", "engolir", "refluxo" } }),
            ("K21", "refluxo/DRGE", new[] { new[] { "refluxo", "azia", "queimação", "estômago", "esôfago" } }),
            ("K22", "distúrbio esofágico", new[] { new[] { "esôfago", "engolir", "disfagia", "queimação", "refluxo" } }),
            ("K25", "úlcera gástrica", new[] { new[] { "úlcera", "estômago", "dor", "sangramento", "queimação" } }),
            ("K26", "úlcera duodenal", new[] { new[] { "úlcera", "duodeno", "dor", "queimação", "jejum" } }),
            ("K27", "úlcera péptica NE", new[] { new[] { "úlcera", "estômago", "queimação", "dor", "azia" } }),
            ("K29", "gastrite", new[] { new[] { "gastrite", "estômago", "azia", "queimação", "epigástri" } }),
            ("K30", "dispepsia", new[] { new[] { "dispepsia", "indigestão", "estômago", "empachamento", "má digestão" } }),
            ("K35", "apendicite aguda", new[] { new[] { "apendicite", "dor abdominal", "barriga", "fossa ilíaca", "vômito", "febre" } }),
            ("K37", "apendicite NE", new[] { new[] { "apendicite", "dor abdominal", "barriga" } }),
            ("K40", "hérnia inguinal", new[] { new[] { "hérnia", "virilha", "inguinal", "caroço", "esforço" } }),
            ("K41", "hérnia femoral", new[] { new[] { "hérnia", "femoral", "virilha", "caroço" } }),
            ("K42", "hérnia umbilical", new[] { new[] { "hérnia", "umbigo", "umbilical", "barriga" } }),
            ("K43", "hérnia ventral", new[] { new[] { "hérnia", "ventral", "abdominal", "parede" } }),
            ("K44", "hérnia diafragmática", new[] { new[] { "hérnia", "diafragma", "hiatal", "refluxo", "estômago" } }),
            ("K50", "doença de Crohn", new[] { new[] { "crohn", "diarreia", "dor abdominal", "sangue nas fezes", "intestino", "inflamatório" } }),
            ("K51", "colite ulcerativa", new[] { new[] { "colite", "diarreia", "sangue nas fezes", "intestino", "retocolite", "muco" } }),
            ("K52", "gastroenterite não infecciosa", new[] { new[] { "gastroenterite", "diarreia", "vômito", "dor abdominal", "barriga" } }),
            ("K56", "íleo/obstrução intestinal", new[] { new[] { "obstrução", "intestino", "parado", "vômito", "barriga inchada", "não evacua" } }),
            ("K57", "doença diverticular", new[] { new[] { "divertículo", "diverticulite", "dor abdominal", "intestino", "febre" } }),
            ("K58", "síndrome do intestino irritável", new[] { new[] { "intestino irritável", "cólica", "diarreia", "constipação", "barriga", "gases", "inchaço" } }),
            ("K59", "constipação", new[] { new[] { "constipação", "prisão de ventre", "intestino preso", "evacuar", "fezes duras" } }),
            ("K60", "fissura anal", new[] { new[] { "fissura", "ânus", "dor", "sangue", "evacuar" } }),
            ("K61", "abscesso anal", new[] { new[] { "abscesso", "ânus", "pus", "dor", "inchaço" } }),
            ("K62", "distúrbio retal", new[] { new[] { "reto", "sangue", "evacuação", "ânus", "prolapso" } }),
            ("K70", "doença hepática alcoólica", new[] { new[] { "fígado", "álcool", "bebida", "icterícia", "cirrose" } }),
            ("K74", "cirrose/fibrose hepática", new[] { new[] { "cirrose", "fígado", "icterícia", "barriga inchada", "ascite" } }),
            ("K76", "doença hepática outra", new[] { new[] { "fígado", "hepática", "esteatose", "gordura no fígado", "transaminase" } }),
            ("K80", "colelitíase/cálculo biliar", new[] { new[] { "vesícula", "pedra", "cálculo", "bile", "cólica", "dor no lado direito" } }),
            ("K81", "colecistite", new[] { new[] { "vesícula", "colecistite", "inflamação", "dor", "febre", "bile" } }),
            ("K85", "pancreatite aguda", new[] { new[] { "pâncreas", "pancreatite", "dor abdominal", "vômito", "barriga" } }),
            ("K86", "doença pancreática outra", new[] { new[] { "pâncreas", "pancreatite", "crônica", "diabetes", "dor abdominal" } }),

            // ===== PELE/DERMATOLÓGICO (L) =====
            ("L01", "impetigo", new[] { new[] { "impetigo", "ferida", "crosta", "pele", "bolha", "infecção de pele" } }),
            ("L02", "abscesso/furúnculo", new[] { new[] { "abscesso", "furúnculo", "caroço", "pus", "inchaço", "dor", "pele" } }),
            ("L03", "celulite", new[] { new[] { "celulite", "vermelhidão", "inchaço", "quente", "infecção", "pele" } }),
            ("L08", "infecção de pele outra", new[] { new[] { "infecção", "pele", "ferida", "pus" } }),
            ("L20", "dermatite atópica", new[] { new[] { "pele", "coceira", "prurido", "eczema", "dermatite" } }),
            ("L21", "dermatite seborreica", new[] { new[] { "caspa", "seborreia", "descamação", "couro cabeludo", "oleosidade", "dermatite" } }),
            ("L23", "dermatite alérgica de contato", new[] { new[] { "alergia", "contato", "coceira", "vermelhidão", "pele", "dermatite" } }),
            ("L25", "dermatite de contato NE", new[] { new[] { "dermatite", "contato", "coceira", "pele", "vermelhidão" } }),
            ("L30", "dermatite outra", new[] { new[] { "dermatite", "pele", "coceira", "erupção", "vermelhidão" } }),
            ("L40", "psoríase", new[] { new[] { "psoríase", "placa", "descamação", "pele", "cotovelo", "joelho", "couro cabeludo" } }),
            ("L43", "líquen plano", new[] { new[] { "líquen", "pápula", "coceira", "pele", "violácea" } }),
            ("L50", "urticária", new[] { new[] { "urticária", "coceira", "prurido", "vergão", "alergia", "placa" } }),
            ("L60", "distúrbio ungueal", new[] { new[] { "unha", "unha encravada", "deformidade", "fungo na unha", "onicomicose" } }),
            ("L63", "alopecia areata", new[] { new[] { "alopecia", "queda de cabelo", "cabelo", "pelada", "falha" } }),
            ("L65", "alopecia outra", new[] { new[] { "queda de cabelo", "cabelo", "calvície", "alopecia", "rareamento" } }),
            ("L70", "acne", new[] { new[] { "acne", "espinha", "cravos", "oleosidade", "rosto", "pele" } }),
            ("L71", "rosácea", new[] { new[] { "rosácea", "vermelhidão", "rosto", "face", "pústula", "vasos" } }),
            ("L72", "cisto de pele", new[] { new[] { "cisto", "caroço", "bolinha", "nódulo", "pele", "sebáceo" } }),
            ("L80", "vitiligo", new[] { new[] { "vitiligo", "mancha branca", "despigmentação", "pele", "cor" } }),
            ("L82", "ceratose seborreica", new[] { new[] { "ceratose", "verruga", "sinal", "mancha", "escura", "pele" } }),
            ("L90", "atrofia de pele", new[] { new[] { "pele fina", "estria", "atrofia", "cicatriz", "pele" } }),

            // ===== MUSCULOESQUELÉTICO (M) =====
            ("M05", "artrite reumatoide soropositiva", new[] { new[] { "artrite", "reumatoide", "junta", "inchaço", "rigidez", "mão", "dor articular" } }),
            ("M06", "artrite reumatoide outra", new[] { new[] { "artrite", "reumatoide", "junta", "rigidez", "inchaço", "dor articular" } }),
            ("M10", "gota", new[] { new[] { "gota", "ácido úrico", "dedo do pé", "articulação", "inchaço", "dor", "vermelhidão" } }),
            ("M13", "artrite outra", new[] { new[] { "artrite", "articulação", "junta", "dor", "inchaço", "inflamação" } }),
            ("M15", "poliartrose", new[] { new[] { "artrose", "desgaste", "articulação", "junta", "dor", "rigidez" } }),
            ("M16", "artrose do quadril", new[] { new[] { "quadril", "artrose", "desgaste", "dor", "andar", "coxartrose" } }),
            ("M17", "artrose do joelho", new[] { new[] { "joelho", "artrose", "desgaste", "dor", "gonartrose", "andar" } }),
            ("M18", "artrose da mão", new[] { new[] { "mão", "artrose", "dedo", "desgaste", "dor", "polegar" } }),
            ("M19", "artrose outra", new[] { new[] { "artrose", "desgaste", "articulação", "dor", "junta" } }),
            ("M20", "deformidade de dedo", new[] { new[] { "dedo", "joanete", "hálux", "deformidade", "martelo" } }),
            ("M23", "lesão meniscal do joelho", new[] { new[] { "menisco", "joelho", "estalido", "travamento", "dor", "inchaço" } }),
            ("M25", "dor articular", new[] { new[] { "articulação", "junta", "joelho", "ombro", "dor articular" } }),
            ("M35", "hipermobilidade", new[] { new[] { "hipermobilidade", "flexibilidade", "articulação", "deslocamento", "junta" } }),
            ("M40", "cifose", new[] { new[] { "cifose", "corcunda", "coluna", "costas", "curvatura" } }),
            ("M41", "escoliose", new[] { new[] { "escoliose", "coluna", "desvio", "costas", "curvatura" } }),
            ("M42", "osteocondrose", new[] { new[] { "osteocondrose", "coluna", "scheuermann", "dor", "crescimento" } }),
            ("M43", "deformidade dorsopatia", new[] { new[] { "coluna", "espondilolistese", "fusão", "vértebra", "costas" } }),
            ("M45", "espondilite anquilosante", new[] { new[] { "espondilite", "anquilosante", "coluna", "rigidez", "dor lombar", "manhã" } }),
            ("M47", "espondilose", new[] { new[] { "espondilose", "bico de papagaio", "coluna", "desgaste", "dor" } }),
            ("M48", "estenose espinal", new[] { new[] { "estenose", "canal", "coluna", "perna", "dormência", "andar" } }),
            ("M50", "hérnia de disco cervical", new[] { new[] { "hérnia", "disco", "cervical", "pescoço", "braço", "dormência", "formigamento" } }),
            ("M51", "hérnia de disco lombar", new[] { new[] { "hérnia", "disco", "lombar", "ciática", "perna", "dormência", "dor nas costas" } }),
            ("M53", "dorsopatia outra", new[] { new[] { "coluna", "costas", "dor", "cervical", "torácica" } }),
            ("M54", "dorsalgia/lombalgia", new[] { new[] { "costas", "lombar", "coluna", "dor nas costas", "lombalgia" } }),
            ("M60", "miosite", new[] { new[] { "músculo", "inflamação", "dor muscular", "miosite", "fraqueza" } }),
            ("M62", "distúrbio muscular", new[] { new[] { "músculo", "câimbra", "espasmo", "fraqueza", "dor muscular" } }),
            ("M65", "sinovite/tenossinovite", new[] { new[] { "tendão", "sinovite", "tenossinovite", "dor", "inchaço", "estalido" } }),
            ("M67", "distúrbio tendíneo", new[] { new[] { "tendão", "tendinite", "dor", "esforço", "movimento" } }),
            ("M70", "bursite", new[] { new[] { "bursite", "ombro", "quadril", "inchaço", "dor", "cotovelo" } }),
            ("M71", "bursite outra", new[] { new[] { "bursite", "inchaço", "dor", "articulação" } }),
            ("M72", "fasciite/fasciopatia", new[] { new[] { "fasciite", "fascite plantar", "planta do pé", "calcanhar", "dor no pé" } }),
            ("M75", "lesão do ombro", new[] { new[] { "ombro", "manguito", "rotador", "dor", "braço", "levantar" } }),
            ("M76", "entesopatia de membro inferior", new[] { new[] { "tendão", "joelho", "calcanhar", "dor", "esforço", "pé" } }),
            ("M77", "entesopatia outra", new[] { new[] { "epicondilite", "cotovelo", "tendão", "dor", "esforço", "tendinite" } }),
            ("M79", "distúrbio de tecidos moles", new[] { new[] { "dor", "fibromialgia", "ponto doloroso", "corpo", "músculo", "tecido mole" } }),
            ("M80", "osteoporose com fratura", new[] { new[] { "osteoporose", "fratura", "osso", "queda", "coluna", "fêmur" } }),
            ("M81", "osteoporose sem fratura", new[] { new[] { "osteoporose", "osso", "densitometria", "cálcio", "fraqueza" } }),
            ("M84", "distúrbio de fratura", new[] { new[] { "fratura", "osso", "estresse", "consolidação", "não consolidou" } }),

            // ===== GENITURINÁRIO (N) =====
            ("N10", "pielonefrite aguda", new[] { new[] { "pielonefrite", "rim", "febre", "dor lombar", "urina", "infecção" } }),
            ("N11", "pielonefrite crônica", new[] { new[] { "pielonefrite", "rim", "crônica", "urina", "infecção" } }),
            ("N12", "nefrite tubulointersticial", new[] { new[] { "nefrite", "rim", "urina", "infecção", "inflamação" } }),
            ("N13", "uropatia obstrutiva", new[] { new[] { "obstrução", "rim", "hidronefrose", "urina", "dor lombar" } }),
            ("N17", "insuficiência renal aguda", new[] { new[] { "rim", "insuficiência renal", "creatinina", "urina", "inchaço" } }),
            ("N18", "doença renal crônica", new[] { new[] { "rim", "insuficiência renal", "creatinina", "diálise", "crônica" } }),
            ("N19", "insuficiência renal NE", new[] { new[] { "rim", "insuficiência renal", "creatinina", "urina" } }),
            ("N20", "cálculo renal", new[] { new[] { "pedra no rim", "cálculo", "cólica renal", "rim", "dor lombar", "urina" } }),
            ("N21", "cálculo ureteral/vesical", new[] { new[] { "pedra", "cálculo", "bexiga", "urina", "dor" } }),
            ("N30", "cistite", new[] { new[] { "cistite", "bexiga", "ardência", "urina", "xixi", "frequência" } }),
            ("N34", "uretrite", new[] { new[] { "uretrite", "ardência", "urina", "corrimento", "queimação" } }),
            ("N39", "ITU", new[] { new[] { "urina", "ardência", "disúria", "urgência", "xixi", "bexiga" } }),
            ("N40", "hiperplasia prostática", new[] { new[] { "próstata", "jato fraco", "urina", "levantar à noite", "noctúria", "dificuldade para urinar" } }),
            ("N41", "prostatite", new[] { new[] { "prostatite", "próstata", "dor", "urina", "febre", "períneo" } }),
            ("N43", "hidrocele", new[] { new[] { "hidrocele", "testículo", "inchaço", "escroto", "bolsa" } }),
            ("N44", "torção testicular", new[] { new[] { "torção", "testículo", "dor", "escroto", "emergência" } }),
            ("N45", "orquite/epididimite", new[] { new[] { "orquite", "epididimite", "testículo", "dor", "inchaço", "febre" } }),
            ("N46", "infertilidade masculina", new[] { new[] { "infertilidade", "esperma", "espermograma", "fertilidade", "filho" } }),
            ("N48", "distúrbio peniano", new[] { new[] { "pênis", "fimose", "parafimose", "priapismo", "ereção" } }),
            ("N49", "distúrbio genital masculino", new[] { new[] { "genital", "testículo", "escroto", "dor", "inchaço" } }),
            ("N60", "displasia mamária", new[] { new[] { "mama", "nódulo", "dor na mama", "cisto", "mastalgia" } }),
            ("N63", "nódulo mamário", new[] { new[] { "mama", "nódulo", "caroço", "mamografia", "seio" } }),
            ("N64", "distúrbio mamário outro", new[] { new[] { "mama", "dor", "secreção", "mamilo", "seio" } }),
            ("N70", "salpingite/ooforite", new[] { new[] { "trompa", "ovário", "dor pélvica", "febre", "corrimento" } }),
            ("N71", "endometrite", new[] { new[] { "útero", "endometrite", "febre", "sangramento", "dor pélvica" } }),
            ("N72", "cervicite", new[] { new[] { "colo do útero", "cervicite", "corrimento", "sangramento" } }),
            ("N73", "doença inflamatória pélvica", new[] { new[] { "dip", "dor pélvica", "corrimento", "febre", "inflamação" } }),
            ("N75", "bartholinite", new[] { new[] { "bartholin", "caroço", "vulva", "dor", "inchaço" } }),
            ("N76", "vaginite", new[] { new[] { "vaginite", "corrimento", "coceira", "vaginal", "odor" } }),
            ("N77", "vulvovaginite", new[] { new[] { "vulva", "vaginal", "coceira", "corrimento", "irritação" } }),
            ("N80", "endometriose", new[] { new[] { "endometriose", "cólica", "dor pélvica", "menstruação", "infertilidade" } }),
            ("N81", "prolapso genital", new[] { new[] { "prolapso", "útero", "bexiga", "descida", "peso", "vaginal" } }),
            ("N83", "cisto ovariano", new[] { new[] { "cisto", "ovário", "dor pélvica", "menstruação", "ultrassom" } }),
            ("N84", "pólipo genital", new[] { new[] { "pólipo", "útero", "sangramento", "endométrio" } }),
            ("N91", "amenorreia", new[] { new[] { "amenorreia", "menstruação", "não menstrua", "atraso", "ciclo" } }),
            ("N92", "menstruação excessiva", new[] { new[] { "menstruação", "sangramento", "menorragia", "intenso", "muito sangue" } }),
            ("N93", "sangramento uterino anormal", new[] { new[] { "sangramento", "útero", "irregular", "fora do período" } }),
            ("N94", "dor pélvica/dismenorreia", new[] { new[] { "cólica", "dismenorreia", "dor pélvica", "menstruação", "dor" } }),
            ("N95", "menopausa/climatério", new[] { new[] { "menopausa", "climatério", "calor", "fogacho", "ondas de calor", "suor", "menstruação parou" } }),

            // ===== GRAVIDEZ/OBSTÉTRICO (O) =====
            ("O03", "aborto espontâneo", new[] { new[] { "aborto", "perda", "sangramento", "gravidez", "gestação", "cólica" } }),
            ("O04", "aborto médico", new[] { new[] { "aborto", "curetagem", "sangramento", "gravidez" } }),
            ("O10", "hipertensão pré-existente na gravidez", new[] { new[] { "pressão", "hipertensão", "gravidez", "gestação", "pré-eclâmpsia" } }),
            ("O11", "pré-eclâmpsia sobreposta", new[] { new[] { "pré-eclâmpsia", "pressão", "gravidez", "inchaço", "proteinúria" } }),
            ("O13", "hipertensão gestacional", new[] { new[] { "pressão", "hipertensão", "gravidez", "gestação" } }),
            ("O14", "pré-eclâmpsia", new[] { new[] { "pré-eclâmpsia", "pressão", "inchaço", "proteinúria", "gravidez", "eclâmpsia" } }),
            ("O20", "hemorragia no início da gravidez", new[] { new[] { "sangramento", "gravidez", "primeiro trimestre", "ameaça de aborto" } }),
            ("O21", "hiperêmese gravídica", new[] { new[] { "hiperêmese", "enjoo", "vômito", "náusea", "gravidez", "gestação" } }),
            ("O24", "diabetes gestacional", new[] { new[] { "diabetes", "gestacional", "glicose", "gravidez", "açúcar" } }),
            ("O36", "cuidados fetais", new[] { new[] { "feto", "bebê", "ultrassom", "crescimento", "gestação", "líquido" } }),
            ("O42", "ruptura prematura de membranas", new[] { new[] { "bolsa", "rompeu", "líquido", "amniótico", "ruptura", "gestação" } }),
            ("O47", "falso trabalho de parto", new[] { new[] { "contração", "falso trabalho", "braxton", "parto", "gestação" } }),
            ("O60", "trabalho de parto prematuro", new[] { new[] { "prematuro", "contração", "parto", "antecipado", "gestação" } }),
            ("O80", "parto normal", new[] { new[] { "parto", "normal", "vaginal", "contração", "dilatação" } }),
            ("O82", "parto cesáreo", new[] { new[] { "cesárea", "cesariana", "parto", "cirurgia" } }),

            // ===== TECIDO CONJUNTIVO / GENÉTICO =====
            ("Q79", "Ehlers-Danlos/congênito", new[] { new[] { "pele", "elástica", "flexibilidade", "articulação", "hematoma", "roxo", "equimose" } }),

            // ===== LESÕES/TRAUMATISMOS (S/T) =====
            ("S00", "traumatismo craniano superficial", new[] { new[] { "cabeça", "bateu", "pancada", "corte", "hematoma", "queda" } }),
            ("S01", "ferimento da cabeça", new[] { new[] { "cabeça", "corte", "ferimento", "sangue", "sutura" } }),
            ("S02", "fratura de crânio/face", new[] { new[] { "fratura", "crânio", "face", "nariz", "mandíbula", "pancada" } }),
            ("S06", "traumatismo intracraniano", new[] { new[] { "concussão", "cabeça", "tontura", "vômito", "perda de consciência", "traumatismo" } }),
            ("S09", "traumatismo da cabeça outro", new[] { new[] { "cabeça", "traumatismo", "pancada", "acidente" } }),
            ("S40", "traumatismo do ombro", new[] { new[] { "ombro", "pancada", "queda", "dor", "braço", "contusão" } }),
            ("S42", "fratura do ombro/braço", new[] { new[] { "fratura", "ombro", "braço", "clavícula", "úmero", "queda" } }),
            ("S43", "luxação do ombro", new[] { new[] { "luxação", "ombro", "deslocou", "braço", "saiu do lugar" } }),
            ("S46", "lesão muscular do ombro/braço", new[] { new[] { "ombro", "braço", "músculo", "tendão", "ruptura", "dor" } }),
            ("S49", "traumatismo do braço outro", new[] { new[] { "braço", "pancada", "queda", "dor", "contusão" } }),
            ("S60", "traumatismo do punho/mão superficial", new[] { new[] { "mão", "punho", "dedo", "bateu", "pancada", "inchaço" } }),
            ("S62", "fratura do punho/mão", new[] { new[] { "fratura", "mão", "punho", "dedo", "queda" } }),
            ("S63", "luxação/entorse do punho/mão", new[] { new[] { "entorse", "punho", "mão", "dedo", "torção" } }),
            ("S69", "traumatismo do punho/mão outro", new[] { new[] { "mão", "punho", "dedo", "traumatismo", "dor" } }),
            ("S80", "traumatismo do joelho/perna superficial", new[] { new[] { "joelho", "perna", "pancada", "bateu", "hematoma", "queda" } }),
            ("S82", "fratura da perna", new[] { new[] { "fratura", "perna", "tíbia", "fíbula", "queda" } }),
            ("S83", "luxação/entorse do joelho", new[] { new[] { "joelho", "entorse", "ligamento", "torção", "inchaço" } }),
            ("S86", "lesão muscular da perna", new[] { new[] { "perna", "músculo", "panturrilha", "ruptura", "distensão" } }),
            ("S89", "traumatismo da perna outro", new[] { new[] { "perna", "pancada", "queda", "dor", "contusão" } }),
            ("S90", "traumatismo do tornozelo/pé superficial", new[] { new[] { "tornozelo", "pé", "pancada", "bateu", "inchaço" } }),
            ("S92", "fratura do pé", new[] { new[] { "fratura", "pé", "dedo do pé", "metatarso", "queda" } }),
            ("S93", "luxação/entorse do tornozelo", new[] { new[] { "tornozelo", "entorse", "torção", "virou o pé", "inchaço" } }),
            ("S99", "traumatismo do pé outro", new[] { new[] { "pé", "dedo", "pancada", "queda", "dor" } }),
            ("T14", "traumatismo NE", new[] { new[] { "lesão", "traumatismo", "pancada", "queda", "acidente" } }),
            ("T78", "efeito adverso/alergia", new[] { new[] { "alergia", "reação", "anafilaxia", "urticária", "inchaço", "medicamento" } }),
            ("T88", "complicação de procedimento", new[] { new[] { "complicação", "cirurgia", "procedimento", "infecção", "reação", "pós-operatório" } }),
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
            ["taquicardia"] = new[] { "coração acelerado", "coração disparado", "batimento rápido", "palpitação" },
            ["bradicardia"] = new[] { "coração lento", "batimento lento", "batimento fraco" },
            ["hipertensão"] = new[] { "pressão alta", "pressão subiu", "pressão elevada" },
            ["hipotensão"] = new[] { "pressão baixa", "pressão caiu", "pressão baixou", "quase desmaiei" },
            ["dispepsia"] = new[] { "má digestão", "indigestão", "estômago pesado", "empachamento" },
            ["constipação"] = new[] { "intestino preso", "não consigo evacuar", "prisão de ventre", "não faço cocô" },
            ["diarreia"] = new[] { "intestino solto", "fezes líquidas", "indo muito ao banheiro" },
            ["disúria"] = new[] { "dor ao urinar", "ardência ao urinar", "queima ao fazer xixi" },
            ["polaciúria"] = new[] { "urinando muito", "indo muito ao banheiro", "urina frequente" },
            ["hematúria"] = new[] { "sangue na urina", "urina com sangue", "xixi com sangue" },
            ["hematêmese"] = new[] { "vômito com sangue", "vomitando sangue" },
            ["melena"] = new[] { "fezes escuras", "fezes pretas", "cocô preto" },
            ["epistaxe"] = new[] { "sangramento nasal", "nariz sangrando", "sangue no nariz" },
            ["ortopneia"] = new[] { "não consigo deitar", "acordo sem ar", "falta de ar deitado" },
            ["noctúria"] = new[] { "acordo para urinar", "urinar de noite", "levanto de noite para urinar" },
            ["disfagia"] = new[] { "dificuldade para engolir", "não consigo engolir", "engasgo" },
            ["xerostomia"] = new[] { "boca seca", "seco na boca" },
            ["hiporexia"] = new[] { "sem apetite", "não tenho fome", "perdi a fome", "falta de apetite" },
            ["polidipsia"] = new[] { "muita sede", "bebendo muita água", "sede excessiva" },
            ["poliúria"] = new[] { "urinando muito", "muita urina", "xixi demais" },
            ["polifagia"] = new[] { "muita fome", "comendo demais", "fome excessiva" },
            ["parestesia"] = new[] { "formigamento", "dormência", "adormecido", "formigando" },
            ["paresia"] = new[] { "fraqueza no braço", "fraqueza na perna", "não consigo mexer", "perdendo força" },
            ["diplopia"] = new[] { "visão dupla", "vendo duplo", "dois de tudo" },
            ["escotoma"] = new[] { "mancha na visão", "ponto cego", "sombra na visão" },
            ["fotofobia"] = new[] { "luz incomoda", "sensibilidade à luz", "dói com luz" },
            ["otalgia"] = new[] { "dor de ouvido", "ouvido dói", "dor no ouvido" },
            ["odinofagia"] = new[] { "dor ao engolir", "dói para engolir", "garganta dói ao engolir" },
            ["rinorreia"] = new[] { "nariz escorrendo", "coriza", "nariz pingando" },
            ["sibilância"] = new[] { "chiado no peito", "peito chiando", "respiração com chiado" },
            ["hemoptise"] = new[] { "tosse com sangue", "sangue ao tossir", "escarro com sangue" },
            ["icterícia"] = new[] { "amarelo", "pele amarela", "olho amarelo", "amarelão" },
            ["ascite"] = new[] { "barriga inchada", "barriga d'água", "líquido na barriga" },
            ["amenorreia"] = new[] { "menstruação atrasada", "não menstruo", "sem menstruação", "menstruação parou" },
            ["dismenorreia"] = new[] { "cólica menstrual", "dor na menstruação", "cólica forte" },
            ["menorragia"] = new[] { "menstruação forte", "sangramento intenso", "menstruação abundante" },
            ["metrorragia"] = new[] { "sangramento fora do período", "sangramento vaginal", "sangramento irregular" },
        };

        foreach (var (clinical, colloquials) in mappings)
        {
            if (!symptom.Contains(clinical)) continue;
            if (colloquials.Any(c => transcript.Contains(c)))
                return true;
        }
        return false;
    }

    /// <summary>
    /// Valida se cada sintoma da anamnese tem base no transcript.
    /// Retorna issues para sintomas possivelmente alucinados.
    /// </summary>
    private static List<string> ValidateSymptomsAgainstTranscript(JsonElement root, string transcriptLower)
    {
        var issues = new List<string>();

        if (!root.TryGetProperty("anamnesis", out var ana) || ana.ValueKind != JsonValueKind.Object)
            return issues;
        if (!ana.TryGetProperty("sintomas", out var sintomasEl) || sintomasEl.ValueKind != JsonValueKind.Array)
            return issues;

        foreach (var s in sintomasEl.EnumerateArray())
        {
            var symptom = s.GetString()?.Trim();
            if (string.IsNullOrWhiteSpace(symptom)) continue;

            var symptomLower = symptom.ToLowerInvariant();
            var words = symptomLower.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length > 3)
                .ToArray();

            if (words.Length == 0) continue;

            var found = words.Count(w => transcriptLower.Contains(w));
            var ratio = (double)found / words.Length;
            var hasSemantic = HasSemanticMatch(symptomLower, transcriptLower);

            if (found == 0 && !hasSemantic)
                issues.Add($"CRÍTICO: Sintoma '{symptom}' possivelmente alucinado — sem base no transcript");
            else if (ratio < 0.3 && !hasSemantic)
                issues.Add($"ALERTA: Sintoma '{symptom}' com baixa fundamentação no transcript ({ratio * 100:F0}% das palavras).");
        }

        return issues;
    }

    /// <summary>
    /// Valida se medicamentos sugeridos são compatíveis com o CID sugerido.
    /// Detecta prescrições incongruentes com o diagnóstico.
    /// </summary>
    private static List<string> ValidateMedicationsAgainstCid(JsonElement root, string transcriptLower)
    {
        var issues = new List<string>();

        // Extrair CID sugerido
        var cidSugerido = root.TryGetProperty("cid_sugerido", out var cidEl)
            ? cidEl.GetString()?.Trim()?.ToUpperInvariant() ?? "" : "";
        var cidCode = Regex.Match(cidSugerido, @"\b([A-Z]\d{2}(?:\.\d+)?)\b").Groups[1].Value.ToUpperInvariant();

        // Extrair medicamentos
        var medications = new List<string>();
        if (root.TryGetProperty("medicamentos_sugeridos", out var medsEl))
        {
            if (medsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var med in medsEl.EnumerateArray())
                {
                    if (med.ValueKind == JsonValueKind.String)
                    {
                        var val = med.GetString()?.ToLowerInvariant().Trim();
                        if (!string.IsNullOrWhiteSpace(val)) medications.Add(val);
                    }
                    else if (med.ValueKind == JsonValueKind.Object && med.TryGetProperty("nome", out var nomeEl))
                    {
                        var val = nomeEl.GetString()?.ToLowerInvariant().Trim();
                        if (!string.IsNullOrWhiteSpace(val)) medications.Add(val);
                    }
                }
            }
        }

        if (string.IsNullOrWhiteSpace(cidCode) || medications.Count == 0)
            return issues;

        // Mapa: (nomes de medicamentos, CIDs esperados, classe terapêutica)
        var medicationCidRules = new (string[] meds, string[] expectedCidPrefixes, string classe)[]
        {
            (new[] { "fluoxetina", "sertralina", "escitalopram", "citalopram", "paroxetina", "venlafaxina", "duloxetina", "amitriptilina", "clomipramina" },
             new[] { "F32", "F33", "F41", "F40", "F42", "F43" },
             "antidepressivo"),

            (new[] { "risperidona", "olanzapina", "quetiapina", "haloperidol", "aripiprazol", "clozapina", "ziprasidona" },
             new[] { "F20", "F23", "F25", "F30", "F31" },
             "antipsicótico"),

            (new[] { "insulina", "metformina", "glibenclamida", "glimepirida", "gliclazida", "sitagliptina", "dapagliflozina", "empagliflozina" },
             new[] { "E10", "E11", "E13", "E14" },
             "antidiabético/insulina"),

            (new[] { "losartana", "enalapril", "amlodipina", "atenolol", "propranolol", "captopril", "valsartana", "hidroclorotiazida", "espironolactona" },
             new[] { "I10", "I11", "I12", "I13", "I15" },
             "anti-hipertensivo"),

            (new[] { "salbutamol", "formoterol", "budesonida", "beclometasona", "salmeterol", "fenoterol", "brometo de ipratrópio" },
             new[] { "J45", "J44", "J43", "J42", "J20" },
             "broncodilatador/corticoide inalatório"),

            (new[] { "levotiroxina", "propiltiouracil", "metimazol", "tapazol" },
             new[] { "E03", "E04", "E05", "E06" },
             "tireoidiano"),
        };

        foreach (var medication in medications)
        {
            foreach (var (meds, expectedCids, classe) in medicationCidRules)
            {
                var matchesMed = meds.Any(m => medication.Contains(m));
                if (!matchesMed) continue;

                var cidMatchesExpected = expectedCids.Any(prefix =>
                    cidCode.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));

                if (!cidMatchesExpected)
                {
                    // Also check diagnostico_diferencial CIDs
                    var diffHasMatch = false;
                    if (root.TryGetProperty("diagnostico_diferencial", out var ddEl) && ddEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in ddEl.EnumerateArray())
                        {
                            var diffCid = item.TryGetProperty("cid", out var dc) ? dc.GetString() ?? "" : "";
                            var diffCidCode = Regex.Match(diffCid, @"\b([A-Z]\d{2}(?:\.\d+)?)\b").Groups[1].Value.ToUpperInvariant();
                            if (expectedCids.Any(prefix => diffCidCode.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)))
                            {
                                diffHasMatch = true;
                                break;
                            }
                        }
                    }

                    if (!diffHasMatch)
                        issues.Add($"ALERTA: Medicamento '{medication}' ({classe}) não corresponde ao CID {cidCode}. CIDs esperados: {string.Join(", ", expectedCids)}.");
                }

                break; // Medication matched a rule, no need to check other rules
            }
        }

        return issues;
    }

    /// <summary>
    /// Valida se antecedentes pessoais e familiares têm base no transcript.
    /// Detecta antecedentes possivelmente fabricados.
    /// </summary>
    private static List<string> ValidateAntecedentsAgainstTranscript(JsonElement root, string transcriptLower)
    {
        var issues = new List<string>();
        var skipTerms = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "nega", "nenhum", "sem", "não", "nao", "nada", "nunca", "n/a", "-", "ndn"
        };

        // Mapa de termos clínicos → termos coloquiais que também indicam menção
        var colloquialMap = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["HAS"] = new[] { "pressão", "pressao", "hipertensão", "hipertensao", "pressão alta" },
            ["DM"] = new[] { "diabetes", "açúcar", "acucar", "glicose", "glicemia" },
            ["diabetes"] = new[] { "açúcar", "acucar", "glicose", "glicemia" },
            ["hipertensão"] = new[] { "pressão", "pressao", "pressão alta" },
            ["hipertensao"] = new[] { "pressão", "pressao", "pressão alta" },
            ["IAM"] = new[] { "infarto", "coração", "coracao", "ataque cardíaco" },
            ["AVC"] = new[] { "derrame", "acidente vascular" },
            ["DPOC"] = new[] { "enfisema", "pulmão", "pulmao", "falta de ar" },
            ["asma"] = new[] { "chiado", "falta de ar", "bronquite" },
            ["depressão"] = new[] { "triste", "tristeza", "desânimo", "desanimo" },
            ["depressao"] = new[] { "triste", "tristeza", "desânimo", "desanimo" },
            ["ansiedade"] = new[] { "ansioso", "nervoso", "pânico", "panico" },
            ["hipotireoidismo"] = new[] { "tireoide", "tireoide", "tsh" },
            ["hipertireoidismo"] = new[] { "tireoide", "tireoide", "tsh" },
            ["dislipidemia"] = new[] { "colesterol", "triglicérides", "triglicerides" },
        };

        if (!root.TryGetProperty("anamnesis", out var ana) || ana.ValueKind != JsonValueKind.Object)
            return issues;

        var antecedentSources = new[] { "antecedentes_pessoais", "antecedentes_familiares" };

        foreach (var field in antecedentSources)
        {
            if (!ana.TryGetProperty(field, out var antEl)) continue;

            var antecedents = new List<string>();

            if (antEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in antEl.EnumerateArray())
                {
                    var val = item.GetString()?.Trim();
                    if (!string.IsNullOrWhiteSpace(val)) antecedents.Add(val);
                }
            }
            else if (antEl.ValueKind == JsonValueKind.String)
            {
                var val = antEl.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(val))
                {
                    // Split by common separators
                    var parts = val.Split(new[] { ',', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                    foreach (var part in parts)
                    {
                        var trimmed = part.Trim();
                        if (!string.IsNullOrWhiteSpace(trimmed)) antecedents.Add(trimmed);
                    }
                }
            }

            foreach (var ant in antecedents)
            {
                var antLower = ant.ToLowerInvariant().Trim();

                // Skip generic negation terms
                if (skipTerms.Any(t => antLower == t.ToLowerInvariant() || antLower.StartsWith(t.ToLowerInvariant() + " ")))
                    continue;

                // Check if at least 1 significant word appears in transcript
                var words = antLower.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                    .Where(w => w.Length > 2)
                    .ToArray();

                var directMatch = words.Any(w => transcriptLower.Contains(w));

                // Check colloquial mappings
                var colloquialMatch = false;
                foreach (var (clinical, colloquials) in colloquialMap)
                {
                    if (!antLower.Contains(clinical.ToLowerInvariant())) continue;
                    if (colloquials.Any(c => transcriptLower.Contains(c)))
                    {
                        colloquialMatch = true;
                        break;
                    }
                }

                // Also check if the antecedent term itself (as abbreviation) is in transcript
                var abbreviationMatch = antLower.Length <= 4 && antLower == antLower.ToUpperInvariant().ToLowerInvariant()
                    && transcriptLower.Contains(antLower);

                if (!directMatch && !colloquialMatch && !abbreviationMatch)
                {
                    var fieldLabel = field == "antecedentes_pessoais" ? "pessoal" : "familiar";
                    issues.Add($"ALERTA: Antecedente {fieldLabel} '{ant}' não mencionado no transcript.");
                }
            }
        }

        return issues;
    }

    /// <summary>
    /// Valida se argumentos do diagnóstico diferencial têm base no transcript.
    /// Detecta achados de exame físico fabricados.
    /// </summary>
    private static List<string> ValidateDifferentialArguments(JsonElement root, string transcriptLower)
    {
        var issues = new List<string>();

        if (!root.TryGetProperty("diagnostico_diferencial", out var ddEl) || ddEl.ValueKind != JsonValueKind.Array)
            return issues;

        // Physical exam terms that indicate fabricated findings if not in transcript
        var physicalExamTerms = new[]
        {
            "ausculta", "palpação", "palpacao", "inspeção", "inspecao",
            "percussão", "percussao", "ausculta pulmonar", "ausculta cardíaca",
            "ausculta cardiaca", "murmúrio vesicular", "murmúrios vesiculares",
            "bulhas", "sopro", "crepitação", "crepitacao", "ronco", "sibilo",
            "estertores", "hepatomegalia", "esplenomegalia", "sinal de",
            "manobra de", "teste de", "reflexo", "toque retal"
        };

        foreach (var item in ddEl.EnumerateArray())
        {
            var hipotese = item.TryGetProperty("hipotese", out var h) ? h.GetString() ?? "" : "";

            // Check argumentos_a_favor
            var aFavor = "";
            if (item.TryGetProperty("argumentos_a_favor", out var afEl))
            {
                if (afEl.ValueKind == JsonValueKind.String)
                {
                    aFavor = afEl.GetString() ?? "";
                }
                else if (afEl.ValueKind == JsonValueKind.Array)
                {
                    var parts = new List<string>();
                    foreach (var arg in afEl.EnumerateArray())
                    {
                        var val = arg.GetString()?.Trim();
                        if (!string.IsNullOrWhiteSpace(val)) parts.Add(val);
                    }
                    aFavor = string.Join(" ", parts);
                }
            }

            if (string.IsNullOrWhiteSpace(aFavor)) continue;

            var aFavorLower = aFavor.ToLowerInvariant();

            // Check for fabricated physical exam findings
            foreach (var examTerm in physicalExamTerms)
            {
                if (!aFavorLower.Contains(examTerm)) continue;

                // The physical exam term is mentioned in the argument — check if it was in the transcript
                if (!transcriptLower.Contains(examTerm))
                {
                    issues.Add($"CRÍTICO: Argumento fabricado na hipótese '{hipotese}' — '{examTerm}' não presente no transcript.");
                    break; // One fabricated finding per hypothesis is enough
                }
            }

            // General grounding check: arguments should have some basis in transcript
            var argWords = aFavorLower.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length > 3)
                .ToArray();

            if (argWords.Length > 0)
            {
                var foundInTranscript = argWords.Count(w => transcriptLower.Contains(w));
                var ratio = (double)foundInTranscript / argWords.Length;

                // Check for specific clinical findings patterns ("exame físico mostra...", "ao exame...")
                var clinicalFindingPatterns = new[]
                {
                    "exame físico mostra", "exame fisico mostra",
                    "ao exame físico", "ao exame fisico",
                    "exame físico revela", "exame fisico revela",
                    "exame físico evidencia", "exame fisico evidencia",
                    "achado ao exame", "achados ao exame"
                };

                var hasFabricatedFindings = clinicalFindingPatterns.Any(p =>
                    aFavorLower.Contains(p) && !transcriptLower.Contains(p));

                if (hasFabricatedFindings)
                    issues.Add($"CRÍTICO: Argumento fabricado na hipótese '{hipotese}' — achados de exame físico não presentes no transcript.");
            }
        }

        return issues;
    }
}

/// <summary>Relatório de grounding: transcript vs anamnese.</summary>
public record GroundingReport(
    bool IsGrounded,
    double Score,
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
