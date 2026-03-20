using System.Text.Json;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.DTOs.Consultation;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Domain.ValueObjects;
namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// Monta o JSON enriquecido e as sugestões a partir da resposta bruta do modelo (parser + CID + fallbacks).
/// </summary>
internal static class ConsultationAnamnesisResultComposer
{
    public static async Task<ConsultationAnamnesisResult?> TryComposeAsync(
        string cleaned,
        string transcriptSoFar,
        ILogger logger,
        IAiInteractionLogRepository aiInteractionLogRepository,
        string anamnesisModel,
        string promptHash,
        DateTime startedAt,
        CancellationToken cancellationToken)
    {
        try
        {
            // SEGURANÇA: Transcript curto → forçar saída conservadora (evitar preenchimento por inferência)
            var wordCount = transcriptSoFar.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
            if (wordCount < 100)
            {
                logger.LogWarning("[Anamnese IA v2] Transcript curto ({WordCount} palavras) — forçando saída conservadora.", wordCount);

                // Ainda tentar parsear, mas forçar confiança baixa e adicionar alerta
                try
                {
                    using var shortParsed = JsonDocument.Parse(cleaned);
                    var shortRoot = shortParsed.RootElement;

                    var conservativeObj = new Dictionary<string, object>();

                    // Copiar anamnese se existir
                    if (shortRoot.TryGetProperty("anamnesis", out var shortAna) && shortAna.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var prop in shortAna.EnumerateObject())
                            conservativeObj[prop.Name] = prop.Value.GetRawText();
                    }

                    // Forçar confiança baixa
                    conservativeObj["confianca_cid"] = "\"baixa\"";
                    conservativeObj["transcript_curto"] = "true";
                    conservativeObj["transcript_palavras"] = wordCount.ToString();

                    // Copiar CID mas sinalizar como não confiável
                    if (shortRoot.TryGetProperty("cid_sugerido", out var shortCidEl))
                        conservativeObj["cid_sugerido"] = shortCidEl.GetRawText();

                    // Adicionar alerta de transcript curto
                    conservativeObj["grounding_issues"] = JsonSerializer.Serialize(new[]
                    {
                        $"ALERTA: Transcript com apenas {wordCount} palavras — dados insuficientes para diagnóstico confiável.",
                        "Confiança forçada para 'baixa' devido a transcript curto."
                    });
                    conservativeObj["grounding_score"] = "30";

                    // Copiar outros campos úteis
                    AnamnesisResponseParser.CopyIfExists(shortRoot, conservativeObj, "raciocinio_clinico");
                    AnamnesisResponseParser.CopyArrayIfExists(shortRoot, conservativeObj, "perguntas_sugeridas");
                    AnamnesisResponseParser.CopyArrayIfExists(shortRoot, conservativeObj, "lacunas_anamnese");

                    var conservativeJson = "{" + string.Join(",", conservativeObj.Select(kv => $"\"{kv.Key}\":{kv.Value}")) + "}";

                    var conservativeSuggestions = new List<string>
                    {
                        "⚠️ Transcript curto — dados insuficientes para diagnóstico confiável.",
                        "Recomenda-se continuar a anamnese antes de definir conduta.",
                        "Pergunte sobre: queixa principal, duração, intensidade, fatores de melhora/piora."
                    };

                    // Extrair perguntas sugeridas se existirem
                    var shortSuggestions = AnamnesisResponseParser.ExtractSuggestions(shortRoot);
                    if (shortSuggestions.Count > 0)
                        conservativeSuggestions.AddRange(shortSuggestions);

                    // Log interaction
                    try
                    {
                        await aiInteractionLogRepository.LogAsync(AiInteractionLog.Create(
                            serviceName: ConsultationAnamnesisLlmClient.AiInteractionServiceName,
                            modelName: anamnesisModel,
                            promptHash: promptHash,
                            success: true,
                            responseSummary: $"[TRANSCRIPT_CURTO:{wordCount}w] " + (cleaned.Length > 400 ? cleaned[..400] : cleaned),
                            durationMs: (long)(DateTime.UtcNow - startedAt).TotalMilliseconds), cancellationToken);
                    }
                    catch (Exception logEx)
                    {
                        logger.LogWarning(logEx, "[Anamnese IA v2] Falha ao gravar log (transcript curto).");
                    }

                    logger.LogInformation("[Anamnese IA v2] SUCESSO (conservador): transcript curto {WordCount}w, forçando confiança baixa.", wordCount);
                    return new ConsultationAnamnesisResult(conservativeJson, conservativeSuggestions, Array.Empty<EvidenceItemDto>());
                }
                catch (Exception shortEx)
                {
                    logger.LogWarning(shortEx, "[Anamnese IA v2] Falha ao processar transcript curto — continuando fluxo normal.");
                    // Fall through to normal processing
                }
            }

            using var parsed = JsonDocument.Parse(cleaned);
            var root = parsed.RootElement;

            var enrichedObj = new Dictionary<string, object>();

            if (root.TryGetProperty("anamnesis", out var anaEl) && anaEl.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in anaEl.EnumerateObject())
                    enrichedObj[prop.Name] = prop.Value.GetRawText();
            }

            var cidRaw = root.TryGetProperty("cid_sugerido", out var cidEl) ? cidEl.GetString()?.Trim() ?? "" : "";
            cidRaw = AnamnesisResponseParser.EnsureCidCoherentWithDifferential(root, cidRaw, logger, transcriptSoFar);
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
                AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "cid_sugerido");
            }
            // MELHORIA 3: Validar grounding e forçar confiança baixa se score < 50
            var groundingReport = CidGroundingValidator.Validate(transcriptSoFar, cleaned);
            var confiancaOriginal = root.TryGetProperty("confianca_cid", out var confEl) ? confEl.GetString()?.Trim() ?? "" : "";
            var hasCritico = groundingReport.Issues.Any(i => i.StartsWith("CRÍTICO"));

            // Transcript médio (100-200 palavras) → cap confiança em "media" no máximo
            if (wordCount >= 100 && wordCount < 200)
            {
                if (string.Equals(confiancaOriginal, "alta", StringComparison.OrdinalIgnoreCase))
                {
                    enrichedObj["confianca_cid"] = JsonSerializer.Serialize("media");
                    logger.LogWarning("[Anamnese] Confiança rebaixada de 'alta' para 'media' — transcript médio ({WordCount} palavras).", wordCount);
                }
            }

            if (groundingReport.Score < 50 || hasCritico)
            {
                // Forçar confiança baixa — o médico verá alerta visual
                enrichedObj["confianca_cid"] = JsonSerializer.Serialize("baixa");
                if (!string.Equals(confiancaOriginal, "baixa", StringComparison.OrdinalIgnoreCase))
                    logger.LogWarning("[Anamnese] Confiança rebaixada de '{Original}' para 'baixa' — grounding score={Score}, issues CRÍTICO={HasCritico}",
                        confiancaOriginal, groundingReport.Score, hasCritico);
            }
            else if (groundingReport.Score < 70 && string.Equals(confiancaOriginal, "alta", StringComparison.OrdinalIgnoreCase))
            {
                // Score entre 50-70 com confiança alta → rebaixar para média
                enrichedObj["confianca_cid"] = JsonSerializer.Serialize("media");
                logger.LogWarning("[Anamnese] Confiança rebaixada de 'alta' para 'media' — grounding score={Score} insuficiente para alta.",
                    groundingReport.Score);
            }
            else
            {
                AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "confianca_cid");
            }

            // Salvar issues de grounding no JSON para o frontend exibir
            if (groundingReport.Issues.Length > 0)
            {
                enrichedObj["grounding_issues"] = JsonSerializer.Serialize(groundingReport.Issues);
                enrichedObj["grounding_score"] = JsonSerializer.Serialize(groundingReport.Score);
            }

            AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "raciocinio_clinico");
            AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "denominador_comum");
            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "alertas_vermelhos");
            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "diagnostico_diferencial");
            AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "classificacao_gravidade");
            AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "exame_fisico_dirigido");
            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "orientacoes_paciente");
            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "criterios_retorno");
            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "perguntas_sugeridas");
            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "lacunas_anamnese");

            var hasClinicalContext = AnamnesisResponseParser.HasClinicalContext(root);
            var medicamentosRaw = AnamnesisResponseParser.ParseMedicamentosSugeridosV2(root, hasClinicalContext);
            enrichedObj["medicamentos_sugeridos"] = medicamentosRaw;

            var examesRaw = AnamnesisResponseParser.ParseExamesSugeridosV2(root, hasClinicalContext);
            enrichedObj["exames_sugeridos"] = examesRaw;

            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "interacoes_cruzadas");

            AnamnesisResponseParser.EnsurePerguntasFallback(root, enrichedObj, transcriptSoFar);
            AnamnesisResponseParser.EnsureSuggestionsFallback(root, enrichedObj, hasClinicalContext);

            var enrichedJson = "{" + string.Join(",", enrichedObj.Select(kv => $"\"{kv.Key}\":{kv.Value}")) + "}";

            var suggestions = AnamnesisResponseParser.ExtractSuggestions(root);
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

            try
            {
                await aiInteractionLogRepository.LogAsync(AiInteractionLog.Create(
                    serviceName: ConsultationAnamnesisLlmClient.AiInteractionServiceName,
                    modelName: anamnesisModel,
                    promptHash: promptHash,
                    success: true,
                    responseSummary: cleaned.Length > 500 ? cleaned[..500] : cleaned,
                    durationMs: (long)(DateTime.UtcNow - startedAt).TotalMilliseconds), cancellationToken);
            }
            catch (Exception logEx)
            {
                logger.LogWarning(logEx, "[Anamnese IA v2] Falha ao gravar log.");
            }

            logger.LogInformation("[Anamnese IA v2] SUCESSO: anamnesisLen={Len} suggestions={Count} durationMs={Ms}",
                enrichedJson.Length, suggestions.Count, (long)(DateTime.UtcNow - startedAt).TotalMilliseconds);

            return new ConsultationAnamnesisResult(enrichedJson, suggestions, Array.Empty<EvidenceItemDto>());
        }
        catch (Exception ex)
        {
            var preview = cleaned.Length > 400 ? cleaned[..400] + "..." : cleaned;
            logger.LogWarning(ex, "[Anamnese IA v2] Falha ao parsear JSON de resposta. Preview={Preview}", preview);
            return null;
        }
    }
}
