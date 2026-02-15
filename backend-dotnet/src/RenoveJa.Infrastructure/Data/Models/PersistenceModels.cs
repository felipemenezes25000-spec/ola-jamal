using System.Text.Json.Serialization;

namespace RenoveJa.Infrastructure.Data.Models;

/// <summary>Modelo de persistência de usuário (tabela users).</summary>
public class UserModel
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Cpf { get; set; }
    [JsonPropertyName("birth_date")]
    public DateTime? BirthDate { get; set; }
    public string? AvatarUrl { get; set; }
    public string Role { get; set; } = "patient";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    /// <summary>Cadastro concluído (phone, CPF preenchidos). Usuários Google iniciam com false.</summary>
    public bool ProfileComplete { get; set; } = true;
}

public class DoctorProfileModel
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Crm { get; set; } = string.Empty;
    public string CrmState { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
    public string? Bio { get; set; }
    public decimal Rating { get; set; }
    public int TotalConsultations { get; set; }
    public bool Available { get; set; }
    public Guid? ActiveCertificateId { get; set; }
    public bool CrmValidated { get; set; }
    public DateTime? CrmValidatedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public static DoctorProfileModel FromDomain(RenoveJa.Domain.Entities.DoctorProfile profile)
    {
        return new DoctorProfileModel
        {
            Id = profile.Id,
            UserId = profile.UserId,
            Crm = profile.Crm,
            CrmState = profile.CrmState,
            Specialty = profile.Specialty,
            Bio = profile.Bio,
            Rating = profile.Rating,
            TotalConsultations = profile.TotalConsultations,
            Available = profile.Available,
            ActiveCertificateId = profile.ActiveCertificateId,
            CrmValidated = profile.CrmValidated,
            CrmValidatedAt = profile.CrmValidatedAt,
            CreatedAt = profile.CreatedAt
        };
    }

    public RenoveJa.Domain.Entities.DoctorProfile ToDomain()
    {
        return RenoveJa.Domain.Entities.DoctorProfile.Reconstitute(
            Id, UserId, Crm, CrmState, Specialty, Bio,
            Rating, TotalConsultations, Available,
            ActiveCertificateId, CrmValidated, CrmValidatedAt, CreatedAt);
    }
}

/// <summary>Modelo de persistência de token de autenticação (tabela auth_tokens).</summary>
public class AuthTokenModel
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Modelo de persistência de token de recuperação de senha (tabela password_reset_tokens).</summary>
public class PasswordResetTokenModel
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool Used { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Modelo de persistência de solicitação médica (tabela requests).</summary>
public class RequestModel
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string? PatientName { get; set; }
    public Guid? DoctorId { get; set; }
    public string? DoctorName { get; set; }
    public string RequestType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? PrescriptionType { get; set; }
    public List<string> Medications { get; set; } = new();
    public List<string> PrescriptionImages { get; set; } = new();
    public string? ExamType { get; set; }
    public List<string> Exams { get; set; } = new();
    public List<string> ExamImages { get; set; } = new();
    public string? Symptoms { get; set; }
    public decimal? Price { get; set; }
    public string? Notes { get; set; }
    public string? RejectionReason { get; set; }
    public string? AccessCode { get; set; }
    public DateTime? SignedAt { get; set; }
    public string? SignedDocumentUrl { get; set; }
    public string? SignatureId { get; set; }
    public string? AiSummaryForDoctor { get; set; }
    public string? AiExtractedJson { get; set; }
    public string? AiRiskLevel { get; set; }
    public string? AiUrgency { get; set; }
    public bool? AiReadabilityOk { get; set; }
    public string? AiMessageToUser { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Modelo de persistência de pagamento (tabela payments).</summary>
public class PaymentModel
{
    public Guid Id { get; set; }
    public Guid RequestId { get; set; }
    public Guid UserId { get; set; }
    public decimal Amount { get; set; }
    public string Status { get; set; } = "pending";
    public string PaymentMethod { get; set; } = "pix";
    public string? ExternalId { get; set; }
    public string? PixQrCode { get; set; }
    public string? PixQrCodeBase64 { get; set; }
    public string? PixCopyPaste { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Modelo de persistência de certificado digital (tabela doctor_certificates).</summary>
public class CertificateModel
{
    public Guid Id { get; set; }
    public Guid DoctorProfileId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public string IssuerName { get; set; } = string.Empty;
    public string SerialNumber { get; set; } = string.Empty;
    public DateTime NotBefore { get; set; }
    public DateTime NotAfter { get; set; }
    public string PfxStoragePath { get; set; } = string.Empty;
    public string PfxFileName { get; set; } = string.Empty;
    public string? Cpf { get; set; }
    public string? CrmNumber { get; set; }
    public bool IsValid { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? RevocationReason { get; set; }
    public bool ValidatedAtRegistration { get; set; }
    public DateTime? LastValidationDate { get; set; }
    public string? LastValidationResult { get; set; }
    public DateTime UploadedAt { get; set; }
    public string? UploadedByIp { get; set; }
    public DateTime CreatedAt { get; set; }

    public static CertificateModel FromDomain(RenoveJa.Domain.Entities.DoctorCertificate cert)
    {
        return new CertificateModel
        {
            Id = cert.Id,
            DoctorProfileId = cert.DoctorProfileId,
            SubjectName = cert.SubjectName,
            IssuerName = cert.IssuerName,
            SerialNumber = cert.SerialNumber,
            NotBefore = cert.NotBefore,
            NotAfter = cert.NotAfter,
            PfxStoragePath = cert.PfxStoragePath,
            PfxFileName = cert.PfxFileName,
            Cpf = cert.Cpf,
            CrmNumber = cert.CrmNumber,
            IsValid = cert.IsValid,
            IsRevoked = cert.IsRevoked,
            RevokedAt = cert.RevokedAt,
            RevocationReason = cert.RevocationReason,
            ValidatedAtRegistration = cert.ValidatedAtRegistration,
            LastValidationDate = cert.LastValidationDate,
            LastValidationResult = cert.LastValidationResult,
            UploadedAt = cert.UploadedAt,
            UploadedByIp = cert.UploadedByIp,
            CreatedAt = cert.CreatedAt
        };
    }

    public RenoveJa.Domain.Entities.DoctorCertificate ToDomain()
    {
        return RenoveJa.Domain.Entities.DoctorCertificate.Reconstitute(
            Id, DoctorProfileId, SubjectName, IssuerName, SerialNumber,
            NotBefore, NotAfter, PfxStoragePath, PfxFileName,
            Cpf, CrmNumber, IsValid, IsRevoked, RevokedAt, RevocationReason,
            ValidatedAtRegistration, LastValidationDate, LastValidationResult,
            UploadedAt, UploadedByIp, CreatedAt);
    }
}
