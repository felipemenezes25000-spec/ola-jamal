using Microsoft.AspNetCore.Http;

namespace RenoveJa.Application.DTOs.Certificates;

/// <summary>
/// DTO para upload de certificado digital.
/// </summary>
public record UploadCertificateDto(
    IFormFile PfxFile,
    string Password);

/// <summary>
/// DTO para validação de certificado (sem upload).
/// </summary>
public record ValidateCertificateDto(
    IFormFile PfxFile,
    string Password);

/// <summary>
/// Resposta do upload de certificado.
/// </summary>
public record UploadCertificateResponseDto(
    bool Success,
    string? Message,
    Guid? CertificateId,
    Application.Interfaces.CertificateValidationResult? Validation);

/// <summary>
/// Resposta da validação de certificado.
/// </summary>
public record ValidateCertificateResponseDto(
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
/// Informações do certificado ativo.
/// </summary>
public record CertificateInfoDto(
    Guid Id,
    string SubjectName,
    string IssuerName,
    DateTime NotBefore,
    DateTime NotAfter,
    bool IsValid,
    bool IsExpired,
    int DaysUntilExpiry);

/// <summary>
/// DTO para revogar certificado.
/// </summary>
public record RevokeCertificateDto(
    string Reason);

/// <summary>
/// Resposta do endpoint de diagnóstico do fluxo de assinatura.
/// Indica em qual etapa o fluxo falha (perfil → certificado → PFX → assinatura).
/// </summary>
public record CertificateDiagnoseResponseDto(
    bool ProfileOk,
    string? ProfileMessage,
    bool CertificateOk,
    string? CertificateMessage,
    bool HasActiveCertificate,
    string? ActiveCertificateMessage,
    string? FailedStep,
    string? Suggestion);
