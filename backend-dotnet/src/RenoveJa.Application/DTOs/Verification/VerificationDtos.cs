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

/// <summary>
/// Corpo do POST /api/prescriptions/verify — validação determinística por código de 6 dígitos.
/// </summary>
public record PrescriptionVerifyRequest(Guid PrescriptionId, string VerificationCode);

/// <summary>
/// Motivo de falha quando is_valid é false.
/// </summary>
public static class PrescriptionVerifyReason
{
    public const string InvalidCode = "INVALID_CODE";
    public const string NotSigned = "NOT_SIGNED";
    public const string NotFound = "NOT_FOUND";
    public const string Expired = "EXPIRED";
    public const string Revoked = "REVOKED";
}

/// <summary>
/// Resposta do POST /api/prescriptions/verify.
/// Quando is_valid = true, os campos de dados estão preenchidos; quando false, reason indica o motivo.
/// </summary>
public record PrescriptionVerifyResponse(
    bool IsValid,
    string Status,
    string? Reason,
    DateTime? IssuedAt,
    DateTime? SignedAt,
    string? PatientName,
    string? DoctorName,
    string? DoctorCrm,
    string? DownloadUrl
);
