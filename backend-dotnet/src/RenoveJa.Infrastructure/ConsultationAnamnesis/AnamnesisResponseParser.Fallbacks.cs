using System.Text.Json;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>Fallbacks de perguntas e sugestões quando a IA retorna arrays vazios.</summary>
internal static partial class AnamnesisResponseParser
{
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
}
