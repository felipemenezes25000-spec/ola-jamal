namespace RenoveJa.Application.Interfaces;

public record AiConductSuggestionInput(
    string RequestType,
    string? PrescriptionType,
    string? ExamType,
    string? PatientName,
    DateTime? PatientBirthDate,
    string? PatientGender,
    string? Symptoms,
    List<string>? Medications,
    List<string>? Exams,
    string? AiSummaryForDoctor,
    string? AiExtractedJson,
    string? DoctorNotes);

public record AiConductSuggestionResult(
    string? ConductSuggestion,
    List<string>? SuggestedExams);

/// <summary>
/// Gera sugestão de conduta médica e exames complementares usando IA.
/// O médico decide se aceita, edita ou ignora a sugestão.
/// </summary>
public interface IAiConductSuggestionService
{
    Task<AiConductSuggestionResult?> GenerateAsync(
        AiConductSuggestionInput input,
        CancellationToken cancellationToken = default);
}
