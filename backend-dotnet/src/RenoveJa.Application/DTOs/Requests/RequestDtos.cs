using System.Text.Json.Serialization;
using RenoveJa.Application.DTOs.Video;

namespace RenoveJa.Application.DTOs.Requests;

public record CreatePrescriptionRequestDto(
    string PrescriptionType,
    List<string>? Medications = null,
    List<string>? PrescriptionImages = null,
    /// <summary>Tipo de receita: simple, antimicrobial, controlled_special.</summary>
    string? PrescriptionKind = null
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
/// Aprovação do médico. O valor vem da tabela product_prices.
/// Medications/Exams/Notes: opcional — médico pode enviar medicamentos ou exames (ex.: copiados da análise IA).
/// </summary>
public record ApproveRequestDto(
    List<string>? Medications = null,
    List<string>? Exams = null,
    string? Notes = null);

public record RejectRequestDto(
    string RejectionReason
);

/// <summary>
/// Assinatura e envio da receita/documento novo.
/// - PfxPassword: obrigatório quando o backend gera e assina o PDF automaticamente (senha do certificado digital).
/// - SignedDocumentUrl: URL do PDF assinado externamente (fluxo manual).
/// </summary>
public record SignRequestDto(
    string? PfxPassword = null,
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
    string? PrescriptionKind,
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
    string? AiMessageToUser = null,
    string? ConsultationTranscript = null,
    string? ConsultationAnamnesis = null,
    string? ConsultationAiSuggestions = null
);

/// <summary>Médico atualiza medicamentos, notas e tipo de receita antes da assinatura.</summary>
public record UpdatePrescriptionContentDto(List<string>? Medications = null, string? Notes = null, string? PrescriptionKind = null);

/// <summary>Médico atualiza exames e notas do pedido antes da assinatura.</summary>
public record UpdateExamContentDto(List<string>? Exams = null, string? Notes = null);

/// <summary>Reanalisar receita com novas imagens (ex.: mais legíveis).</summary>
public record ReanalyzePrescriptionDto(IReadOnlyList<string> PrescriptionImageUrls);

/// <summary>Reanalisar pedido de exame com novas imagens e/ou texto.</summary>
public record ReanalyzeExamDto(IReadOnlyList<string>? ExamImageUrls = null, string? TextDescription = null);

/// <summary>Encerrar consulta: notas clínicas opcionais.</summary>
public record FinishConsultationDto(string? ClinicalNotes = null);

/// <summary>Resposta do accept-consultation. video_room em snake_case para compatibilidade com frontend.</summary>
public record AcceptConsultationResponseDto(
    RequestResponseDto Request,
    [property: JsonPropertyName("video_room")] VideoRoomResponseDto VideoRoom
);
