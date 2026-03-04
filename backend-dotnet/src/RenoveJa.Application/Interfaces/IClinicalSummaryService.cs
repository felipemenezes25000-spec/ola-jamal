namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Entrada para geração do resumo clínico completo do paciente.
/// </summary>
public record ClinicalSummaryInput(
    string PatientName,
    DateTime? PatientBirthDate,
    string? PatientGender,
    IReadOnlyList<string> Allergies,
    IReadOnlyList<ClinicalSummaryConsultation> Consultations,
    IReadOnlyList<ClinicalSummaryPrescription> Prescriptions,
    IReadOnlyList<ClinicalSummaryExam> Exams);

public record ClinicalSummaryConsultation(
    DateTime Date,
    string? Symptoms,
    string? Cid,
    string? Conduct,
    string? AnamnesisSnippet);

public record ClinicalSummaryPrescription(
    DateTime Date,
    string Type,
    IReadOnlyList<string> Medications,
    string? Notes);

public record ClinicalSummaryExam(
    DateTime Date,
    string? ExamType,
    IReadOnlyList<string> Exams,
    string? Symptoms,
    string? Notes);

/// <summary>
/// Resumo estruturado estilo Epic/Cerner — lista de problemas, meds ativos, plano de cuidado.
/// </summary>
public record ClinicalSummaryStructured(
    IReadOnlyList<string> ProblemList,
    IReadOnlyList<string> ActiveMedications,
    string? NarrativeSummary,
    string? CarePlan,
    IReadOnlyList<string> Alerts);

/// <summary>
/// Gera resumo narrativo completo do prontuário do paciente com IA.
/// Consolida consultas, receitas e exames em um texto único para o médico.
/// Retorna também dados estruturados (lista de problemas, meds ativos) quando disponível.
/// </summary>
public interface IClinicalSummaryService
{
    Task<string?> GenerateAsync(
        ClinicalSummaryInput input,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gera resumo estruturado estilo prontuários de referência (Epic, Cerner).
    /// Retorna null se API indisponível ou parsing falhar.
    /// </summary>
    Task<ClinicalSummaryStructured?> GenerateStructuredAsync(
        ClinicalSummaryInput input,
        CancellationToken cancellationToken = default);
}
