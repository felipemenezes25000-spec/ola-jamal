using System.Text.Json;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>Serialização de medicamentos e exames sugeridos (incl. fallbacks mínimos).</summary>
internal static partial class AnamnesisResponseParser
{
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
}
