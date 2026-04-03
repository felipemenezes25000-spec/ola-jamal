using System.Text.Json;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>Fallbacks de perguntas e sugestões quando a IA retorna arrays vazios.</summary>
internal static partial class AnamnesisResponseParser
{
    internal static void EnsurePerguntasFallback(JsonElement root, Dictionary<string, object> enrichedObj, string? transcriptSoFar, string? consultationType = null)
    {
        var hasPerguntas = false;
        if (root.TryGetProperty("perguntas_sugeridas", out var pEl) && pEl.ValueKind == JsonValueKind.Array && pEl.GetArrayLength() > 0)
            hasPerguntas = true;

        if (hasPerguntas) return;

        var isPsy = string.Equals(consultationType, "psicologo", StringComparison.OrdinalIgnoreCase);
        var isEarlyConsultation = string.IsNullOrWhiteSpace(transcriptSoFar) || transcriptSoFar!.Length < 200;
        List<object> fallback;

        if (isPsy)
        {
            fallback = isEarlyConsultation
                ? new List<object>
                {
                    new Dictionary<string, string>
                    {
                        ["pergunta"] = "O que te motivou a buscar atendimento neste momento?",
                        ["objetivo"] = "Compreender a demanda manifesta e o contexto que levou à busca",
                        ["hipoteses_afetadas"] = "Define o eixo da formulação do caso",
                        ["impacto_na_conduta"] = "Direciona a abordagem terapêutica inicial",
                        ["prioridade"] = "alta"
                    },
                    new Dictionary<string, string>
                    {
                        ["pergunta"] = "Como você tem se sentido nos últimos dias?",
                        ["objetivo"] = "Avaliar estado emocional atual — humor, afeto, nível de angústia",
                        ["hipoteses_afetadas"] = "Humor rebaixado sugere quadro depressivo; inquietação sugere ansiedade",
                        ["impacto_na_conduta"] = "Define urgência e intensidade do acompanhamento",
                        ["prioridade"] = "alta"
                    },
                    new Dictionary<string, string>
                    {
                        ["pergunta"] = "Tem algo acontecendo agora que esteja te sobrecarregando mais?",
                        ["objetivo"] = "Identificar fatores estressores e gatilhos atuais",
                        ["hipoteses_afetadas"] = "Estressores recentes sugerem crise adaptativa vs quadro crônico",
                        ["impacto_na_conduta"] = "Orienta foco da intervenção (manejo de crise vs trabalho processual)",
                        ["prioridade"] = "alta"
                    },
                    new Dictionary<string, string>
                    {
                        ["pergunta"] = "Como estão seu sono, apetite e energia?",
                        ["objetivo"] = "Rastrear impacto funcional e sinais neurovegetativos",
                        ["hipoteses_afetadas"] = "Alterações de sono/apetite/energia reforçam hipóteses de depressão ou ansiedade",
                        ["impacto_na_conduta"] = "Pode indicar encaminhamento psiquiátrico se graves",
                        ["prioridade"] = "media"
                    },
                    new Dictionary<string, string>
                    {
                        ["pergunta"] = "Você sente que tem com quem contar? Como estão suas relações?",
                        ["objetivo"] = "Avaliar rede de apoio e isolamento social",
                        ["hipoteses_afetadas"] = "Isolamento severo é fator de risco para agravamento",
                        ["impacto_na_conduta"] = "Pode indicar necessidade de rede de apoio ou acompanhamento mais frequente",
                        ["prioridade"] = "media"
                    }
                }
                : new List<object>
                {
                    new Dictionary<string, string>
                    {
                        ["pergunta"] = "O que mais tem te incomodado emocionalmente desde que começamos a conversar?",
                        ["objetivo"] = "Aprofundar a queixa principal e captar demanda latente",
                        ["hipoteses_afetadas"] = "Pode revelar questões não trazidas espontaneamente",
                        ["impacto_na_conduta"] = "Refina o foco terapêutico da sessão",
                        ["prioridade"] = "alta"
                    },
                    new Dictionary<string, string>
                    {
                        ["pergunta"] = "Em quais momentos isso costuma piorar?",
                        ["objetivo"] = "Identificar gatilhos e padrões situacionais",
                        ["hipoteses_afetadas"] = "Gatilhos situacionais sugerem abordagem comportamental; interpessoais sugerem trabalho relacional",
                        ["impacto_na_conduta"] = "Direciona técnicas terapêuticas específicas",
                        ["prioridade"] = "media"
                    },
                    new Dictionary<string, string>
                    {
                        ["pergunta"] = "Já fez terapia antes? Como foi essa experiência?",
                        ["objetivo"] = "Mapear histórico terapêutico e expectativas",
                        ["hipoteses_afetadas"] = "Experiência anterior influencia a escolha de abordagem",
                        ["impacto_na_conduta"] = "Adapta linguagem e técnica ao que o paciente já conhece",
                        ["prioridade"] = "media"
                    },
                    new Dictionary<string, string>
                    {
                        ["pergunta"] = "Em algum momento você sentiu que não daria conta?",
                        ["objetivo"] = "Rastreio de risco — avaliar desesperança e ideação suicida",
                        ["hipoteses_afetadas"] = "Resposta positiva eleva classificação de gravidade",
                        ["impacto_na_conduta"] = "Pode indicar encaminhamento psiquiátrico ou protocolo de segurança",
                        ["prioridade"] = "alta"
                    }
                };
        }
        else if (isEarlyConsultation)
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
}
