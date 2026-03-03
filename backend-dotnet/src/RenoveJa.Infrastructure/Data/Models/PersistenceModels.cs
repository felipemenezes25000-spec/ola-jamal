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
    public string? Gender { get; set; }
    public string? Address { get; set; }
    public string? Street { get; set; }
    public string? Number { get; set; }
    public string? Neighborhood { get; set; }
    public string? Complement { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    [JsonPropertyName("postal_code")]
    public string? PostalCode { get; set; }
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
    [JsonPropertyName("professional_address")]
    public string? ProfessionalAddress { get; set; }
    [JsonPropertyName("professional_phone")]
    public string? ProfessionalPhone { get; set; }
    public string? Bio { get; set; }
    public decimal Rating { get; set; }
    public int TotalConsultations { get; set; }
    public bool Available { get; set; }
    public Guid? ActiveCertificateId { get; set; }
    public bool CrmValidated { get; set; }
    public DateTime? CrmValidatedAt { get; set; }
    [JsonPropertyName("approval_status")]
    public string ApprovalStatus { get; set; } = "pending";
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
            ProfessionalAddress = profile.ProfessionalAddress,
            ProfessionalPhone = profile.ProfessionalPhone,
            Bio = profile.Bio,
            Rating = profile.Rating,
            TotalConsultations = profile.TotalConsultations,
            Available = profile.Available,
            ActiveCertificateId = profile.ActiveCertificateId,
            CrmValidated = profile.CrmValidated,
            CrmValidatedAt = profile.CrmValidatedAt,
            CreatedAt = profile.CreatedAt,
            ApprovalStatus = profile.ApprovalStatus.ToString().ToLowerInvariant()
        };
    }

    public RenoveJa.Domain.Entities.DoctorProfile ToDomain()
    {
        var status = ApprovalStatus?.ToLowerInvariant() switch
        {
            "approved" => RenoveJa.Domain.Enums.DoctorApprovalStatus.Approved,
            "rejected" => RenoveJa.Domain.Enums.DoctorApprovalStatus.Rejected,
            _ => RenoveJa.Domain.Enums.DoctorApprovalStatus.Pending
        };

        return RenoveJa.Domain.Entities.DoctorProfile.Reconstitute(
            Id, UserId, Crm, CrmState, Specialty, Bio,
            Rating, TotalConsultations, Available,
            status,
            ActiveCertificateId, CrmValidated, CrmValidatedAt, CreatedAt,
            ProfessionalAddress, ProfessionalPhone);
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
    [JsonPropertyName("prescription_kind")]
    public string? PrescriptionKind { get; set; }
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
    [JsonPropertyName("auto_observation")]
    public string? AutoObservation { get; set; }
    [JsonPropertyName("doctor_conduct_notes")]
    public string? DoctorConductNotes { get; set; }
    [JsonPropertyName("include_conduct_in_pdf")]
    public bool? IncludeConductInPdf { get; set; }
    [JsonPropertyName("ai_conduct_suggestion")]
    public string? AiConductSuggestion { get; set; }
    [JsonPropertyName("ai_suggested_exams")]
    public string? AiSuggestedExams { get; set; }
    [JsonPropertyName("conduct_updated_at")]
    public DateTime? ConductUpdatedAt { get; set; }
    [JsonPropertyName("conduct_updated_by")]
    public Guid? ConductUpdatedBy { get; set; }
    [JsonPropertyName("consultation_type")]
    public string? ConsultationType { get; set; }
    [JsonPropertyName("contracted_minutes")]
    public int? ContractedMinutes { get; set; }
    [JsonPropertyName("price_per_minute")]
    public decimal? PricePerMinute { get; set; }
    [JsonPropertyName("consultation_started_at")]
    public DateTime? ConsultationStartedAt { get; set; }
    [JsonPropertyName("doctor_call_connected_at")]
    public DateTime? DoctorCallConnectedAt { get; set; }
    [JsonPropertyName("patient_call_connected_at")]
    public DateTime? PatientCallConnectedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Projeção mínima para soma de preços (requests).</summary>
public class RequestPriceModel
{
    public decimal? Price { get; set; }
}

/// <summary>Modelo de persistência de cartão salvo (tabela saved_cards).</summary>
public class SavedCardModel
{
    public Guid Id { get; set; }
    [JsonPropertyName("user_id")]
    public Guid UserId { get; set; }
    [JsonPropertyName("mp_customer_id")]
    public string MpCustomerId { get; set; } = string.Empty;
    [JsonPropertyName("mp_card_id")]
    public string MpCardId { get; set; } = string.Empty;
    [JsonPropertyName("last_four")]
    public string LastFour { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }
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

/// <summary>Modelo de persistência de tentativa de pagamento (tabela payment_attempts).</summary>
public class PaymentAttemptModel
{
    public Guid Id { get; set; }
    [JsonPropertyName("payment_id")]
    public Guid PaymentId { get; set; }
    [JsonPropertyName("request_id")]
    public Guid RequestId { get; set; }
    [JsonPropertyName("user_id")]
    public Guid UserId { get; set; }
    [JsonPropertyName("correlation_id")]
    public string CorrelationId { get; set; } = string.Empty;
    [JsonPropertyName("payment_method")]
    public string PaymentMethod { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    [JsonPropertyName("mercado_pago_payment_id")]
    public string? MercadoPagoPaymentId { get; set; }
    [JsonPropertyName("mercado_pago_preference_id")]
    public string? MercadoPagoPreferenceId { get; set; }
    [JsonPropertyName("request_url")]
    public string? RequestUrl { get; set; }
    [JsonPropertyName("request_payload")]
    public string? RequestPayload { get; set; }
    [JsonPropertyName("response_payload")]
    public string? ResponsePayload { get; set; }
    [JsonPropertyName("response_status_code")]
    public int? ResponseStatusCode { get; set; }
    [JsonPropertyName("response_status_detail")]
    public string? ResponseStatusDetail { get; set; }
    [JsonPropertyName("response_headers")]
    public string? ResponseHeaders { get; set; }
    [JsonPropertyName("error_message")]
    public string? ErrorMessage { get; set; }
    [JsonPropertyName("is_success")]
    public bool IsSuccess { get; set; }
    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }
    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; }

    public static PaymentAttemptModel FromDomain(RenoveJa.Domain.Entities.PaymentAttempt attempt)
    {
        return new PaymentAttemptModel
        {
            Id = attempt.Id,
            PaymentId = attempt.PaymentId,
            RequestId = attempt.RequestId,
            UserId = attempt.UserId,
            CorrelationId = attempt.CorrelationId,
            PaymentMethod = attempt.PaymentMethod,
            Amount = attempt.Amount,
            MercadoPagoPaymentId = attempt.MercadoPagoPaymentId,
            MercadoPagoPreferenceId = attempt.MercadoPagoPreferenceId,
            RequestUrl = attempt.RequestUrl,
            RequestPayload = attempt.RequestPayload,
            ResponsePayload = attempt.ResponsePayload,
            ResponseStatusCode = attempt.ResponseStatusCode,
            ResponseStatusDetail = attempt.ResponseStatusDetail,
            ResponseHeaders = attempt.ResponseHeaders,
            ErrorMessage = attempt.ErrorMessage,
            IsSuccess = attempt.IsSuccess,
            CreatedAt = attempt.CreatedAt,
            UpdatedAt = attempt.UpdatedAt
        };
    }

    public RenoveJa.Domain.Entities.PaymentAttempt ToDomain()
    {
        var attempt = new RenoveJa.Domain.Entities.PaymentAttempt(
            PaymentId,
            RequestId,
            UserId,
            CorrelationId,
            PaymentMethod,
            Amount,
            RequestUrl,
            RequestPayload);
        
        // Usar reflection para setar propriedades privadas ou criar método público
        // Por enquanto, vamos criar um método de reconstituição na entidade
        return attempt;
    }
}

/// <summary>Modelo de persistência de evento de webhook (tabela webhook_events).</summary>
public class WebhookEventModel
{
    public Guid Id { get; set; }
    // Campos legados da tabela original
    [JsonPropertyName("event_id")]
    public string? EventId { get; set; }
    [JsonPropertyName("event_type")]
    public string? EventType { get; set; }
    [JsonPropertyName("source")]
    public string? Source { get; set; }
    [JsonPropertyName("payload")]
    public string? Payload { get; set; }
    [JsonPropertyName("status")]
    public string? Status { get; set; }
    [JsonPropertyName("error_message")]
    public string? ErrorMessage { get; set; }
    // Campos do nosso modelo
    [JsonPropertyName("correlation_id")]
    public string? CorrelationId { get; set; }
    [JsonPropertyName("mercado_pago_payment_id")]
    public string? MercadoPagoPaymentId { get; set; }
    [JsonPropertyName("mercado_pago_request_id")]
    public string? MercadoPagoRequestId { get; set; }
    [JsonPropertyName("webhook_type")]
    public string? WebhookType { get; set; }
    [JsonPropertyName("webhook_action")]
    public string? WebhookAction { get; set; }
    [JsonPropertyName("raw_payload")]
    public string? RawPayload { get; set; }
    [JsonPropertyName("processed_payload")]
    public string? ProcessedPayload { get; set; }
    [JsonPropertyName("query_string")]
    public string? QueryString { get; set; }
    [JsonPropertyName("request_headers")]
    public string? RequestHeaders { get; set; }
    [JsonPropertyName("content_type")]
    public string? ContentType { get; set; }
    [JsonPropertyName("content_length")]
    public int? ContentLength { get; set; }
    [JsonPropertyName("source_ip")]
    public string? SourceIp { get; set; }
    [JsonPropertyName("is_duplicate")]
    public bool IsDuplicate { get; set; }
    [JsonPropertyName("is_processed")]
    public bool IsProcessed { get; set; }
    [JsonPropertyName("processing_error")]
    public string? ProcessingError { get; set; }
    [JsonPropertyName("payment_status")]
    public string? PaymentStatus { get; set; }
    [JsonPropertyName("payment_status_detail")]
    public string? PaymentStatusDetail { get; set; }
    [JsonPropertyName("processed_at")]
    public DateTime? ProcessedAt { get; set; }
    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }
    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; }

    public static WebhookEventModel FromDomain(RenoveJa.Domain.Entities.WebhookEvent webhook)
    {
        return new WebhookEventModel
        {
            Id = webhook.Id,
            // Campos legados - preencher para compatibilidade com tabela existente
            EventId = webhook.MercadoPagoRequestId ?? webhook.Id.ToString(),
            EventType = webhook.WebhookType ?? "payment",
            Source = "mercadopago",
            Payload = webhook.RawPayload,
            Status = webhook.IsProcessed ? "processed" : (webhook.ProcessingError != null ? "failed" : "pending"),
            ErrorMessage = webhook.ProcessingError,
            // Campos do nosso modelo
            CorrelationId = webhook.CorrelationId,
            MercadoPagoPaymentId = webhook.MercadoPagoPaymentId,
            MercadoPagoRequestId = webhook.MercadoPagoRequestId,
            WebhookType = webhook.WebhookType,
            WebhookAction = webhook.WebhookAction,
            RawPayload = webhook.RawPayload,
            ProcessedPayload = webhook.ProcessedPayload,
            QueryString = webhook.QueryString,
            RequestHeaders = webhook.RequestHeaders,
            ContentType = webhook.ContentType,
            ContentLength = webhook.ContentLength,
            SourceIp = webhook.SourceIp,
            IsDuplicate = webhook.IsDuplicate,
            IsProcessed = webhook.IsProcessed,
            ProcessingError = webhook.ProcessingError,
            PaymentStatus = webhook.PaymentStatus,
            PaymentStatusDetail = webhook.PaymentStatusDetail,
            ProcessedAt = webhook.ProcessedAt,
            CreatedAt = webhook.CreatedAt,
            UpdatedAt = webhook.UpdatedAt
        };
    }

    public RenoveJa.Domain.Entities.WebhookEvent ToDomain()
    {
        return RenoveJa.Domain.Entities.WebhookEvent.Reconstitute(
            Id,
            CorrelationId, // CorrelationId é o campo principal
            MercadoPagoPaymentId,
            MercadoPagoRequestId,
            WebhookType,
            WebhookAction,
            RawPayload,
            ProcessedPayload,
            QueryString,
            RequestHeaders,
            ContentType,
            ContentLength,
            SourceIp,
            IsDuplicate,
            IsProcessed,
            ProcessingError,
            PaymentStatus,
            PaymentStatusDetail,
            ProcessedAt,
            CreatedAt,
            UpdatedAt);
    }
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

/// <summary>Modelo de persistência de paciente clínico (tabela patients).</summary>
public class PatientModel
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Cpf { get; set; } = string.Empty;
    public DateTime? BirthDate { get; set; }
    public string? Sex { get; set; }
    public string? SocialName { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? AddressLine1 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? ZipCode { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Modelo de persistência de encontro clínico (tabela encounters).</summary>
public class EncounterModel
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid PractitionerId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = "draft";
    public DateTime StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public string? Channel { get; set; }
    public string? Reason { get; set; }
    public string? Anamnesis { get; set; }
    public string? PhysicalExam { get; set; }
    public string? Plan { get; set; }
    public string? MainIcd10Code { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Modelo de persistência de documento médico (tabela medical_documents).</summary>
public class MedicalDocumentModel
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid PractitionerId { get; set; }
    public Guid? EncounterId { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string Status { get; set; } = "draft";
    public Guid? PreviousDocumentId { get; set; }
    public List<string> Medications { get; set; } = new();
    public List<string> Exams { get; set; } = new();
    public string? ReportBody { get; set; }
    public string? ClinicalJustification { get; set; }
    public string? Priority { get; set; }
    public string? Icd10Code { get; set; }
    public int? LeaveDays { get; set; }
    public string? GeneralInstructions { get; set; }
    public string? SignatureHash { get; set; }
    public string? SignatureAlgorithm { get; set; }
    public string? SignatureCertificate { get; set; }
    public DateTime? SignedAt { get; set; }
    public bool? SignatureIsValid { get; set; }
    public string? SignatureValidationResult { get; set; }
    public string? SignaturePolicyOid { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Modelo de persistência de registro de consentimento (tabela consent_records).</summary>
public class ConsentRecordModel
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string ConsentType { get; set; } = string.Empty;
    public string LegalBasis { get; set; } = string.Empty;
    public string Purpose { get; set; } = string.Empty;
    public DateTime AcceptedAt { get; set; }
    public string Channel { get; set; } = string.Empty;
    public string? TextVersion { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Modelo de persistência de evento de auditoria clínica (tabela audit_events).</summary>
public class AuditEventModel
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public string? Channel { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? CorrelationId { get; set; }
    public DateTime CreatedAt { get; set; }
}
