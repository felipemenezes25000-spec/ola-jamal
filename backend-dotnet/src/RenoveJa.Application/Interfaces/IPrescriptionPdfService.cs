using RenoveJa.Domain.Enums;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Dados de um medicamento para a receita digital.
/// </summary>
public record PrescriptionMedicationItem(
    string Name,
    string? Presentation = null,      // Ex: "Comprimido 20mg", "Cápsula 500mg"
    string? Dosage = null,             // Ex: "1 comprimido a cada 12 horas"
    string? Quantity = null,           // Ex: "30 comprimidos", "2 caixas"
    string? Observation = null);       // Observação específica do medicamento

/// <summary>
/// Dados para geração de receita médica em PDF.
/// Campos opcionais adicionados para retrocompatibilidade.
/// </summary>
public record PrescriptionPdfData(
    Guid RequestId,
    string PatientName,
    string? PatientCpf,
    string DoctorName,
    string DoctorCrm,
    string DoctorCrmState,
    string DoctorSpecialty,
    List<string> Medications,
    string PrescriptionType,
    DateTime EmissionDate,
    string? DoctorSignatureUrl = null,
    string? AdditionalNotes = null,
    // Novos campos opcionais (retrocompatibilidade)
    string? PatientAddress = null,
    DateTime? PatientBirthDate = null,
    string? AccessCode = null,
    List<PrescriptionMedicationItem>? MedicationItems = null,
    string? VerificationUrl = null,
    string? PharmacyValidationUrl = null,
    PrescriptionKind? PrescriptionKind = null,
    string? PatientGender = null,
    string? DoctorAddress = null,
    string? DoctorPhone = null);

/// <summary>
/// Resultado da geração do PDF.
/// </summary>
public record PrescriptionPdfResult(
    bool Success,
    byte[]? PdfBytes,
    string? PdfUrl,
    string? ErrorMessage);

/// <summary>
/// Dados para geração de PDF de pedido de exame.
/// </summary>
public record ExamPdfData(
    Guid RequestId,
    string PatientName,
    string? PatientCpf,
    string DoctorName,
    string DoctorCrm,
    string DoctorCrmState,
    string DoctorSpecialty,
    List<string> Exams,
    string? Notes,
    DateTime EmissionDate,
    string? AccessCode = null);

/// <summary>
/// Serviço para geração de PDFs de receitas médicas e pedidos de exame.
/// </summary>
public interface IPrescriptionPdfService
{
    /// <summary>
    /// Gera um PDF de receita médica.
    /// </summary>
    Task<PrescriptionPdfResult> GenerateAsync(
        PrescriptionPdfData data,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gera e faz upload do PDF para o storage.
    /// </summary>
    Task<PrescriptionPdfResult> GenerateAndUploadAsync(
        PrescriptionPdfData data,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Assina digitalmente um PDF de receita com o certificado do médico.
    /// </summary>
    Task<PrescriptionPdfResult> SignAsync(
        byte[] pdfBytes,
        Guid certificateId,
        string outputFileName,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gera um PDF de pedido de exame (para assinatura digital).
    /// </summary>
    Task<PrescriptionPdfResult> GenerateExamRequestAsync(
        ExamPdfData data,
        CancellationToken cancellationToken = default);
}
