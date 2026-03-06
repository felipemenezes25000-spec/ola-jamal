using RenoveJa.Application.DTOs.Consultation;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço para buscar artigos científicos no PubMed por termos de busca (CID, sintomas, queixa).
/// Retorna abstracts para exibição no painel do médico durante a consulta.
/// </summary>
public interface IPubMedService
{
    /// <summary>
    /// Busca até N artigos no PubMed com base nos termos fornecidos.
    /// </summary>
    /// <param name="searchTerms">Termos de busca (ex: CID, sintomas, queixa principal).</param>
    /// <param name="maxResults">Máximo de artigos a retornar (default 5).</param>
    /// <param name="cancellationToken">Cancelamento.</param>
    /// <returns>Lista de evidências com título e abstract (em inglês).</returns>
    Task<IReadOnlyList<EvidenceItemDto>> SearchAsync(
        IReadOnlyList<string> searchTerms,
        int maxResults = 5,
        CancellationToken cancellationToken = default);
}
