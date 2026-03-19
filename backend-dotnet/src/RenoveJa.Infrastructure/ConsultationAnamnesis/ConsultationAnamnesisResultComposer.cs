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
            AnamnesisResponseParser.CopyIfExists(root, enrichedObj, "confianca_cid");
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
