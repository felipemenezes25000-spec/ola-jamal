using RenoveJa.Domain.Entities;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Sincroniza solicitações assinadas (receita/exame) para o modelo clínico (Encounter + MedicalDocument).
/// Evita dependência circular com RequestService.
/// </summary>
public interface ISignedRequestClinicalSyncService
{
    /// <summary>
    /// Cria Encounter e MedicalDocument a partir de uma request assinada (prescription ou exam).
    /// Não bloqueia a resposta em caso de falha.
    /// </summary>
    Task SyncSignedRequestAsync(
        MedicalRequest request,
        string signedDocumentUrl,
        string signatureId,
        DateTime signedAt,
        Guid certificateId,
        string? certificateSubject,
        CancellationToken cancellationToken = default);
}
