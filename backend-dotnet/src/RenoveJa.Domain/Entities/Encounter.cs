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

    // ── Campos adicionais para compliance CFM 1.638/2002 e prontuário enriquecido ──
    /// <summary>Hipóteses diagnósticas / diagnóstico diferencial (JSON array ou texto livre).</summary>
    public string? DifferentialDiagnosis { get; private set; }
    /// <summary>Orientações ao paciente geradas pela IA ou escritas pelo médico.</summary>
    public string? PatientInstructions { get; private set; }
    /// <summary>Alertas vermelhos (red flags) identificados pela IA durante a consulta.</summary>
    public string? RedFlags { get; private set; }
    /// <summary>Anamnese estruturada completa (JSON) gerada pela IA — queixa, HDA, revisão sistemas, etc.</summary>
    public string? StructuredAnamnesis { get; private set; }

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
        string? differentialDiagnosis = null,
        string? patientInstructions = null,
        string? redFlags = null,
        string? structuredAnamnesis = null,
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
        DifferentialDiagnosis = differentialDiagnosis;
        PatientInstructions = patientInstructions;
        RedFlags = redFlags;
        StructuredAnamnesis = structuredAnamnesis;
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
        string? mainIcd10Code = null,
        string? differentialDiagnosis = null,
        string? patientInstructions = null,
        string? redFlags = null,
        string? structuredAnamnesis = null)
    {
        if (anamnesis != null)
            Anamnesis = anamnesis;
        if (physicalExam != null)
            PhysicalExam = physicalExam;
        if (plan != null)
            Plan = plan;
        if (mainIcd10Code != null)
            MainIcd10Code = mainIcd10Code;
        if (differentialDiagnosis != null)
            DifferentialDiagnosis = differentialDiagnosis;
        if (patientInstructions != null)
            PatientInstructions = patientInstructions;
        if (redFlags != null)
            RedFlags = redFlags;
        if (structuredAnamnesis != null)
            StructuredAnamnesis = structuredAnamnesis;
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
        DateTime createdAt,
        string? differentialDiagnosis = null,
        string? patientInstructions = null,
        string? redFlags = null,
        string? structuredAnamnesis = null)
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
            differentialDiagnosis,
            patientInstructions,
            redFlags,
            structuredAnamnesis,
            createdAt);
    }
}

