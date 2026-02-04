namespace RenoveJa.Application.DTOs.Requests;

public record CreatePrescriptionRequestDto(
    string PrescriptionType,
    List<string> Medications,
    List<string>? PrescriptionImages = null
);

public record CreateExamRequestDto(
    string ExamType,
    List<string> Exams,
    string? Symptoms = null
);

public record CreateConsultationRequestDto(
    string Symptoms
);

public record UpdateRequestStatusDto(
    string Status,
    string? RejectionReason = null
);

public record ApproveRequestDto(
    decimal Price,
    string? Notes = null
);

public record RejectRequestDto(
    string RejectionReason
);

public record SignRequestDto(
    string SignatureData
);

public record RequestResponseDto(
    Guid Id,
    Guid PatientId,
    string? PatientName,
    Guid? DoctorId,
    string? DoctorName,
    string RequestType,
    string Status,
    string? PrescriptionType,
    List<string>? Medications,
    List<string>? PrescriptionImages,
    string? ExamType,
    List<string>? Exams,
    string? Symptoms,
    decimal? Price,
    string? Notes,
    string? RejectionReason,
    DateTime? SignedAt,
    string? SignedDocumentUrl,
    string? SignatureId,
    DateTime CreatedAt,
    DateTime UpdatedAt
);
