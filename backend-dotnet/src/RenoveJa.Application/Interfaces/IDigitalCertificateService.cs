namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Resultado da validação de um certificado digital PFX.
/// </summary>
public record CertificateValidationResult(
    bool IsValid,
    string? ErrorMessage,
    string? SubjectName,
    string? IssuerName,
    string? SerialNumber,
    DateTime? NotBefore,
    DateTime? NotAfter,
    string? Cpf,
    string? CrmNumber,
    bool IsExpired,
    bool IsIcpBrasil);

/// <summary>
/// Resultado da assinatura digital de um documento.
/// </summary>
public record DigitalSignatureResult(
    bool Success,
    string? ErrorMessage,
    string? SignedDocumentUrl,
    string? SignatureId,
    DateTime? SignedAt);

/// <summary>
/// Serviço para validação e uso de certificados digitais ICP-Brasil.
/// </summary>
public interface IDigitalCertificateService
{
    /// <summary>
    /// Valida um certificado PFX sem armazená-lo.
    /// Retorna informações do certificado se válido.
    /// </summary>
    Task<CertificateValidationResult> ValidatePfxAsync(
        byte[] pfxBytes,
        string password,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Faz upload e valida o certificado do médico.
    /// Armazena o PFX criptografado e retorna o ID do certificado.
    /// </summary>
    Task<(Guid CertificateId, CertificateValidationResult Validation)> UploadAndValidateAsync(
        Guid doctorProfileId,
        byte[] pfxBytes,
        string password,
        string fileName,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Assina um documento PDF usando o certificado do médico.
    /// pfxPassword: senha do certificado PFX. Obrigatória para desbloquear a chave privada.
    /// </summary>
    Task<DigitalSignatureResult> SignPdfAsync(
        Guid certificateId,
        byte[] pdfBytes,
        string outputFileName,
        string? pfxPassword = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Assina um PDF a partir de uma URL existente.
    /// </summary>
    Task<DigitalSignatureResult> SignPdfFromUrlAsync(
        Guid certificateId,
        string pdfUrl,
        string outputFileName,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Verifica se o médico tem certificado válido para assinatura.
    /// </summary>
    Task<bool> HasValidCertificateAsync(
        Guid doctorProfileId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtém informações do certificado ativo do médico.
    /// </summary>
    Task<CertificateInfo?> GetActiveCertificateAsync(
        Guid doctorProfileId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Remove um certificado (revoga).
    /// </summary>
    Task<bool> RevokeCertificateAsync(
        Guid certificateId,
        string reason,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Informações resumidas de um certificado.
/// </summary>
public record CertificateInfo(
    Guid Id,
    string SubjectName,
    string IssuerName,
    DateTime NotBefore,
    DateTime NotAfter,
    bool IsValid,
    bool IsExpired,
    int DaysUntilExpiry);
