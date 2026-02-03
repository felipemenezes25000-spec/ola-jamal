namespace RenoveJa.Infrastructure.Data.Models;

public class UserModel
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Cpf { get; set; }
    public DateTime? BirthDate { get; set; }
    public string? AvatarUrl { get; set; }
    public string Role { get; set; } = "patient";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
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
    public DateTime CreatedAt { get; set; }
}

public class AuthTokenModel
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

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
    public string? Symptoms { get; set; }
    public decimal? Price { get; set; }
    public string? Notes { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime? SignedAt { get; set; }
    public string? SignedDocumentUrl { get; set; }
    public string? SignatureId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

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
