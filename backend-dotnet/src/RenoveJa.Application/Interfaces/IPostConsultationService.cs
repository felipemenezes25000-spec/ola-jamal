using RenoveJa.Application.DTOs.Clinical;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de emissão em lote de documentos pós-consulta.
/// Finaliza o Encounter, cria os documentos (receita, exame, atestado),
/// gera PDFs, assina com ICP-Brasil e notifica o paciente.
/// </summary>
public interface IPostConsultationService
{
    /// <summary>
    /// Emite todos os documentos de uma vez, assina e atualiza o prontuário.
    /// </summary>
    Task<PostConsultationEmitResponse> EmitDocumentsAsync(
        Guid doctorUserId,
        PostConsultationEmitRequest request,
        CancellationToken cancellationToken = default);
}
