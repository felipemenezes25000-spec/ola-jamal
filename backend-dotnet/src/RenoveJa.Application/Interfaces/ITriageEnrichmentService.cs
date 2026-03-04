namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de enriquecimento de mensagens da Dra. Renova com IA.
/// A IA NUNCA define nada — apenas personaliza dicas de orientação.
/// O médico sempre decide. Uso híbrido: regras primeiro, IA opcional para suavizar o texto.
/// </summary>
public interface ITriageEnrichmentService
{
    /// <summary>
    /// Tenta personalizar uma mensagem de triagem com IA.
    /// Retorna null se: API indisponível, timeout, ou output inválido.
    /// NUNCA altera o significado — apenas torna o texto mais acolhedor/contextual.
    /// </summary>
    Task<TriageEnrichmentResult?> EnrichAsync(
        TriageEnrichmentInput input,
        CancellationToken cancellationToken = default);
}

public record TriageEnrichmentInput(
    string Context,
    string Step,
    string? RuleKey,
    string RuleText,
    string? PrescriptionType,
    string? ExamType,
    string[]? Exams,
    string? Symptoms,
    int? TotalRequests,
    int? RecentPrescriptionCount,
    int? RecentExamCount,
    int? LastPrescriptionDaysAgo,
    int? LastExamDaysAgo,
    int? PatientAge,
    string[]? RecentMedications);

public record TriageEnrichmentResult(
    string Text,
    bool IsPersonalized);
