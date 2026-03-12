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
    string Symptoms,
    string ConsultationType = "medico_clinico",
    int DurationMinutes = 15
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
    string? ConsultationAiSuggestions = null,
    /// <summary>JSON com artigos científicos (provider, url, title, clinicalRelevance) que apoiam o CID sugerido.</summary>
    string? ConsultationEvidence = null,
    string? ConsultationType = null,
    int? ContractedMinutes = null,
    decimal? PricePerMinute = null,
    /// <summary>Quando o médico iniciou a consulta (sincroniza o timer entre médico e paciente).</summary>
    DateTime? ConsultationStartedAt = null,
    string? AutoObservation = null,
    string? DoctorConductNotes = null,
    bool IncludeConductInPdf = true,
    string? AiConductSuggestion = null,
    string? AiSuggestedExams = null,
    DateTime? ConductUpdatedAt = null,
    Guid? ConductUpdatedBy = null,
    /// <summary>Dias de validade da receita a partir de SignedAt. Null = usa default do backend (30 dias).</summary>
    int? PrescriptionValidDays = null
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

/// <summary>Salvar nota clínica editada no prontuário (writeback do resumo da consulta).</summary>
public record SaveConsultationSummaryDto(string? Anamnesis = null, string? Plan = null);

/// <summary>Médico atualiza conduta e observações do pedido.</summary>
public record UpdateConductDto(
    string? ConductNotes = null,
    bool IncludeConductInPdf = true,
    /// <summary>Se informado, médico sobrescreve a observação automática (null = remover, string = editar).</summary>
    string? AutoObservationOverride = null,
    /// <summary>Se true, aplica o override da observação. Se false/omitido, mantém a observação original.</summary>
    bool ApplyObservationOverride = false
);

/// <summary>Resposta do accept-consultation. video_room em snake_case para compatibilidade com frontend.</summary>
public record AcceptConsultationResponseDto(
    RequestResponseDto Request,
    [property: JsonPropertyName("video_room")] VideoRoomResponseDto VideoRoom
);

/// <summary>Perfil do paciente para visualização pelo médico (identificação do paciente).</summary>
public record PatientProfileForDoctorDto(
    string Name,
    string? Email,
    string? Phone,
    DateTime? BirthDate,
    string? CpfMasked,
    string? Gender,
    string? Street,
    string? Number,
    string? Neighborhood,
    string? Complement,
    string? City,
    string? State,
    string? PostalCode,
    string? AvatarUrl
);

/// <summary>Nota clínica do médico (resposta API).</summary>
public record DoctorNoteDto(
    Guid Id,
    string NoteType,
    string Content,
    Guid? RequestId,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

/// <summary>Criação de nota clínica.</summary>
public record CreateDoctorNoteDto(
    string NoteType,
    string Content,
    Guid? RequestId
);
