using RenoveJa.Application.DTOs.Consultation;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Busca evidências clínicas (Cochrane / PubMed) para validar hipótese diagnóstica da IA.
/// Prioriza revisões sistemáticas Cochrane > meta-análises > RCTs > coortes.
/// Usa GPT-4o para filtrar e resumir abstracts contra o contexto clínico do paciente.
/// Cache por CID+termos em Redis (14 dias) para evitar rebater PubMed/GPT a cada consulta.
/// </summary>
public interface IClinicalEvidenceService
{
    /// <summary>
    /// Busca evidências que confirmem (ou contestem) a hipótese diagnóstica extraída da anamnese.
    /// </summary>
    /// <param name="anamnesisJson">JSON da anamnese com cid_sugerido, diagnostico_diferencial, sintomas.</param>
    /// <param name="cancellationToken">Token de cancelamento.</param>
    /// <returns>Lista de evidências ordenadas por nível (Cochrane primeiro). Vazio se sem CID ou sem resultados.</returns>
    Task<IReadOnlyList<EvidenceItemDto>> SearchEvidenceAsync(
        string anamnesisJson,
        CancellationToken cancellationToken = default);
}
