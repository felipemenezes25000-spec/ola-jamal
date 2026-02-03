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

namespace RenoveJa.Application.DTOs.Payments;

public record CreatePaymentRequestDto(
    Guid RequestId,
    decimal Amount
);

public record PaymentResponseDto(
    Guid Id,
    Guid RequestId,
    Guid UserId,
    decimal Amount,
    string Status,
    string PaymentMethod,
    string? ExternalId,
    string? PixQrCode,
    string? PixQrCodeBase64,
    string? PixCopyPaste,
    DateTime? PaidAt,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record MercadoPagoWebhookDto(
    string Action,
    string? Id,
    Dictionary<string, object>? Data
);

namespace RenoveJa.Application.DTOs.Chat;

public record SendMessageRequestDto(
    string Message
);

public record MessageResponseDto(
    Guid Id,
    Guid RequestId,
    Guid SenderId,
    string? SenderName,
    string SenderType,
    string Message,
    bool Read,
    DateTime CreatedAt
);

namespace RenoveJa.Application.DTOs.Notifications;

public record NotificationResponseDto(
    Guid Id,
    Guid UserId,
    string Title,
    string Message,
    string NotificationType,
    bool Read,
    Dictionary<string, object>? Data,
    DateTime CreatedAt
);

namespace RenoveJa.Application.DTOs.Video;

public record CreateVideoRoomRequestDto(
    Guid RequestId
);

public record VideoRoomResponseDto(
    Guid Id,
    Guid RequestId,
    string RoomName,
    string? RoomUrl,
    string Status,
    DateTime? StartedAt,
    DateTime? EndedAt,
    int? DurationSeconds,
    DateTime CreatedAt
);

namespace RenoveJa.Application.DTOs.Doctors;

public record DoctorListResponseDto(
    Guid Id,
    string Name,
    string Email,
    string? Phone,
    string? AvatarUrl,
    string Crm,
    string CrmState,
    string Specialty,
    string? Bio,
    decimal Rating,
    int TotalConsultations,
    bool Available
);

public record UpdateDoctorAvailabilityDto(
    bool Available
);
