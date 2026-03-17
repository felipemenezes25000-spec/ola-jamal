using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// Static helpers for parsing and processing AI JSON responses for anamnesis.
/// </summary>
internal static class AnamnesisResponseParser
{
    internal static readonly Regex CidCodeRegex = new(@"\b([A-Z]\d{2}(?:\.\d+)?)\b", RegexOptions.Compiled);

    internal static void EnsurePerguntasFallback(JsonElement root, Dictionary<string, object> enrichedObj, string? transcriptSoFar)
    {
        var hasPerguntas = false;
        if (root.TryGetProperty("perguntas_sugeridas", out var pEl) && pEl.ValueKind == JsonValueKind.Array && pEl.GetArrayLength() > 0)
            hasPerguntas = true;

        if (hasPerguntas) return;

        var isEarlyConsultation = string.IsNullOrWhiteSpace(transcriptSoFar) || transcriptSoFar!.Length < 200;
        List<object> fallback;

        if (isEarlyConsultation)
        {
            fallback = new List<object>
            {
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Qual é a sua queixa principal? O que está sentindo?",
                    ["objetivo"] = "Identificar motivo da consulta para direcionar anamnese",
                    ["hipoteses_afetadas"] = "Define o eixo diagnóstico principal",
                    ["impacto_na_conduta"] = "Determina toda a linha de investigação subsequente",
                    ["prioridade"] = "alta"
                },
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Há quanto tempo está com isso? Começou de repente ou foi piorando aos poucos?",
                    ["objetivo"] = "Estabelecer cronologia — agudo vs crônico muda a conduta",
                    ["hipoteses_afetadas"] = "Agudo favorece infecção/trauma; crônico favorece degenerativo/metabólico",
                    ["impacto_na_conduta"] = "Agudo pode requerer urgência; crônico permite investigação programada",
                    ["prioridade"] = "alta"
                },
                new Dictionary<string, string>
                {
                    ["pergunta"] = "De 0 a 10, qual a intensidade do que está sentindo? Interfere nas suas atividades do dia a dia?",
                    ["objetivo"] = "Quantificar gravidade (EVA) e impacto funcional",
                    ["hipoteses_afetadas"] = "Intensidade alta sugere investigação urgente",
                    ["impacto_na_conduta"] = "EVA ≥7 pode indicar analgesia mais potente e exames de imagem",
                    ["prioridade"] = "alta"
                },
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Está tomando algum remédio atualmente? Qual, dose e há quanto tempo?",
                    ["objetivo"] = "Mapear farmacoterapia atual para avaliar interações e ajustes",
                    ["hipoteses_afetadas"] = "Medicamentos em uso influenciam diagnóstico diferencial e prescrição",
                    ["impacto_na_conduta"] = "Evita interações medicamentosas e duplicações terapêuticas",
                    ["prioridade"] = "media"
                },
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Tem alergia a algum medicamento, alimento ou substância?",
                    ["objetivo"] = "Prevenir reações adversas na prescrição",
                    ["hipoteses_afetadas"] = "Restringe opções farmacológicas",
                    ["impacto_na_conduta"] = "Muda escolha do medicamento (ex: alergia penicilina → macrolídeo)",
                    ["prioridade"] = "media"
                }
            };
        }
        else
        {
            fallback = new List<object>
            {
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Além do que já me contou, tem sentido mais algum sintoma que não mencionou?",
                    ["objetivo"] = "Capturar sintomas não relatados espontaneamente",
                    ["hipoteses_afetadas"] = "Novos sintomas podem alterar diagnóstico diferencial",
                    ["impacto_na_conduta"] = "Pode revelar red flags ou alterar a hipótese principal",
                    ["prioridade"] = "media"
                },
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Já teve algum episódio parecido antes? Precisou ir ao hospital?",
                    ["objetivo"] = "Identificar recorrência e gravidade prévia",
                    ["hipoteses_afetadas"] = "Recorrência sugere doença crônica; hospitalização prévia indica gravidade",
                    ["impacto_na_conduta"] = "Recorrência pode indicar necessidade de investigação mais profunda",
                    ["prioridade"] = "media"
                },
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Na sua família, alguém tem problemas de saúde crônicos como diabetes, pressão alta ou câncer?",
                    ["objetivo"] = "Avaliar predisposição genética/familiar",
                    ["hipoteses_afetadas"] = "Antecedentes familiares alteram probabilidade de várias hipóteses",
                    ["impacto_na_conduta"] = "Pode indicar rastreamento precoce ou exames adicionais",
                    ["prioridade"] = "baixa"
                },
                new Dictionary<string, string>
                {
                    ["pergunta"] = "Está dormindo bem? Sentiu mudanças no apetite, humor ou energia ultimamente?",
                    ["objetivo"] = "Rastrear componente psicossomático/psiquiátrico",
                    ["hipoteses_afetadas"] = "Alterações sugerem depressão, ansiedade ou doença sistêmica",
                    ["impacto_na_conduta"] = "Pode adicionar abordagem psiquiátrica/psicológica ao plano",
                    ["prioridade"] = "baixa"
                }
            };
        }

        enrichedObj["perguntas_sugeridas"] = JsonSerializer.Serialize(fallback, JsonOptionsSnakeCase);
    }

    internal static void EnsureSuggestionsFallback(JsonElement root, Dictionary<string, object> enrichedObj, bool hasClinicalContext)
    {
        var hasSuggestions = false;
        if (root.TryGetProperty("suggestions", out var sEl) && sEl.ValueKind == JsonValueKind.Array && sEl.GetArrayLength() > 0)
            hasSuggestions = true;

        if (hasSuggestions) return;

        var fallbackSuggestions = hasClinicalContext
            ? new List<string>
            {
                "Avaliação inicial realizada — refinar hipótese diagnóstica com exames complementares.",
                "Solicitar exames laboratoriais básicos para diagnóstico diferencial.",
                "Enquanto aguarda os exames: orientar manejo sintomático (repouso, hidratação, analgesia conforme sintomas). Retorno se piora.",
                "Reavaliar em 7-14 dias ou antes se piora dos sintomas."
            }
            : new List<string>
            {
                "Avaliação inicial — aguardando mais dados da anamnese para refinar HD e conduta.",
                "Continuar coleta de dados: queixa, duração, intensidade, medicamentos em uso, alergias.",
                "Sugestões completas serão geradas conforme a consulta evolui."
            };

        enrichedObj["suggestions_fallback"] = JsonSerializer.Serialize(fallbackSuggestions, JsonOptionsSnakeCase);
    }

    /// <summary>
    /// Valida coerência: cid_sugerido DEVE estar em diagnostico_diferencial.
    /// REGRA PRINCIPAL: Se diagnostico_diferencial tem itens, SEMPRE usar o primeiro "alta" como cid_sugerido.
    /// A IA frequentemente erra em cid_sugerido (ex: F10.2) mas acerta no diagnostico_diferencial.
    /// </summary>
    internal static string EnsureCidCoherentWithDifferential(JsonElement root, string cidRaw, ILogger? logger = null, string? transcript = null)
    {
        var transcriptLower = transcript?.ToLowerInvariant() ?? "";

        // ═══ REGRA PRINCIPAL: Priorizar SEMPRE o diagnostico_diferencial sobre cid_sugerido ═══
        // O diferencial é consistente; cid_sugerido da IA falha recorrentemente (F10.2, etc).
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

        // ═══ CAMADA 1: HARD BLOCK de categorias CID alucinadas ═══
        // A IA alucina CIDs de categorias que não tem suporte no transcript.
        // Cada bloco verifica se o transcript menciona palavras-chave da categoria.

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
            // Exceção: "nega etilismo", "nega tabagismo" etc. CONFIRMA que NÃO é o CID
            var negaPattern = keywords.Any(kw => transcriptLower.Contains($"nega {kw}") || transcriptLower.Contains($"não {kw}") || transcriptLower.Contains($"nao {kw}"));
            if (negaPattern) hasContext = false;

            if (!hasContext)
            {
                logger?.LogWarning("[Anamnese] BLOQUEADO CID {Prefix}.x alucinado: {CidRaw} — transcript não menciona {Category}.", prefix, cidRaw, category);
                return GetFallbackCidFromDifferential(root, prefix, logger);
            }
        }

        // ═══ CAMADA 2: CID vs raciocínio clínico ═══
        // Se o raciocínio clínico menciona um diagnóstico diferente do CID, algo está errado.
        var raciocinio = root.TryGetProperty("raciocinio_clinico", out var racEl) ? racEl.GetString()?.ToLowerInvariant() ?? "" : "";
        if (!string.IsNullOrWhiteSpace(raciocinio))
        {
            var cidDesc = root.TryGetProperty("cid_descricao", out var descEl) ? descEl.GetString()?.ToLowerInvariant() ?? "" : "";
            // Se o raciocínio menciona Ehlers-Danlos mas o CID é F10, algo está muito errado
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

        // ═══ CAMADA 3: CID deve estar no diagnóstico diferencial ═══
        var differentialCids = GetCidsFromDiagnosticoDiferencial(root);
        if (differentialCids.Count == 0) return cidRaw;

        var cidInDifferential = differentialCids.Any(dd =>
            string.Equals(ExtractCidCode(dd.cid), cidCode, StringComparison.OrdinalIgnoreCase));

        if (cidInDifferential) return cidRaw;

        // CID não está no diferencial — substituir
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

        // Sempre a hipótese com maior probabilidade: percentual ou alta > media > baixa.
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
        // Buscar em root e em anamnesis (a IA pode retornar em estrutura diferente)
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

        // Add alerts to suggestions for backwards compat
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
        // Mensagem honesta quando ainda não há dados: manter
        if (!hasClinicalContext && lower.Contains("dados iniciais") && lower.Contains("continuar anamnese")) return false;

        // Frases 100% genéricas sem conteúdo clínico
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

        // Se já temos contexto clínico, não enviar "aguardando mais dados" sem nada concreto
        if (hasClinicalContext && (lower.Contains("aguardando mais dados") || lower.Contains("aguardando mais dados da anamnese")) && !HasConcreteClinicalContent(t))
            return true;

        return false;
    }

    private static bool HasConcreteClinicalContent(string text)
    {
        // Dose em mg
        if (Regex.IsMatch(text, @"\d+\s*mg|\d+\s*ml|\d+mg")) return true;
        // Posologia
        if (Regex.IsMatch(text, @"\d+/\d+\s*h|\d+\s*em\s*\d+\s*horas|de\s*\d+\s*em\s*\d+")) return true;
        // CID
        if (CidCodeRegex.IsMatch(text)) return true;
        // Exames comuns
        if (Regex.IsMatch(text, @"hemograma|PCR|proteína\s*c[- ]?reativa|creatinina|glicemia|sorologia|raio|ecg|ultrassom|tomografia|tsh|t4", RegexOptions.IgnoreCase)) return true;
        // Medicamentos / via
        if (Regex.IsMatch(text, @"(paracetamol|dipirona|ibuprofeno|amoxicilina|azitromicina|losartana|omeprazol|comprimido|cp\.?|VO|oral)", RegexOptions.IgnoreCase)) return true;
        // Diagnóstico/hipótese (palavra com 4+ letras que parece termo clínico)
        if (Regex.IsMatch(text, @"\b(toxoplasmose|mononucleose|gripal|infeccioso|bacteriano|viral|sinusite|otite|amigdalite|pneumonia|bronquite|rinite)\b", RegexOptions.IgnoreCase)) return true;
        return false;
    }

    internal static string ParseMedicamentosSugeridosV2(JsonElement root, bool hasClinicalContext)
    {
        var medsList = new List<Dictionary<string, object>>();
        if (root.TryGetProperty("medicamentos_sugeridos", out var msEl) && msEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in msEl.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Object)
                {
                    medsList.Add(new Dictionary<string, object>
                    {
                        ["nome"] = GetStr(item, "nome"),
                        ["classe_terapeutica"] = GetStr(item, "classe_terapeutica"),
                        ["dose"] = GetStr(item, "dose"),
                        ["via"] = GetStr(item, "via"),
                        ["posologia"] = GetStr(item, "posologia"),
                        ["duracao"] = GetStr(item, "duracao"),
                        ["indicacao"] = GetStr(item, "indicacao"),
                        ["melhora_esperada"] = GetStr(item, "melhora_esperada"),
                        ["contraindicacoes"] = GetStr(item, "contraindicacoes"),
                        ["interacoes"] = GetStr(item, "interacoes"),
                        ["mecanismo_acao"] = GetStr(item, "mecanismo_acao"),
                        ["ajuste_renal"] = GetStr(item, "ajuste_renal"),
                        ["ajuste_hepatico"] = GetStr(item, "ajuste_hepatico"),
                        ["alerta_faixa_etaria"] = GetStr(item, "alerta_faixa_etaria"),
                        ["alternativa"] = GetStr(item, "alternativa")
                    });
                }
                else
                {
                    var str = item.ValueKind == JsonValueKind.String ? item.GetString() : item.GetRawText()?.Trim('"');
                    if (!string.IsNullOrWhiteSpace(str))
                        medsList.Add(new Dictionary<string, object>
                        {
                            ["nome"] = str.Trim(), ["classe_terapeutica"] = "", ["dose"] = "",
                            ["via"] = "",                             ["posologia"] = "", ["duracao"] = "", ["indicacao"] = "",
                            ["melhora_esperada"] = "", ["contraindicacoes"] = "", ["interacoes"] = "", ["mecanismo_acao"] = "",
                            ["ajuste_renal"] = "", ["ajuste_hepatico"] = "",
                            ["alerta_faixa_etaria"] = "", ["alternativa"] = ""
                        });
                }
            }
        }

        if (medsList.Count == 0 && hasClinicalContext)
        {
            // Fallback mínimo: 3 medicamentos sintomáticos básicos
            medsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Paracetamol 750mg", ["classe_terapeutica"] = "Analgésico/Antitérmico",
                ["dose"] = "750mg", ["via"] = "VO", ["posologia"] = "1 comprimido de 6 em 6 horas se dor ou febre",
                ["duracao"] = "5-7 dias", ["indicacao"] = "Analgesia e controle de febre — sintomático",
                ["melhora_esperada"] = "Alívio de dor/febre em 30-60 minutos",
                ["contraindicacoes"] = "Insuficiência hepática grave", ["interacoes"] = "Evitar uso concomitante com álcool",
                ["mecanismo_acao"] = "Inibição central da COX e ação no centro termorregulador hipotalâmico",
                ["ajuste_renal"] = "", ["ajuste_hepatico"] = "Contraindicado em hepatopata grave",
                ["alerta_faixa_etaria"] = "Ajustar dose em idosos", ["alternativa"] = "Dipirona 500mg 1cp 6/6h"
            });
            medsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Dipirona 500mg", ["classe_terapeutica"] = "Analgésico/Antitérmico/Espasmolítico",
                ["dose"] = "500-1000mg", ["via"] = "VO", ["posologia"] = "1-2 comprimidos de 6 em 6 horas se dor intensa",
                ["duracao"] = "3-5 dias", ["indicacao"] = "Dor moderada a intensa e febre refratária a paracetamol",
                ["melhora_esperada"] = "Alívio em 20-40 minutos",
                ["contraindicacoes"] = "Discrasias sanguíneas, deficiência de G6PD",
                ["interacoes"] = "Pode potencializar efeito de anticoagulantes",
                ["mecanismo_acao"] = "Inibição da COX periférica e central com ação espasmolítica",
                ["ajuste_renal"] = "Evitar em IR grave", ["ajuste_hepatico"] = "",
                ["alerta_faixa_etaria"] = "Contraindicado em < 3 meses", ["alternativa"] = "Ibuprofeno 400mg 8/8h"
            });
            medsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Avaliar necessidade de prescrição etiológica conforme evolução clínica",
                ["classe_terapeutica"] = "", ["dose"] = "", ["via"] = "", ["posologia"] = "",
                ["duracao"] = "", ["indicacao"] = "Aguardando mais dados da anamnese para definir tratamento etiológico",
                ["contraindicacoes"] = "", ["interacoes"] = "", ["mecanismo_acao"] = "",
                ["ajuste_renal"] = "", ["ajuste_hepatico"] = "",
                ["alerta_faixa_etaria"] = "", ["alternativa"] = ""
            });
        }

        return medsList.Count == 0 ? "[]" : JsonSerializer.Serialize(medsList, JsonOptionsSnakeCase);
    }

    internal static string ParseExamesSugeridosV2(JsonElement root, bool hasClinicalContext)
    {
        var examsList = new List<Dictionary<string, object>>();
        if (root.TryGetProperty("exames_sugeridos", out var exEl) && exEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in exEl.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Object)
                {
                    examsList.Add(new Dictionary<string, object>
                    {
                        ["nome"] = GetStr(item, "nome"),
                        ["codigo_tuss"] = GetStr(item, "codigo_tuss"),
                        ["descricao"] = GetStr(item, "descricao"),
                        ["o_que_afere"] = GetStr(item, "o_que_afere"),
                        ["indicacao"] = GetStr(item, "indicacao"),
                        ["interpretacao_esperada"] = GetStr(item, "interpretacao_esperada"),
                        ["preparo_paciente"] = GetStr(item, "preparo_paciente"),
                        ["prazo_resultado"] = GetStr(item, "prazo_resultado"),
                        ["urgencia"] = GetStr(item, "urgencia")
                    });
                }
                else
                {
                    var str = item.ValueKind == JsonValueKind.String ? item.GetString() : item.GetRawText()?.Trim('"');
                    if (!string.IsNullOrWhiteSpace(str))
                        examsList.Add(new Dictionary<string, object>
                        {
                            ["nome"] = str.Trim(), ["codigo_tuss"] = "", ["descricao"] = "",
                            ["o_que_afere"] = "", ["indicacao"] = "", ["interpretacao_esperada"] = "",
                            ["preparo_paciente"] = "", ["prazo_resultado"] = "", ["urgencia"] = "rotina"
                        });
                }
            }
        }

        if (examsList.Count == 0 && hasClinicalContext)
        {
            // Fallback mínimo: 4 exames básicos de triagem
            examsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Hemograma completo com contagem de plaquetas",
                ["codigo_tuss"] = "40304361",
                ["descricao"] = "Contagem de séries vermelha, branca e plaquetária",
                ["o_que_afere"] = "Anemia, infecção, inflamação, distúrbios hematológicos",
                ["indicacao"] = "Avaliação inicial — rastreia infecção, anemia e processo inflamatório",
                ["interpretacao_esperada"] = "Leucocitose com desvio à esquerda sugere infecção bacteriana; anemia pode indicar doença crônica",
                ["preparo_paciente"] = "Jejum de 4 horas recomendado",
                ["prazo_resultado"] = "24-48h",
                ["urgencia"] = "rotina"
            });
            examsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Proteína C-Reativa (PCR) quantitativa",
                ["codigo_tuss"] = "40308073",
                ["descricao"] = "Marcador de fase aguda — quantifica processo inflamatório/infeccioso",
                ["o_que_afere"] = "Intensidade do processo inflamatório sistêmico",
                ["indicacao"] = "Complementar hemograma para avaliar gravidade do quadro inflamatório/infeccioso",
                ["interpretacao_esperada"] = "PCR >10mg/L sugere infecção bacteriana; >100mg/L sugere infecção grave",
                ["preparo_paciente"] = "Jejum de 4 horas",
                ["prazo_resultado"] = "24h",
                ["urgencia"] = "rotina"
            });
            examsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Glicemia de jejum",
                ["codigo_tuss"] = "40302040",
                ["descricao"] = "Dosagem de glicose sérica em jejum",
                ["o_que_afere"] = "Controle glicêmico, rastreio de diabetes",
                ["indicacao"] = "Rastreio metabólico básico — relevante para ajuste de medicações",
                ["interpretacao_esperada"] = "Normal: 70-99 mg/dL; pré-diabetes: 100-125; diabetes: ≥126",
                ["preparo_paciente"] = "Jejum de 8-12 horas",
                ["prazo_resultado"] = "24h",
                ["urgencia"] = "rotina"
            });
            examsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Ureia e Creatinina séricas",
                ["codigo_tuss"] = "40301630",
                ["descricao"] = "Avaliação da função renal",
                ["o_que_afere"] = "Taxa de filtração glomerular estimada, função renal",
                ["indicacao"] = "Essencial para ajuste de dose de medicamentos e avaliação da função renal",
                ["interpretacao_esperada"] = "Creatinina normal: 0.7-1.3 mg/dL; elevação sugere nefropatia e necessidade de ajuste posológico",
                ["preparo_paciente"] = "Jejum de 4 horas",
                ["prazo_resultado"] = "24h",
                ["urgencia"] = "rotina"
            });
        }

        return examsList.Count == 0 ? "[]" : JsonSerializer.Serialize(examsList, JsonOptionsSnakeCase);
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
        // Remove markdown code blocks (Gemini às vezes envolve em ```json)
        if (s.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            s = s["```json".Length..].TrimStart();
        else if (s.StartsWith("```"))
            s = s["```".Length..].TrimStart();
        if (s.EndsWith("```"))
            s = s[..^3].TrimEnd();
        s = s.Trim();
        // Se há texto antes do JSON (ex: "Aqui está: {...}"), extrai o objeto. Conta chaves ignorando as dentro de strings JSON.
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

    internal static List<string> ExtractSearchTerms(JsonElement root)
    {
        var terms = new List<string>();

        if (root.TryGetProperty("cid_sugerido", out var cidEl))
        {
            var cidStr = cidEl.GetString() ?? "";
            var match = CidCodeRegex.Match(cidStr);
            if (match.Success)
                terms.Add(match.Groups[1].Value);
            // Also add the text description for better search
            var descPart = cidStr.Contains('-') ? cidStr.Split('-', 2)[1].Trim() : "";
            if (descPart.Length > 10)
                terms.Add(descPart[..Math.Min(60, descPart.Length)]);
        }

        // Add differential diagnosis terms for richer evidence
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
        if (root.TryGetProperty("anamnesis", out var anaEl) && anaEl.ValueKind == JsonValueKind.Object)
        {
            if (anaEl.TryGetProperty("queixa_principal", out var qpEl))
            {
                var qp = (qpEl.ValueKind == JsonValueKind.String ? qpEl.GetString() : qpEl.GetRawText())?.Trim('"').Trim() ?? "";
                if (!string.IsNullOrEmpty(qp))
                    parts.Add($"Queixa principal: {qp}");
            }
            if (anaEl.TryGetProperty("sintomas", out var sintEl))
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

    // Internal JsonSerializerOptions matching the main service's JsonOptions
    private static readonly JsonSerializerOptions JsonOptionsSnakeCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = false
    };
}
