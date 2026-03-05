using RenoveJa.Domain.Entities;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Orquestra o ciclo de vida do Encounter para teleconsultas.
/// Evita dependência circular entre RequestService e ClinicalRecordService.
/// </summary>
public interface IConsultationEncounterService
{
    /// <summary>
    /// Cria um Encounter quando médico e paciente estão conectados na chamada.
    /// </summary>
    Task<Encounter?> StartEncounterForConsultationAsync(
        Guid requestId,
        Guid patientUserId,
        Guid doctorId,
        string? reason,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Finaliza o Encounter ao encerrar a consulta, com anamnese e plano.
    /// </summary>
    Task FinalizeEncounterForConsultationAsync(
        Guid requestId,
        string? anamnesis,
        string? plan,
        string? mainIcd10Code,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Atualiza as notas clínicas do Encounter (writeback do resumo da consulta).
    /// </summary>
    Task UpdateEncounterClinicalNotesAsync(
        Guid requestId,
        Guid doctorId,
        string? anamnesis,
        string? plan,
        CancellationToken cancellationToken = default);
}
