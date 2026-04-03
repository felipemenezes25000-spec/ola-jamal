namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Dados necessários para registrar uma receita no sistema de verificação pública (Verify v2).
/// </summary>
public record PrescriptionVerifyRecord(
    Guid Id,
    string VerifyCodeHash,
    string PdfStoragePath,
    string PatientInitials,
    string PrescriberCrmUf,
    string PrescriberCrmLast4,
    DateTime IssuedAt,
    string IssuedDateStr,
    string Status = "active",
    string? PdfHash = null);

/// <summary>
/// Registra prescricoes na tabela 'prescriptions' do banco para verificacao publica via QR Code.
/// </summary>
public interface IPrescriptionVerifyRepository
{
    /// <summary>
    /// Insere ou atualiza a linha na tabela prescriptions.
    /// Usa o Id da receita como chave primária (mesmo Id do Request).
    /// </summary>
    Task UpsertAsync(PrescriptionVerifyRecord record, CancellationToken ct = default);

    /// <summary>
    /// Valida o código de 6 dígitos contra verify_code_hash (SHA256) na tabela prescriptions.
    /// </summary>
    Task<bool> ValidateVerifyCodeAsync(Guid requestId, string code, CancellationToken ct = default);

    /// <summary>
    /// Marca a prescrição como dispensada.
    /// </summary>
    Task<bool> MarkAsDispensedAsync(Guid requestId, string pharmacyName, string pharmacistName, string? pharmacistCrf = null, CancellationToken ct = default);

    /// <summary>
    /// Retorna true se a prescrição já foi dispensada.
    /// </summary>
    Task<bool> IsDispensedAsync(Guid requestId, CancellationToken ct = default);
}
