namespace RenoveJa.Application.DTOs.Verification;

/// <summary>
/// Dados públicos da receita para verificação (sem dados sensíveis).
/// </summary>
public record VerificationPublicDto(
    Guid RequestId,
    string? DoctorName,
    string? DoctorCrm,
    string? DoctorCrmState,
    string? DoctorSpecialty,
    string? PatientName,
    string? PrescriptionType,
    List<string>? Medications,
    DateTime EmissionDate,
    string Status,
    DateTime? SignedAt,
    string? SignatureInfo,
    string VerificationUrl,
    bool AccessCodeRequired
);

/// <summary>
/// Dados completos da receita (após validação do código de acesso).
/// </summary>
public record VerificationFullDto(
    Guid RequestId,
    string? DoctorName,
    string? DoctorCrm,
    string? DoctorCrmState,
    string? DoctorSpecialty,
    string? PatientFullName,
    string? PatientCpfMasked,
    string? PrescriptionType,
    List<string>? Medications,
    string? Notes,
    DateTime EmissionDate,
    string Status,
    DateTime? SignedAt,
    string? SignatureInfo,
    string? SignedDocumentUrl,
    string VerificationUrl,
    string? AiExtractedJson
);

/// <summary>
/// Corpo do POST /api/verify/{id}/full — código de acesso.
/// </summary>
public record VerifyAccessCodeRequest(string AccessCode);
