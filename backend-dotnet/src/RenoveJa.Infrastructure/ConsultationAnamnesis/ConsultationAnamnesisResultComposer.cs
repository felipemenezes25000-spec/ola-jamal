using System.Text.Json;
using System.Text.RegularExpressions;
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

                    conservativeObj["transcript_curto"] = "true";
                    conservativeObj["transcript_palavras"] = wordCount.ToString();

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

                    var conservativeJson = JsonSerializer.Serialize(conservativeObj);

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

            // Grounding validation — detect hallucinated symptoms/arguments
            var groundingReport = CidGroundingValidator.Validate(transcriptSoFar, cleaned);
            var hasCritico = groundingReport.Issues.Any(i => i.StartsWith("CRÍTICO"));

            // Salvar issues de grounding no JSON para o frontend exibir
            if (groundingReport.Issues.Length > 0)
            {
                enrichedObj["grounding_issues"] = JsonSerializer.Serialize(groundingReport.Issues);
                enrichedObj["grounding_score"] = JsonSerializer.Serialize(groundingReport.Score);
            }

            AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "raciocinio_clinico");
            AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "denominador_comum");
            AnamnesisResponseParser.CopyArrayIfExists(root, enrichedObj, "alertas_vermelhos");
            CopyAndValidateDiagnosticoDiferencial(root, enrichedObj);
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

            var enrichedJson = JsonSerializer.Serialize(enrichedObj);

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

    private static readonly Regex Cid10Pattern = new(@"^[A-Z]\d{2}(\.\d{1,2})?$", RegexOptions.Compiled);

    private static void CopyAndValidateDiagnosticoDiferencial(JsonElement root, Dictionary<string, object> enrichedObj)
    {
        if (!root.TryGetProperty("diagnostico_diferencial", out var ddEl) || ddEl.ValueKind != JsonValueKind.Array)
            return;

        var filtered = new List<JsonElement>();
        foreach (var item in ddEl.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object)
            {
                filtered.Add(item);
                continue;
            }

            if (item.TryGetProperty("cid", out var cidEl))
            {
                var cidRaw = cidEl.GetString()?.Trim() ?? "";
                var cidCode = cidRaw.Split(' ', 2)[0].Split('\u2014', 2)[0].Split('-', 2)[0].Trim();
                if (!string.IsNullOrEmpty(cidCode) && !Cid10Pattern.IsMatch(cidCode))
                    continue;
            }

            filtered.Add(item);
        }

        enrichedObj["diagnostico_diferencial"] = JsonSerializer.Serialize(filtered);
    }
}
