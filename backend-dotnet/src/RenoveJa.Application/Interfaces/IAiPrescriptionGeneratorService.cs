using RenoveJa.Domain.Enums;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Entrada para geração de prescrição por IA.
/// </summary>
public record AiPrescriptionGeneratorInput(
    string PatientName,
    DateTime? PatientBirthDate,
    string? PatientGender,
    string? Symptoms,
    string? AiSummaryForDoctor,
    string? AiExtractedJson,
    string? DoctorNotes,
    PrescriptionKind Kind);

/// <summary>
/// Serviço de geração de itens de prescrição usando IA (GPT-4o).
/// Utiliza os dados extraídos da receita original como referência primária.
/// </summary>
public interface IAiPrescriptionGeneratorService
{
    /// <summary>
    /// Gera a lista de medicamentos para a prescrição com base nos dados clínicos disponíveis.
    /// Retorna null se a IA não estiver configurada ou não conseguir gerar os itens.
    /// </summary>
    Task<List<PrescriptionMedicationItem>?> GenerateMedicationsAsync(
        AiPrescriptionGeneratorInput input,
        CancellationToken ct = default);
}
