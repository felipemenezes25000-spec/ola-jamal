namespace RenoveJa.Domain.Enums;

/// <summary>
/// Tipos principais de encontro clínico / atendimento.
/// Mantido enxuto para o prontuário mínimo-perfeito.
/// </summary>
public enum EncounterType
{
    Teleconsultation = 1,
    PrescriptionRenewal = 2,
    ExamOrder = 3,
    FollowUp = 4,
    Orientation = 5
}

