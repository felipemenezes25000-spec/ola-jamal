using RenoveJa.Application.DTOs.Consultation;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de anamnese e sugestões por IA durante a consulta (copiloto).
/// Atualiza anamnese estruturada e gera sugestões de hipóteses/recomendações com base no transcript.
/// Decisão final sempre do médico.
/// </summary>
public interface IConsultationAnamnesisService
{
    /// <summary>
    /// Atualiza a anamnese estruturada e as sugestões com base no transcript acumulado.
    /// </summary>
    /// <param name="transcriptSoFar">Texto transcrito até o momento.</param>
    /// <param name="previousAnamnesisJson">JSON da anamnese anterior (ou null). O modelo mantém e atualiza.</param>
    /// <param name="cancellationToken">Cancelamento.</param>
    /// <returns>Anamnese JSON atualizada e até 3 sugestões; ou null se API não configurada.</returns>
    Task<ConsultationAnamnesisResult?> UpdateAnamnesisAndSuggestionsAsync(
        string transcriptSoFar,
        string? previousAnamnesisJson,
        CancellationToken cancellationToken = default);
}
