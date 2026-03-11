using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Consultation;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Domain.ValueObjects;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// Serviço de anamnese estruturada e sugestões clínicas por IA (GPT-4o) durante a consulta.
/// v2: Prompt enriquecido com diagnóstico diferencial, CID-10 validado, medicamentos com
/// interações/contraindicações, exames com código TUSS, classificação de gravidade,
/// orientações ao paciente e critérios de retorno.
/// Atua como copiloto: a decisão final é sempre do médico.
/// </summary>
public class ConsultationAnamnesisService : IConsultationAnamnesisService
{
    private const string ApiBaseUrl = "https://api.openai.com/v1";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = false
    };
    private static readonly Regex CidCodeRegex = new(@"\b([A-Z]\d{2}(?:\.\d+)?)\b", RegexOptions.Compiled);

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<OpenAIConfig> _config;
    private readonly ILogger<ConsultationAnamnesisService> _logger;
    private readonly IEvidenceSearchService _evidenceSearchService;
    private readonly IAiInteractionLogRepository _aiInteractionLogRepository;

    public ConsultationAnamnesisService(
        IHttpClientFactory httpClientFactory,
        IOptions<OpenAIConfig> config,
        ILogger<ConsultationAnamnesisService> logger,
        IEvidenceSearchService evidenceSearchService,
        IAiInteractionLogRepository aiInteractionLogRepository)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
        _evidenceSearchService = evidenceSearchService;
        _aiInteractionLogRepository = aiInteractionLogRepository;
    }

    private string GetAnamnesisModel()
    {
        var specific = _config.Value?.ModelAnamnesis?.Trim();
        if (!string.IsNullOrEmpty(specific)) return specific;
        return _config.Value?.Model ?? "gpt-4o";
    }

    private string GetEvidenceModel()
    {
        var specific = _config.Value?.ModelEvidence?.Trim();
        if (!string.IsNullOrEmpty(specific)) return specific;
        return _config.Value?.Model ?? "gpt-4o";
    }

    public async Task<ConsultationAnamnesisResult?> UpdateAnamnesisAndSuggestionsAsync(
        string transcriptSoFar,
        string? previousAnamnesisJson,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[Anamnese IA v2] INICIO transcriptLen={Len} previousAnamnesisLen={PrevLen}",
            transcriptSoFar?.Length ?? 0, previousAnamnesisJson?.Length ?? 0);

        var apiKey = _config.Value?.ApiKey?.Trim();
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("[Anamnese IA v2] ANAMNESE_NAO_OCORRE: OpenAI:ApiKey não configurada.");
            return null;
        }

        if (string.IsNullOrWhiteSpace(transcriptSoFar))
        {
            _logger.LogWarning("[Anamnese IA v2] ANAMNESE_NAO_OCORRE: Transcript vazio ou nulo.");
            return null;
        }

        var systemPrompt = BuildSystemPromptV2();

        var userContent = string.IsNullOrWhiteSpace(previousAnamnesisJson)
            ? $"Transcript da consulta (incluindo identificação de locutor quando disponível):\n\n{transcriptSoFar}"
            : $"Anamnese anterior (mantenha e enriqueça com novas informações do transcript):\n{previousAnamnesisJson}\n\nTranscript atualizado:\n{transcriptSoFar}";

        var anamnesisModel = GetAnamnesisModel();
        var requestBody = new
        {
            model = anamnesisModel,
            messages = new object[]
            {
                new { role = "system", content = (object)systemPrompt },
                new { role = "user", content = (object)userContent }
            },
            max_tokens = 4500,
            temperature = 0.12
        };

        var startedAt = DateTime.UtcNow;
        var json = JsonSerializer.Serialize(requestBody, JsonOptions);
        var promptHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json))).ToLowerInvariant();
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        client.Timeout = TimeSpan.FromSeconds(50);

        using var requestContent = new StringContent(json, Encoding.UTF8, "application/json");
        _logger.LogInformation("[Anamnese IA v2] Chamando OpenAI: model={Model} (anamnese)",
            anamnesisModel);

        var response = await client.PostAsync($"{ApiBaseUrl}/chat/completions", requestContent, cancellationToken);
        var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("[Anamnese IA v2] OpenAI error StatusCode={StatusCode} model={Model}", response.StatusCode, anamnesisModel);
            try
            {
                await _aiInteractionLogRepository.LogAsync(AiInteractionLog.Create(
                    serviceName: nameof(ConsultationAnamnesisService),
                    modelName: anamnesisModel,
                    promptHash: promptHash,
                    success: false,
                    durationMs: (long)(DateTime.UtcNow - startedAt).TotalMilliseconds,
                    errorMessage: responseJson.Length > 500 ? responseJson[..500] : responseJson), cancellationToken);
            }
            catch (Exception logEx)
            {
                _logger.LogWarning(logEx, "[Anamnese IA v2] Falha ao gravar log de erro.");
            }
            return null;
        }

        string? content = null;
        try
        {
            using var doc = JsonDocument.Parse(responseJson);
            var choices = doc.RootElement.GetProperty("choices");
            if (choices.GetArrayLength() > 0)
                content = choices[0].GetProperty("message").GetProperty("content").GetString();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Anamnese IA v2] Falha ao extrair content da resposta OpenAI.");
            return null;
        }

        if (string.IsNullOrWhiteSpace(content))
        {
            _logger.LogWarning("[Anamnese IA v2] OpenAI retornou content vazio.");
            return null;
        }

        var cleaned = CleanJsonResponse(content);
        try
        {
            using var parsed = JsonDocument.Parse(cleaned);
            var root = parsed.RootElement;

            // Build enriched anamnesis JSON for frontend
            var enrichedObj = new Dictionary<string, object>();

            // Copy all anamnesis fields
            if (root.TryGetProperty("anamnesis", out var anaEl) && anaEl.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in anaEl.EnumerateObject())
                    enrichedObj[prop.Name] = prop.Value.GetRawText();
            }

            // Top-level fields (CID validado contra base local ICD/CID-10)
            var cidRaw = root.TryGetProperty("cid_sugerido", out var cidEl) ? cidEl.GetString()?.Trim() ?? "" : "";
            if (!string.IsNullOrEmpty(cidRaw))
            {
                var cidValidado = Cid10Database.IsValid(cidRaw)
                    ? cidRaw
                    : Cid10Database.Search(cidRaw, 1).FirstOrDefault()?.Code ?? cidRaw;
                enrichedObj["cid_sugerido"] = JsonSerializer.Serialize(cidValidado);
                if (Cid10Database.GetDescription(cidValidado) is { } desc)
                    enrichedObj["cid_descricao"] = JsonSerializer.Serialize(desc);
            }
            else
            {
                CopyIfExists(root, enrichedObj, "cid_sugerido");
            }
            CopyIfExists(root, enrichedObj, "confianca_cid");
            CopyArrayIfExists(root, enrichedObj, "alertas_vermelhos");
            CopyArrayIfExists(root, enrichedObj, "diagnostico_diferencial");
            CopyIfExists(root, enrichedObj, "classificacao_gravidade");
            CopyIfExists(root, enrichedObj, "exame_fisico_dirigido");
            CopyArrayIfExists(root, enrichedObj, "orientacoes_paciente");
            CopyArrayIfExists(root, enrichedObj, "criterios_retorno");
            CopyArrayIfExists(root, enrichedObj, "perguntas_sugeridas");
            CopyArrayIfExists(root, enrichedObj, "lacunas_anamnese");

            // Medicamentos, exames e interações cruzadas
            var hasClinicalContext = HasClinicalContext(root);
            var medicamentosRaw = ParseMedicamentosSugeridosV2(root, hasClinicalContext);
            enrichedObj["medicamentos_sugeridos"] = medicamentosRaw;

            var examesRaw = ParseExamesSugeridosV2(root, hasClinicalContext);
            enrichedObj["exames_sugeridos"] = examesRaw;

            CopyArrayIfExists(root, enrichedObj, "interacoes_cruzadas");

            // ═══ FALLBACKS: garantir que dados nunca fiquem vazios ═══
            EnsurePerguntasFallback(root, enrichedObj, transcriptSoFar);
            EnsureSuggestionsFallback(root, enrichedObj, hasClinicalContext);

            var enrichedJson = "{" + string.Join(",", enrichedObj.Select(kv => $"\"{kv.Key}\":{kv.Value}")) + "}";

            // Extract suggestions list — SEMPRE retornar algo (fallback garante sugestões funcionarem sempre)
            var suggestions = ExtractSuggestions(root);
            if (suggestions.Count == 0 && enrichedObj.TryGetValue("suggestions_fallback", out var fbVal))
            {
                try
                {
                    var fallback = JsonSerializer.Deserialize<List<string>>(fbVal.ToString() ?? "[]");
                    if (fallback?.Count > 0)
                        suggestions.AddRange(fallback);
                }
                catch { /* ignore */ }
            }
            if (suggestions.Count == 0)
            {
                suggestions.Add("Avaliação inicial — aguardando mais dados da anamnese para refinar HD e conduta.");
            }

            // Evidências científicas multi-fonte
            var evidence = await FetchAndTranslateEvidenceAsync(root, apiKey, cancellationToken, transcriptSoFar);

            try
            {
                await _aiInteractionLogRepository.LogAsync(AiInteractionLog.Create(
                    serviceName: nameof(ConsultationAnamnesisService),
                    modelName: anamnesisModel,
                    promptHash: promptHash,
                    success: true,
                    responseSummary: cleaned.Length > 500 ? cleaned[..500] : cleaned,
                    durationMs: (long)(DateTime.UtcNow - startedAt).TotalMilliseconds), cancellationToken);
            }
            catch (Exception logEx)
            {
                _logger.LogWarning(logEx, "[Anamnese IA v2] Falha ao gravar log.");
            }

            _logger.LogInformation("[Anamnese IA v2] SUCESSO: anamnesisLen={Len} suggestions={Count} evidence={EvidCount} durationMs={Ms}",
                enrichedJson.Length, suggestions.Count, evidence.Count, (long)(DateTime.UtcNow - startedAt).TotalMilliseconds);

            return new ConsultationAnamnesisResult(enrichedJson, suggestions, evidence);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Anamnese IA v2] Falha ao parsear JSON de resposta.");
            return null;
        }
    }

    /// <summary>
    /// Prompt v3: modelo híbrido com dados ultra-completos.
    /// Medicamentos 4-10, exames 4-12, perguntas 4-8, sugestões 3-7,
    /// interações cruzadas obrigatórias, CID mais específico possível.
    /// </summary>
    private static string BuildSystemPromptV2()
    {
        return """
Você é um COPILOTO CLÍNICO DE ELITE na plataforma RenoveJá+ (telemedicina brasileira).
Toda saída é APOIO À DECISÃO CLÍNICA — conduta final exclusiva do médico.
CFM Resolução 2.299/2021 e normas éticas vigentes.

O transcript contém linhas [Médico] e [Paciente].

Responda em um ÚNICO JSON válido, sem markdown, com EXATAMENTE estes campos:

{
  "anamnesis": {
    "queixa_principal": "Queixa e duração com localização, intensidade (EVA 0-10), caráter, irradiação. Seja PRECISO.",
    "historia_doenca_atual": "Evolução usando OPQRST (Onset, Provocation, Quality, Region, Severity, Time). Fatores de melhora/piora, tratamentos tentados, cronologia.",
    "sintomas": ["TODOS os sintomas em linguagem clínica, incluindo negativos relevantes ('nega febre', 'nega dispneia')"],
    "revisao_sistemas": "Revisão pertinente: cardiovascular, respiratório, GI, neurológico, musculoesquelético, psiquiátrico",
    "medicamentos_em_uso": ["INFIRA o nome do medicamento mesmo quando o paciente usar linguagem coloquial. Exemplos: 'remédio pra pressão' → Losartana ou Anlodipino; 'vitamina' → Complexo B ou Polivitamínico; 'remédio do coração' → AAS ou estatinas; 'para dormir' → Melatonina ou Zolpidem; 'pra diabetes' → Metformina; 'anti-inflamatório' → Ibuprofeno ou Diclofenaco. Liste o nome técnico (DCB) com dose quando possível. ESSENCIAL para interações."],
    "alergias": "Alergias conhecidas. Se nenhuma: 'NKDA'",
    "antecedentes_pessoais": "Comorbidades, cirurgias, internações, hábitos",
    "antecedentes_familiares": "Histórico familiar: DM, HAS, CA, DAC, AVC",
    "habitos_vida": "Tabagismo (maços/ano), etilismo, drogas, sedentarismo, dieta",
    "outros": "Informação adicional relevante não coberta acima"
  },

  "cid_sugerido": "OBRIGATÓRIO. Formato: 'CÓDIGO - Descrição'. Use o código MAIS ESPECÍFICO (subcategoria). Ex: 'J03.0 - Amigdalite estreptocócica' (não J06.9). Se incerto, use .9. NUNCA invente códigos.",

  "confianca_cid": "alta | media | baixa",

  "diagnostico_diferencial": [
    {
      "hipotese": "Nome da hipótese",
      "cid": "CID-10 — descrição",
      "probabilidade": "alta | media | baixa",
      "argumentos_a_favor": "Dados que suportam",
      "argumentos_contra": "Dados ausentes ou contra",
      "exames_confirmatorios": "Exames que confirmariam/descartariam"
    }
  ],

  "classificacao_gravidade": "verde | amarelo | laranja | vermelho (Manchester)",

  "alertas_vermelhos": ["APENAS com base CLARA no transcript. Formato: 'SINAL — SIGNIFICADO — AÇÃO'. Ex: 'Dor torácica + sudorese — SCA — SAMU'"],

  "exame_fisico_dirigido": "O que examinar: sinais vitais, manobras, pontos de atenção.",

  "medicamentos_sugeridos": [
    {
      "nome": "Genérico (DCB) + concentração. Ex: 'Amoxicilina 500mg'",
      "classe_terapeutica": "Classificação farmacológica. Ex: 'Antibiótico β-lactâmico — Aminopenicilina'",
      "dose": "Dose por tomada. Ex: '500mg' ou '2 comprimidos de 500mg'",
      "via": "VO | IM | IV | SC | Tópica | Inalatória | Sublingual | Nasal",
      "posologia": "Frequência em linguagem clara. Ex: '1 comprimido de 8 em 8 horas' ou '2 comprimidos de 12 em 12 horas'",
      "duracao": "Ex: '7 dias', 'uso contínuo'",
      "indicacao": "Indicado para [doença/CID]. Serve para [objetivo terapêutico]. Ex: 'Indicado para sinusite bacteriana. Trata a infecção e reduz secreção.'",
      "melhora_esperada": "OBRIGATÓRIO quando confianca_cid=alta. Ex: 'Melhora dos sintomas em 2-3 dias; resolução em 7-10 dias'",
      "contraindicacoes": "Todas relevantes",
      "interacoes": "Interações com TODOS medicamentos que o paciente JÁ USA + interações graves conhecidas. Se paciente usa Losartana → avaliar hipotensão com IECA. Sempre cruzar.",
      "mecanismo_acao": "Como o medicamento atua. Ex: 'Inibe COX-1 e COX-2, reduzindo prostaglandinas → efeito analgésico/anti-inflamatório/antipirético'",
      "ajuste_renal": "Ajuste se ClCr < 30, < 60. Vazio se não necessário",
      "ajuste_hepatico": "Ajuste se insuficiência hepática. Vazio se não necessário",
      "alerta_faixa_etaria": "Ajuste para idosos/crianças/gestantes/lactantes",
      "alternativa": "Alternativa completa. Ex: 'Azitromicina 500mg 1x/dia 3 dias se alergia a penicilinas'"
    }
  ],

  "interacoes_cruzadas": [
    {
      "medicamento_a": "Nome do medicamento A (pode ser em uso OU sugerido)",
      "medicamento_b": "Nome do medicamento B (pode ser em uso OU sugerido)",
      "tipo": "grave | moderada | leve",
      "descricao": "Descrição da interação e consequência clínica. Ex: 'Metformina + Contraste iodado → risco de acidose lática. Suspender metformina 48h antes e após'",
      "conduta": "O que fazer. Ex: 'Monitorar PA de perto', 'Espaçar doses em 2h', 'Contraindicação absoluta'"
    }
  ],

  "exames_sugeridos": [
    {
      "nome": "Nome técnico completo",
      "codigo_tuss": "Código TUSS/CBHPM quando conhecido. Vazio se não souber",
      "descricao": "O que é o exame",
      "o_que_afere": "O que mede — específico para ESTE caso",
      "indicacao": "Justificativa para ESTE paciente AGORA",
      "interpretacao_esperada": "O que se espera encontrar SE a hipótese principal estiver correta. Ex: 'Leucocitose >12.000 com desvio à esquerda sugere infecção bacteriana; PCR >10 corrobora'. FUNDAMENTAL para o médico.",
      "preparo_paciente": "Preparo necessário. Vazio se não precisa",
      "prazo_resultado": "Tempo estimado",
      "urgencia": "rotina | urgente"
    }
  ],

  "orientacoes_paciente": ["Orientações em linguagem acessível. 3-6 itens."],

  "criterios_retorno": ["Sinais de alarme para o paciente. 2-5 itens."],

  "perguntas_sugeridas": [
    {
      "pergunta": "Pergunta DIRETA em 2ª pessoa, linguagem natural. A que MAIS MUDA A CONDUTA agora.",
      "objetivo": "O que confirma/descarta. Ex: 'Diferencia pleurítica de muscular → muda RX'",
      "hipoteses_afetadas": "Mapa decisório: 'Se SIM → J18.9, RX tórax. Se NÃO → M54.5, AINE'",
      "impacto_na_conduta": "Detalhamento: o que muda na prescrição/encaminhamento se sim vs não",
      "prioridade": "alta | media | baixa"
    }
  ],

  "lacunas_anamnese": ["Informações ESSENCIAIS faltando. 2-5 itens. Array vazio se completa."],

  "suggestions": ["3-7 frases para prontuário. HD principal, DD, conduta, seguimento."]
}

═══ REGRAS OBRIGATÓRIAS DE COMPLETUDE ═══

MEDICAMENTOS (MÍNIMO 2, PREFERIR 3 OU MAIS — SEMPRE COINCIDENTES COM O CASO):
- OBRIGATÓRIO: TODOS os medicamentos devem ser COINCIDENTES com o CID, sintomas e quadro clínico. NUNCA sugerir medicamentos genéricos ou irrelevantes.
- Mínimo 2 medicamentos; preferir 3 ou mais quando o caso permitir (etiologia + sintomático + adjuvante).
- Contam como medicamentos: soro fisiológico (lavagem nasal, nebulização), sprays nasais, pomadas, colírios, soluções, suplementos — inclua quando indicado para o caso.
- Tratamento ETIOLÓGICO (ex: antibiótico se infeccioso, antiviral se viral) — ligado ao CID
- Tratamento SINTOMÁTICO (analgésico, antitérmico, antiemético, antidiarreico) — para os sintomas relatados
- Tratamento ADJUVANTE (protetor gástrico se AINE, probiótico se ATB, antihistamínico se congestão) — quando indicado
- PROFILAXIA quando indicada (vacina, profilaxia VTE, profilaxia de stress ulcer)
- Campo "mecanismo_acao" OBRIGATÓRIO — como o fármaco age
- Campos "ajuste_renal" e "ajuste_hepatico" — preencher quando houver necessidade
- SEMPRE cruze interações com medicamentos_em_uso do paciente
- Se transcript < 200 caracteres mas há queixa identificável, sugira 3+ medicamentos SINTOMÁTICOS básicos coincidentes (analgésico, antitérmico conforme sintomas)

QUANDO confianca_cid = "alta" (doenças de alta prevalência: sinusite, faringite, otite, gripe, cistite, dermatite, etc.):
- Formato OBRIGATÓRIO para cada medicamento: "X comprimidos de Xmg de [nome] de X em X horas por X dias"
- Exemplo sinusite: "Amoxicilina 500mg — 1 comprimido de 8 em 8 horas por 7-10 dias. Indicado para sinusite bacteriana. Melhora em 2-3 dias; resolução em 7-10 dias."
- Exemplo sintomático: "Paracetamol 750mg — 1 comprimido de 6 em 6 horas se dor/febre. Analgésico e antitérmico. Alívio em 30-60 min."
- Campo "melhora_esperada" OBRIGATÓRIO: "Melhora em X dias" ou "Alívio em X horas" — orienta o paciente sobre expectativa
- Campo "indicacao" deve incluir: doença/CID + objetivo ("serve para curar infecção", "reduz dor e febre")

INTERAÇÕES CRUZADAS (OBRIGATÓRIO se paciente usa ≥1 medicamento):
- Avaliar TODOS os pares: medicamento_em_uso × medicamento_sugerido E medicamento_sugerido × medicamento_sugerido
- Classificar como grave/moderada/leve
- Incluir conduta para cada interação
- Se nenhuma interação relevante, retornar array vazio []

EXAMES (OBRIGATÓRIO 4-12, NUNCA menos de 4):
- LABORATORIAIS BÁSICOS: hemograma, PCR/VHS, glicemia, ureia/creatinina, eletrólitos, TGO/TGP, EAS
- LABORATORIAIS ESPECÍFICOS: conforme hipótese (TSH, HbA1c, sorologias, culturas, marcadores)
- IMAGEM: RX, USG, TC, RM conforme indicação
- FUNCIONAIS: ECG, espirometria conforme indicação
- Campo "interpretacao_esperada" OBRIGATÓRIO — o que o médico deve esperar se hipótese correta
- Exames devem cobrir TODAS as hipóteses do diferencial
- Se transcript < 200 chars, inclua exames BÁSICOS de triagem (hemograma, glicemia, ureia, creatinina, EAS)

PERGUNTAS SUGERIDAS (OBRIGATÓRIO 4-8, NUNCA vazio):
- FORMULAÇÃO PELA IA: derive 100% do transcript. Perguntas que façam SENTIDO CLÍNICO para o médico perguntar AGORA, dado o que o paciente já disse.
- Estilo "Akinator clínico": a mais importante primeiro, prioridade RED FLAGS > discriminatórias > temporais > funcionais
- Campo "impacto_na_conduta" OBRIGATÓRIO: detalhe o que muda se SIM vs NÃO na conduta médica
- COINCIDÊNCIA COM A FALA: NUNCA pergunte o que o paciente já respondeu. Avance na linha de raciocínio. Ex: se disse "dor de cabeça há 3 dias" → não pergunte "há quanto tempo"; pergunte localização, caráter, irradiação, fatores de melhora/piora, etc.
- Se transcript < 200 chars, gere perguntas de ABERTURA:
  1. "Qual é a sua queixa principal? O que está sentindo?"
  2. "Há quanto tempo está com isso?"
  3. "De 0 a 10, qual a intensidade?"
  4. "Está tomando algum remédio atualmente?"
  5. "Tem alergia a algum medicamento?"
  6. "Já teve alguma cirurgia ou internação?"

SUGESTÕES (OBRIGATÓRIO 3-7, NUNCA vazio):
- Mesmo com poucos dados, gere sugestões parciais: "HD provável: ... (dados limitados, aguardando mais informações)"
- Inclua: hipótese principal + diferenciais + conduta inicial + seguimento
- Se transcript < 200 chars: "Avaliação inicial — aguardando mais dados da anamnese para refinar HD e conduta"

CID (OBRIGATÓRIO — SEMPRE TRAZER):
- cid_sugerido e diagnostico_diferencial[].cid: SEMPRE preencher. Nunca deixar vazio.
- Use o código MAIS ESPECÍFICO possível com subcategoria (ex: J03.0, não J06.9)
- SEMPRE inclua 2-4 CIDs nos diferenciais
- Se dados insuficientes: use R69 (Mal-estar e fadiga) ou R51 (Cefaleia) conforme o que o paciente mencionou como queixa
- Confira que o código existe na CID-10 OMS

═══ REGRAS GERAIS ═══
1. NUNCA invente informações ausentes no transcript
2. Responda APENAS o JSON, sem texto antes ou depois
3. Se algum campo não tiver dados, use "" ou []
4. Classificação de gravidade: SEMPRE preencha
5. Alertas vermelhos: APENAS quando fundamentados
6. Terminologia médica adequada e objetiva
7. Medicamentos: MÍNIMO 2, preferir 3+. Incluir soro fisiológico, sprays, pomadas quando indicado. Todos COINCIDENTES com o caso.
""";
    }

    // ── Fallbacks: dados nunca vazios ──

    private static void EnsurePerguntasFallback(JsonElement root, Dictionary<string, object> enrichedObj, string? transcriptSoFar)
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

        enrichedObj["perguntas_sugeridas"] = JsonSerializer.Serialize(fallback, JsonOptions);
    }

    private static void EnsureSuggestionsFallback(JsonElement root, Dictionary<string, object> enrichedObj, bool hasClinicalContext)
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
                "Reavaliar em 7-14 dias ou antes se piora dos sintomas."
            }
            : new List<string>
            {
                "Avaliação inicial — aguardando mais dados da anamnese para refinar HD e conduta.",
                "Continuar coleta de dados: queixa, duração, intensidade, medicamentos em uso, alergias.",
                "Sugestões completas serão geradas conforme a consulta evolui."
            };

        enrichedObj["suggestions_fallback"] = JsonSerializer.Serialize(fallbackSuggestions, JsonOptions);
    }

    // ── Helpers ──

    private static void CopyIfExists(JsonElement root, Dictionary<string, object> dict, string key)
    {
        if (root.TryGetProperty(key, out var el))
            dict[key] = el.GetRawText();
    }

    private static void CopyArrayIfExists(JsonElement root, Dictionary<string, object> dict, string key)
    {
        if (root.TryGetProperty(key, out var el) && el.ValueKind == JsonValueKind.Array)
            dict[key] = el.GetRawText();
    }

    private static bool HasClinicalContext(JsonElement root)
    {
        if (root.TryGetProperty("cid_sugerido", out var cidCheck) && !string.IsNullOrWhiteSpace(cidCheck.GetString()))
            return true;
        if (root.TryGetProperty("anamnesis", out var anaCheck) && anaCheck.ValueKind == JsonValueKind.Object
            && anaCheck.TryGetProperty("queixa_principal", out var qpAna) && !string.IsNullOrWhiteSpace(qpAna.GetString()))
            return true;
        return false;
    }

    private static List<string> ExtractSuggestions(JsonElement root)
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

        return suggestions;
    }

    private string ParseMedicamentosSugeridosV2(JsonElement root, bool hasClinicalContext)
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
                ["nome"] = "Avaliar necessidade de prescrição conforme evolução clínica",
                ["classe_terapeutica"] = "", ["dose"] = "", ["via"] = "", ["posologia"] = "",
                ["duracao"] = "", ["indicacao"] = "", ["contraindicacoes"] = "",
                ["interacoes"] = "", ["alerta_faixa_etaria"] = "", ["alternativa"] = ""
            });
        }

        return medsList.Count == 0 ? "[]" : JsonSerializer.Serialize(medsList, JsonOptions);
    }

    private string ParseExamesSugeridosV2(JsonElement root, bool hasClinicalContext)
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
                ["indicacao"] = "Avaliação inicial de infecção ou inflamação",
                ["preparo_paciente"] = "Jejum de 4 horas recomendado",
                ["prazo_resultado"] = "24-48h",
                ["urgencia"] = "rotina"
            });
            examsList.Add(new Dictionary<string, object>
            {
                ["nome"] = "Exames complementares conforme hipótese diagnóstica",
                ["codigo_tuss"] = "",
                ["descricao"] = "Solicitar conforme evolução e hipótese diagnóstica",
                ["o_que_afere"] = "Variável conforme indicação",
                ["indicacao"] = "Complementar investigação conforme quadro clínico",
                ["preparo_paciente"] = "",
                ["prazo_resultado"] = "",
                ["urgencia"] = "rotina"
            });
        }

        return examsList.Count == 0 ? "[]" : JsonSerializer.Serialize(examsList, JsonOptions);
    }

    private static string GetStr(JsonElement el, string prop)
    {
        if (el.TryGetProperty(prop, out var v))
        {
            return v.ValueKind == JsonValueKind.String
                ? (v.GetString() ?? "")
                : v.GetRawText();
        }
        return "";
    }

    private static string CleanJsonResponse(string raw)
    {
        var s = raw.Trim();
        if (s.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            s = s["```json".Length..];
        else if (s.StartsWith("```"))
            s = s["```".Length..];
        if (s.EndsWith("```"))
            s = s[..^3];
        return s.Trim();
    }

    // ── Evidence search (same as v1) ──

    private static List<string> ExtractSearchTerms(JsonElement root)
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

    private async Task<IReadOnlyList<EvidenceItemDto>> FetchAndTranslateEvidenceAsync(
        JsonElement root,
        string apiKey,
        CancellationToken cancellationToken,
        string? transcriptSoFar = null)
    {
        try
        {
            var searchTerms = ExtractSearchTerms(root);
            if (searchTerms.Count == 0)
                return Array.Empty<EvidenceItemDto>();

            var rawEvidence = await _evidenceSearchService.SearchAsync(searchTerms, 16, cancellationToken);
            if (rawEvidence.Count == 0)
                return rawEvidence;

            return await ExtractRelevantEvidenceAsync(rawEvidence, root, apiKey, cancellationToken, transcriptSoFar);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Evidências: falha na busca.");
            return Array.Empty<EvidenceItemDto>();
        }
    }

    private static string BuildClinicalContextForPrompt(JsonElement root)
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

    private async Task<IReadOnlyList<EvidenceItemDto>> ExtractRelevantEvidenceAsync(
        IReadOnlyList<EvidenceItemDto> items,
        JsonElement root,
        string apiKey,
        CancellationToken cancellationToken,
        string? transcriptSoFar = null)
    {
        if (items.Count == 0)
            return items;

        var context = BuildClinicalContextForPrompt(root);

        var transcriptBlock = "";
        if (!string.IsNullOrWhiteSpace(transcriptSoFar))
        {
            var trimmed = transcriptSoFar.Length > 1500 ? transcriptSoFar[^1500..] : transcriptSoFar;
            transcriptBlock = $"\n\nRESUMO DO QUE O PACIENTE DISSE (últimas falas):\n{trimmed}";
        }

        var articlesBlock = string.Join("\n\n---\n\n",
            items.Select((e, i) => $"[{i}]\nTítulo: {e.Title}\nAbstract: {e.Abstract}"));

        var prompt = """
Você é um especialista em MEDICINA BASEADA EM EVIDÊNCIAS para a plataforma RenoveJá+.
O médico precisa de EMBASAMENTO CIENTÍFICO SÓLIDO e CONTEXTUALIZADO ao paciente.

CONTEXTO CLÍNICO DO PACIENTE:
""" + context + transcriptBlock + """

ARTIGOS (abstracts em inglês):
""" + articlesBlock + """

Para CADA artigo [0], [1], etc., analise com RIGOR:

1. RELEVÂNCIA: Este artigo se aplica ao quadro DESTE paciente? Considere diagnóstico, sintomas, perfil.
2. Se RELEVANTE:
   - Extraia 2-4 trechos-chave (critérios diagnósticos, evidências de tratamento, guidelines, dados de eficácia)
   - Traduza para português brasileiro
   - Explique a CONEXÃO COM O PACIENTE (1-2 frases: por que este artigo importa para ESTE caso específico)
   - Classifique o NÍVEL DE EVIDÊNCIA (I=meta-análise/RCT, II=coorte, III=caso-controle, IV=série de casos, V=opinião expert)
3. Se IRRELEVANTE: marque como irrelevante (será filtrado)

Responda APENAS um JSON válido:
[
  {
    "relevant": true,
    "excerpts": ["trecho1 traduzido", "trecho2"],
    "clinicalRelevance": "Explicação de como embasa a decisão...",
    "conexao_com_paciente": "Por que este artigo é relevante PARA ESTE PACIENTE: [relação direta com o que foi dito/apresentado]",
    "nivel_evidencia": "I | II | III | IV | V",
    "motivo_selecao": "Em 1 frase: por que este artigo foi escolhido entre tantos"
  },
  { "relevant": false, "excerpts": [], "clinicalRelevance": "", "conexao_com_paciente": "", "nivel_evidencia": "", "motivo_selecao": "" },
  ...
]
Apenas JSON, sem markdown.
""";

        var evidenceModel = GetEvidenceModel();
        _logger.LogInformation("[Evidências IA] Chamando OpenAI: model={Model} (evidências)", evidenceModel);
        var requestBody = new
        {
            model = evidenceModel,
            messages = new object[] { new { role = "user", content = (object)prompt } },
            max_tokens = 4000,
            temperature = 0.15
        };

        var json = JsonSerializer.Serialize(requestBody, JsonOptions);
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        client.Timeout = TimeSpan.FromSeconds(45);

        using var requestContent = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await client.PostAsync($"{ApiBaseUrl}/chat/completions", requestContent, cancellationToken);
        if (!response.IsSuccessStatusCode)
            return Array.Empty<EvidenceItemDto>();

        var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
        try
        {
            using var doc = JsonDocument.Parse(responseJson);
            var content = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
            if (string.IsNullOrWhiteSpace(content))
                return Array.Empty<EvidenceItemDto>();

            var cleaned = CleanJsonResponse(content);
            using var arr = JsonDocument.Parse(cleaned);
            var result = new List<EvidenceItemDto>();
            var idx = 0;
            foreach (var el in arr.RootElement.EnumerateArray())
            {
                if (idx >= items.Count) break;
                var item = items[idx];
                var excerpts = new List<string>();
                var relevance = "";

                if (el.TryGetProperty("excerpts", out var exEl) && exEl.ValueKind == JsonValueKind.Array)
                    foreach (var e in exEl.EnumerateArray())
                    {
                        var s = e.GetString()?.Trim();
                        if (!string.IsNullOrEmpty(s)) excerpts.Add(s);
                    }
                if (el.TryGetProperty("clinicalRelevance", out var relEl))
                    relevance = relEl.GetString()?.Trim() ?? "";

                var isRelevant = true;
                if (el.TryGetProperty("relevant", out var relFlag) && relFlag.ValueKind == JsonValueKind.False)
                    isRelevant = false;
                if (!isRelevant && excerpts.Count == 0)
                {
                    idx++;
                    continue;
                }

                var conexao = "";
                if (el.TryGetProperty("conexao_com_paciente", out var conEl))
                    conexao = conEl.GetString()?.Trim() ?? "";
                var nivelEvidencia = "";
                if (el.TryGetProperty("nivel_evidencia", out var nivEl))
                    nivelEvidencia = nivEl.GetString()?.Trim() ?? "";
                var motivoSelecao = "";
                if (el.TryGetProperty("motivo_selecao", out var motEl))
                    motivoSelecao = motEl.GetString()?.Trim() ?? "";

                result.Add(new EvidenceItemDto(
                    item.Title, item.Abstract, item.Source,
                    TranslatedAbstract: excerpts.Count > 0 ? string.Join("\n\n", excerpts) : null,
                    RelevantExcerpts: excerpts.Count > 0 ? excerpts : null,
                    ClinicalRelevance: !string.IsNullOrEmpty(relevance) ? relevance : null,
                    Provider: item.Provider, Url: item.Url,
                    ConexaoComPaciente: !string.IsNullOrEmpty(conexao) ? conexao : null,
                    NivelEvidencia: !string.IsNullOrEmpty(nivelEvidencia) ? nivelEvidencia : null,
                    MotivoSelecao: !string.IsNullOrEmpty(motivoSelecao) ? motivoSelecao : null));
                idx++;
            }
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Evidências: falha ao parsear resposta.");
            return Array.Empty<EvidenceItemDto>();
        }
    }
}
