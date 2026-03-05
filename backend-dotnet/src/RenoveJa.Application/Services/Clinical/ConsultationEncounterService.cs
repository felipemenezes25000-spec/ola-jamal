using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Clinical;

/// <summary>
/// Orquestra o ciclo de vida do Encounter para teleconsultas.
/// Evita dependência circular entre RequestService e ClinicalRecordService.
/// </summary>
public class ConsultationEncounterService(
    IUserRepository userRepository,
    IPatientRepository patientRepository,
    IEncounterRepository encounterRepository,
    IAuditService auditService,
    ILogger<ConsultationEncounterService> logger) : IConsultationEncounterService
{
    public async Task<Encounter?> StartEncounterForConsultationAsync(
        Guid requestId,
        Guid patientUserId,
        Guid doctorId,
        string? reason,
        CancellationToken cancellationToken = default)
    {
        var patient = await EnsurePatientFromUserAsync(patientUserId, cancellationToken);
        var encounter = Encounter.Start(
            patient.Id,
            doctorId,
            EncounterType.Teleconsultation,
            channel: "daily",
            reason: reason);

        encounter = await encounterRepository.CreateAsync(encounter, cancellationToken, requestId);

        await auditService.LogModificationAsync(
            doctorId,
            action: "Create",
            entityType: "Encounter",
            entityId: encounter.Id,
            cancellationToken: cancellationToken);

        logger.LogInformation(
            "[ConsultationEncounter] Encounter {EncounterId} criado para request {RequestId}",
            encounter.Id, requestId);

        return encounter;
    }

    public async Task FinalizeEncounterForConsultationAsync(
        Guid requestId,
        string? anamnesis,
        string? plan,
        string? mainIcd10Code,
        CancellationToken cancellationToken = default)
    {
        var encounter = await encounterRepository.GetBySourceRequestIdAsync(requestId, cancellationToken);
        if (encounter == null)
        {
            logger.LogWarning("[ConsultationEncounter] Encounter não encontrado para request {RequestId}", requestId);
            return;
        }

        encounter.UpdateClinicalNotes(anamnesis: anamnesis, plan: plan, mainIcd10Code: mainIcd10Code);
        encounter.FinalizeEncounter();
        encounter = await encounterRepository.UpdateAsync(encounter, cancellationToken);

        await auditService.LogModificationAsync(
            encounter.PractitionerId,
            action: "Update",
            entityType: "Encounter",
            entityId: encounter.Id,
            cancellationToken: cancellationToken);

        logger.LogInformation(
            "[ConsultationEncounter] Encounter {EncounterId} finalizado para request {RequestId}",
            encounter.Id, requestId);
    }

    public async Task UpdateEncounterClinicalNotesAsync(
        Guid requestId,
        Guid doctorId,
        string? anamnesis,
        string? plan,
        CancellationToken cancellationToken = default)
    {
        var encounter = await encounterRepository.GetBySourceRequestIdAsync(requestId, cancellationToken);
        if (encounter == null)
        {
            throw new InvalidOperationException($"Encounter não encontrado para a consulta {requestId}");
        }

        if (encounter.PractitionerId != doctorId)
        {
            throw new UnauthorizedAccessException("Apenas o médico da consulta pode atualizar as notas clínicas.");
        }

        encounter.UpdateClinicalNotes(anamnesis: anamnesis, plan: plan);
        await encounterRepository.UpdateAsync(encounter, cancellationToken);

        await auditService.LogModificationAsync(
            doctorId,
            action: "Update",
            entityType: "Encounter",
            entityId: encounter.Id,
            cancellationToken: cancellationToken);

        logger.LogInformation(
            "[ConsultationEncounter] Notas clínicas atualizadas no Encounter {EncounterId} para request {RequestId}",
            encounter.Id, requestId);
    }

    private async Task<Patient> EnsurePatientFromUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        var existing = await patientRepository.GetByUserIdAsync(userId, cancellationToken);
        if (existing != null)
            return existing;

        var user = await userRepository.GetByIdAsync(userId, cancellationToken)
                   ?? throw new InvalidOperationException("User not found");

        var patient = Patient.CreateFromUser(
            user.Id,
            user.Name,
            user.Cpf ?? string.Empty,
            user.BirthDate,
            user.Gender,
            socialName: null,
            phone: user.Phone?.Value,
            email: user.Email,
            addressLine1: user.Address ?? user.Street,
            city: user.City,
            state: user.State,
            zipCode: user.PostalCode);

        patient = await patientRepository.CreateAsync(patient, cancellationToken);

        await auditService.LogModificationAsync(
            userId,
            action: "Create",
            entityType: "Patient",
            entityId: patient.Id,
            cancellationToken: cancellationToken);

        return patient;
    }
}
