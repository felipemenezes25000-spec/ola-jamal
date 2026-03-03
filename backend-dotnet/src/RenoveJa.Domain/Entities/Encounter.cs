using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

/// <summary>
/// Agregado de episódio de atendimento (consulta, renovação de receita, solicitação de exame etc.).
/// Mantido enxuto e vinculado a Patient e Practitioner.
/// </summary>
public class Encounter : AggregateRoot
{
    public Guid PatientId { get; private set; }
    public Guid PractitionerId { get; private set; }

    public EncounterType Type { get; private set; }
    public string Status { get; private set; } = "draft";

    public DateTime StartedAt { get; private set; }
    public DateTime? FinishedAt { get; private set; }

    public string? Channel { get; private set; } // web, mobile, whatsapp, etc.
    public string? Reason { get; private set; }
    public string? Anamnesis { get; private set; }
    public string? PhysicalExam { get; private set; }
    public string? Plan { get; private set; }

    public string? MainIcd10Code { get; private set; }

    private Encounter() : base()
    {
        PatientId = Guid.Empty;
        PractitionerId = Guid.Empty;
    }

    private Encounter(
        Guid id,
        Guid patientId,
        Guid practitionerId,
        EncounterType type,
        DateTime startedAt,
        string status,
        string? channel,
        string? reason,
        string? anamnesis,
        string? physicalExam,
        string? plan,
        string? mainIcd10Code,
        DateTime? finishedAt,
        DateTime? createdAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        PatientId = patientId;
        PractitionerId = practitionerId;
        Type = type;
        StartedAt = startedAt;
        Status = status;
        Channel = channel;
        Reason = reason;
        Anamnesis = anamnesis;
        PhysicalExam = physicalExam;
        Plan = plan;
        MainIcd10Code = mainIcd10Code;
        FinishedAt = finishedAt;
    }

    public static Encounter Start(
        Guid patientId,
        Guid practitionerId,
        EncounterType type,
        DateTime? startedAt = null,
        string? channel = null,
        string? reason = null)
    {
        if (patientId == Guid.Empty)
            throw new DomainException("PatientId is required");
        if (practitionerId == Guid.Empty)
            throw new DomainException("PractitionerId is required");

        return new Encounter(
            Guid.NewGuid(),
            patientId,
            practitionerId,
            type,
            startedAt ?? DateTime.UtcNow,
            status: "draft",
            channel,
            reason,
            anamnesis: null,
            physicalExam: null,
            plan: null,
            mainIcd10Code: null,
            finishedAt: null);
    }

    public void UpdateClinicalNotes(
        string? anamnesis = null,
        string? physicalExam = null,
        string? plan = null,
        string? mainIcd10Code = null)
    {
        if (anamnesis != null)
            Anamnesis = anamnesis;
        if (physicalExam != null)
            PhysicalExam = physicalExam;
        if (plan != null)
            Plan = plan;
        if (mainIcd10Code != null)
            MainIcd10Code = mainIcd10Code;
    }

    public void FinalizeEncounter(DateTime? finishedAt = null)
    {
        if (Status == "final")
            return;

        FinishedAt = finishedAt ?? DateTime.UtcNow;
        if (FinishedAt < StartedAt)
            throw new DomainException("FinishedAt cannot be before StartedAt");

        Status = "final";
    }

    public void Cancel(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainException("Cancellation reason is required");

        Status = "cancelled";
        Plan = reason;
        FinishedAt ??= DateTime.UtcNow;
    }

    public static Encounter Reconstitute(
        Guid id,
        Guid patientId,
        Guid practitionerId,
        EncounterType type,
        DateTime startedAt,
        string status,
        string? channel,
        string? reason,
        string? anamnesis,
        string? physicalExam,
        string? plan,
        string? mainIcd10Code,
        DateTime? finishedAt,
        DateTime createdAt)
    {
        return new Encounter(
            id,
            patientId,
            practitionerId,
            type,
            startedAt,
            status,
            channel,
            reason,
            anamnesis,
            physicalExam,
            plan,
            mainIcd10Code,
            finishedAt,
            createdAt);
    }
}

