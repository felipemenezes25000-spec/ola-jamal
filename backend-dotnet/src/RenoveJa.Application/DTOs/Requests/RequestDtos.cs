using System.Text.Json.Serialization;
using RenoveJa.Application.DTOs.Video;

namespace RenoveJa.Application.DTOs.Requests;

public record CreatePrescriptionRequestDto(
    string PrescriptionType,
    List<string>? Medications = null,
    List<string>? PrescriptionImages = null
);

public record CreateExamRequestDto(
    string ExamType,
    List<string> Exams,
    string? Symptoms = null,
    List<string>? ExamImages = null
);

public record CreateConsultationRequestDto(
    string Symptoms
);

public record UpdateRequestStatusDto(
    string Status,
    string? RejectionReason = null
);

/// <summary>
/// Aprovação do médico. Body vazio — só aprova. O valor vem da tabela product_prices.
/// Somente médicos podem aprovar (role doctor).
/// </summary>
public record ApproveRequestDto;

public record RejectRequestDto(
    string RejectionReason
);

/// <summary>Assinatura e envio da receita/documento novo. SignedDocumentUrl = URL do PDF da receita assinada (ex.: upload no storage).</summary>
public record SignRequestDto(
    string? SignatureData = null,
    string? SignedDocumentUrl = null
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
    List<string>? ExamImages,
    string? Symptoms,
    decimal? Price,
    string? Notes,
    string? RejectionReason,
    string? AccessCode,
    DateTime? SignedAt,
    string? SignedDocumentUrl,
    string? SignatureId,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string? AiSummaryForDoctor = null,
    string? AiExtractedJson = null,
    string? AiRiskLevel = null,
    string? AiUrgency = null,
    bool? AiReadabilityOk = null,
    string? AiMessageToUser = null
);

/// <summary>Reanalisar receita com novas imagens (ex.: mais legíveis).</summary>
public record ReanalyzePrescriptionDto(IReadOnlyList<string> PrescriptionImageUrls);

/// <summary>Reanalisar pedido de exame com novas imagens e/ou texto.</summary>
public record ReanalyzeExamDto(IReadOnlyList<string>? ExamImageUrls = null, string? TextDescription = null);

/// <summary>Resposta do accept-consultation. video_room em snake_case para compatibilidade com frontend.</summary>
public record AcceptConsultationResponseDto(
    RequestResponseDto Request,
    [property: JsonPropertyName("video_room")] VideoRoomResponseDto VideoRoom
);
