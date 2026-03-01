// Adicionar ao final de VerificationDtos.cs (ou arquivo equivalente de DTOs de verificação).
// Ajuste o namespace para o do projeto med-renew.

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
