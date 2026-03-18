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
    IRequestRepository requestRepository,
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
        // Garantir que patient_profiles existe (prontuário clínico)
        await EnsurePatientFromUserAsync(patientUserId, cancellationToken);
        // encounters.patient_id referencia users(id), não patient_profiles(id)
        var encounter = Encounter.Start(
            patientUserId,
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

        var oldValues = new Dictionary<string, object?>
        {
            ["anamnesis"] = encounter.Anamnesis,
            ["plan"] = encounter.Plan,
            ["mainIcd10Code"] = encounter.MainIcd10Code,
            ["status"] = encounter.Status
        };
        encounter.UpdateClinicalNotes(anamnesis: anamnesis, plan: plan, mainIcd10Code: mainIcd10Code);
        encounter.FinalizeEncounter();
        encounter = await encounterRepository.UpdateAsync(encounter, cancellationToken);

        var newValues = new Dictionary<string, object?>
        {
            ["anamnesis"] = encounter.Anamnesis,
            ["plan"] = encounter.Plan,
            ["mainIcd10Code"] = encounter.MainIcd10Code,
            ["status"] = encounter.Status,
            ["finishedAt"] = encounter.FinishedAt
        };

        await auditService.LogModificationAsync(
            encounter.PractitionerId,
            action: "Update",
            entityType: "Encounter",
            entityId: encounter.Id,
            oldValues: oldValues,
            newValues: newValues,
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
            // Encounter pode não existir se ReportCallConnected não foi chamado (ex.: chamada não conectou).
            // Cria on-demand para permitir salvar notas no prontuário.
            var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
            if (request == null)
                throw new InvalidOperationException($"Request não encontrado para a consulta {requestId}");
            if (request.RequestType != RequestType.Consultation)
                throw new InvalidOperationException("Apenas consultas suportam salvar resumo no prontuário.");
            if (!request.DoctorId.HasValue || request.DoctorId != doctorId)
                throw new UnauthorizedAccessException("Apenas o médico da consulta pode atualizar as notas clínicas.");

            encounter = await StartEncounterForConsultationAsync(
                requestId,
                request.PatientId,
                doctorId,
                request.Symptoms,
                cancellationToken);
            if (encounter == null)
                throw new InvalidOperationException($"Não foi possível criar o prontuário para a consulta {requestId}");
        }

        if (encounter.PractitionerId != doctorId)
        {
            throw new UnauthorizedAccessException("Apenas o médico da consulta pode atualizar as notas clínicas.");
        }

        var oldValues = new Dictionary<string, object?>
        {
            ["anamnesis"] = encounter.Anamnesis,
            ["plan"] = encounter.Plan
        };
        encounter.UpdateClinicalNotes(anamnesis: anamnesis, plan: plan);
        await encounterRepository.UpdateAsync(encounter, cancellationToken);

        var newValues = new Dictionary<string, object?>
        {
            ["anamnesis"] = encounter.Anamnesis,
            ["plan"] = encounter.Plan
        };

        await auditService.LogModificationAsync(
            doctorId,
            action: "Update",
            entityType: "Encounter",
            entityId: encounter.Id,
            oldValues: oldValues,
            newValues: newValues,
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
