using System.Text.Json;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;
using RenoveJa.Infrastructure.Utils;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// RepositÃ³rio de solicitaÃ§Ãµes mÃ©dicas via Supabase.
/// </summary>
public class RequestRepository(PostgresClient supabase) : IRequestRepository
{
    private const string TableName = "requests";

    /// <summary>
    /// ObtÃ©m uma solicitaÃ§Ã£o pelo ID.
    /// </summary>
    public async Task<MedicalRequest?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<RequestModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<MedicalRequest?> GetByShortCodeAsync(string shortCode, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(shortCode) || shortCode.Length < 8)
            return null;
        var normalized = shortCode.ToLowerInvariant().Trim();
        if (normalized.Length > 12)
            normalized = normalized[..12];
        var model = await supabase.GetSingleAsync<RequestModel>(
            TableName,
            filter: $"short_code=eq.{normalized}",
            cancellationToken: cancellationToken);
        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<MedicalRequest>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<RequestModel>(
            TableName,
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<MedicalRequest>> GetByPatientIdAsync(Guid patientId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<RequestModel>(
            TableName,
            filter: $"patient_id=eq.{patientId}",
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<MedicalRequest>> GetByDoctorIdAsync(Guid doctorId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<RequestModel>(
            TableName,
            filter: $"doctor_id=eq.{doctorId}",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<MedicalRequest>> GetByStatusAsync(RequestStatus status, CancellationToken cancellationToken = default)
    {
        var statusStr = SnakeCaseHelper.ToSnakeCase(status.ToString());
        var models = await supabase.GetAllAsync<RequestModel>(
            TableName,
            filter: $"status=eq.{statusStr}",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<MedicalRequest>> GetByTypeAsync(RequestType type, CancellationToken cancellationToken = default)
    {
        var typeStr = type.ToString().ToLowerInvariant();
        var models = await supabase.GetAllAsync<RequestModel>(
            TableName,
            filter: $"request_type=eq.{typeStr}",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    /// <summary>
    /// Retorna solicitaÃ§Ãµes disponÃ­veis na fila para o mÃ©dico.
    ///
    /// Regras de elegibilidade por tipo (state machine canÃ´nica):
    ///   prescription / exam â†’ status = submitted (sem mÃ©dico atribuÃ­do)
    ///   consultation        â†’ status = searching_doctor (sem mÃ©dico atribuÃ­do)
    ///
    /// Status legados incluÃ­dos por retrocompatibilidade:
    ///   pending, analyzing â†’ equivalentes a submitted em dados histÃ³ricos
    ///
    /// ExcluÃ­dos intencionalmente:
    ///   in_review  â†’ mÃ©dico jÃ¡ atribuÃ­do (doctor_id setado)
    ///   paid       â†’ aguardando assinatura, nÃ£o pertence Ã  fila pÃºblica
    ///   approved   â†’ legado, equivalente a approved_pending_payment
    /// </summary>
    public async Task<List<MedicalRequest>> GetAvailableForQueueAsync(CancellationToken cancellationToken = default)
    {
        // Status canÃ´nicos + legados sem mÃ©dico atribuÃ­do.
        // "submitted" = fila de prescription/exam; "searching_doctor" = fila de consultation.
        // Legacy: "pending" e "analyzing" â†’ mesma semÃ¢ntica de "submitted".
        const string eligibleStatuses = "submitted,searching_doctor,pending,analyzing";
        var filter = $"status=in.({eligibleStatuses})&or=(doctor_id.is.null,doctor_id.eq.00000000-0000-0000-0000-000000000000)";

        var models = await supabase.GetAllAsync<RequestModel>(
            TableName,
            select: "*",
            filter: filter,
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<(int PendingCount, int InReviewCount, int CompletedCount, decimal TotalEarnings)> GetDoctorStatsAsync(Guid doctorId, CancellationToken cancellationToken = default)
    {
        // pending: sem mÃ©dico em submitted/paid (fila)
        var pendingFilter = "status=in.(submitted,paid)&or=(doctor_id.is.null,doctor_id.eq.00000000-0000-0000-0000-000000000000)";
        var pendingCount = await supabase.CountAsync(TableName, pendingFilter, cancellationToken);

        // inReview: com mÃ©dico em in_review, approved, signed, consultation_ready, in_consultation
        var inReviewFilter = $"doctor_id=eq.{doctorId}&status=in.(in_review,approved,signed,consultation_ready,in_consultation)";
        var inReviewCount = await supabase.CountAsync(TableName, inReviewFilter, cancellationToken);

        // completed: com mÃ©dico em completed, delivered, consultation_finished
        var completedFilter = $"doctor_id=eq.{doctorId}&status=in.(completed,delivered,consultation_finished)";
        var completedCount = await supabase.CountAsync(TableName, completedFilter, cancellationToken);

        // totalEarnings: soma de price dos completed
        var priceModels = await supabase.GetAllAsync<RequestPriceModel>(
            TableName,
            select: "price",
            filter: completedFilter,
            limit: 10000,
            cancellationToken: cancellationToken);
        var totalEarnings = priceModels.Sum(p => p.Price ?? 0);

        return (pendingCount, inReviewCount, completedCount, totalEarnings);
    }

    public async Task<List<MedicalRequest>> GetStaleApprovedPendingPaymentAsync(DateTime cutoffUtc, CancellationToken cancellationToken = default)
    {
        var cutoffStr = cutoffUtc.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
        var filter = $"status=eq.approved_pending_payment&updated_at=lt.{cutoffStr}";
        var models = await supabase.GetAllAsync<RequestModel>(
            TableName,
            filter: filter,
            cancellationToken: cancellationToken);
        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<MedicalRequest>> GetStaleInReviewAsync(DateTime cutoffUtc, CancellationToken cancellationToken = default)
    {
        var cutoffStr = cutoffUtc.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
        var filter = $"status=eq.in_review&updated_at=lt.{cutoffStr}&doctor_id=not.is.null";
        var models = await supabase.GetAllAsync<RequestModel>(
            TableName,
            filter: filter,
            cancellationToken: cancellationToken);
        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<MedicalRequest>> GetPrescriptionsExpiringSoonAsync(DateTime nowUtc, int daysAhead = 7, CancellationToken cancellationToken = default)
    {
        var filter = "request_type=eq.prescription&status=eq.delivered&signed_at=not.is.null";
        var models = await supabase.GetAllAsync<RequestModel>(
            TableName,
            filter: filter,
            cancellationToken: cancellationToken);

        var validDays = 30;
        var windowEnd = nowUtc.AddDays(daysAhead);

        return models
            .Where(m =>
            {
                if (!m.SignedAt.HasValue) return false;
                var days = m.PrescriptionValidDays ?? validDays;
                var validUntil = m.SignedAt.Value.AddDays(days);
                return validUntil >= nowUtc && validUntil <= windowEnd;
            })
            .Select(MapToDomain)
            .ToList();
    }

    public async Task<MedicalRequest> CreateAsync(MedicalRequest request, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(request);
        var created = await supabase.InsertAsync<RequestModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<MedicalRequest> UpdateAsync(MedicalRequest request, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(request);
        var updatePayload = new RequestUpdatePayload
        {
            PatientId = model.PatientId,
            PatientName = model.PatientName,
            DoctorId = model.DoctorId,
            DoctorName = model.DoctorName,
            RequestType = model.RequestType,
            Status = model.Status,
            PrescriptionType = model.PrescriptionType,
            PrescriptionKind = model.PrescriptionKind,
            Medications = model.Medications,
            PrescriptionImages = model.PrescriptionImages,
            ExamType = model.ExamType,
            Exams = model.Exams,
            ExamImages = model.ExamImages,
            Symptoms = model.Symptoms,
            // Envia null em vez de 0: constraint requests_price_positive rejeita 0 (consultas gratuitas via banco de horas)
            Price = model.Price == 0m ? null : model.Price,
            Notes = model.Notes,
            RejectionReason = model.RejectionReason,
            AccessCode = model.AccessCode,
            SignedAt = model.SignedAt,
            SignedDocumentUrl = model.SignedDocumentUrl,
            SignatureId = model.SignatureId,
            AiSummaryForDoctor = model.AiSummaryForDoctor,
            AiExtractedJson = model.AiExtractedJson,
            AiRiskLevel = model.AiRiskLevel,
            AiUrgency = model.AiUrgency,
            AiReadabilityOk = model.AiReadabilityOk,
            AiMessageToUser = model.AiMessageToUser,
            ConsultationType = model.ConsultationType,
            ContractedMinutes = model.ContractedMinutes,
            PricePerMinute = model.PricePerMinute,
            ConsultationStartedAt = model.ConsultationStartedAt,
            DoctorCallConnectedAt = model.DoctorCallConnectedAt,
            PatientCallConnectedAt = model.PatientCallConnectedAt,
            UpdatedAt = model.UpdatedAt
        };
        var updated = await supabase.UpdateAsync<RequestModel>(
            TableName,
            $"id=eq.{request.Id}",
            updatePayload,
            cancellationToken);

        return MapToDomain(updated);
    }

    private class RequestUpdatePayload
    {
        public Guid PatientId { get; set; }
        public string? PatientName { get; set; }
        public Guid? DoctorId { get; set; }
        public string? DoctorName { get; set; }
        public string RequestType { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? PrescriptionType { get; set; }
        public string? PrescriptionKind { get; set; }
        public string? Medications { get; set; }
        public string? PrescriptionImages { get; set; }
        public string? ExamType { get; set; }
        public string? Exams { get; set; }
        public string? ExamImages { get; set; }
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
        [System.Text.Json.Serialization.JsonPropertyName("consultation_type")]
        public string? ConsultationType { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("contracted_minutes")]
        public int? ContractedMinutes { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("price_per_minute")]
        public decimal? PricePerMinute { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("consultation_started_at")]
        public DateTime? ConsultationStartedAt { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("doctor_call_connected_at")]
        public DateTime? DoctorCallConnectedAt { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("patient_call_connected_at")]
        public DateTime? PatientCallConnectedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await supabase.DeleteAsync(
            TableName,
            $"id=eq.{id}",
            cancellationToken);
    }

    private static MedicalRequest MapToDomain(RequestModel model)
    {
        var snapshot = new MedicalRequestSnapshot
        {
            Id = model.Id,
            PatientId = model.PatientId,
            PatientName = model.PatientName,
            DoctorId = model.DoctorId,
            DoctorName = model.DoctorName,
            RequestType = model.RequestType,
            Status = SnakeCaseHelper.ToPascalCase(model.Status ?? ""),
            PrescriptionType = model.PrescriptionType,
            Medications = JsonToList(model.Medications),
            PrescriptionImages = JsonToList(model.PrescriptionImages),
            ExamType = model.ExamType,
            Exams = JsonToList(model.Exams),
            ExamImages = JsonToList(model.ExamImages),
            Symptoms = model.Symptoms,
            Price = model.Price,
            Notes = model.Notes,
            RejectionReason = model.RejectionReason,
            SignedAt = model.SignedAt,
            SignedDocumentUrl = model.SignedDocumentUrl,
            SignatureId = model.SignatureId,
            CreatedAt = model.CreatedAt,
            UpdatedAt = model.UpdatedAt,
            AiSummaryForDoctor = model.AiSummaryForDoctor,
            AiExtractedJson = model.AiExtractedJson,
            AiRiskLevel = model.AiRiskLevel,
            AiUrgency = model.AiUrgency,
            AiReadabilityOk = model.AiReadabilityOk,
            AiMessageToUser = model.AiMessageToUser,
            AccessCode = model.AccessCode,
            PrescriptionKind = !string.IsNullOrWhiteSpace(model.PrescriptionKind) ? SnakeCaseHelper.ToPascalCase(model.PrescriptionKind) : null,
            ConsultationType = model.ConsultationType,
            ContractedMinutes = model.ContractedMinutes,
            PricePerMinute = model.PricePerMinute,
            ConsultationStartedAt = model.ConsultationStartedAt,
            DoctorCallConnectedAt = model.DoctorCallConnectedAt,
            PatientCallConnectedAt = model.PatientCallConnectedAt,
            AutoObservation = model.AutoObservation,
            DoctorConductNotes = model.DoctorConductNotes,
            IncludeConductInPdf = model.IncludeConductInPdf,
            AiConductSuggestion = model.AiConductSuggestion,
            AiSuggestedExams = model.AiSuggestedExams,
            ConductUpdatedAt = model.ConductUpdatedAt,
            ConductUpdatedBy = model.ConductUpdatedBy,
        };

        return MedicalRequest.Reconstitute(snapshot);
    }

    private static string ToShortCode(Guid id) =>
        id.ToString("N")[..12].ToLowerInvariant();

    private static RequestModel MapToModel(MedicalRequest request)
    {
        return new RequestModel
        {
            Id = request.Id,
            ShortCode = ToShortCode(request.Id),
            PatientId = request.PatientId,
            PatientName = request.PatientName,
            DoctorId = request.DoctorId,
            DoctorName = request.DoctorName,
            RequestType = request.RequestType.ToString().ToLowerInvariant(),
            Status = SnakeCaseHelper.ToSnakeCase(request.Status.ToString()),
            PrescriptionType = request.PrescriptionType?.ToString().ToLowerInvariant(),
            PrescriptionKind = request.PrescriptionKind.HasValue ? SnakeCaseHelper.ToSnakeCase(request.PrescriptionKind.Value.ToString()) : null,
            Medications = ListToJson(request.Medications),
            PrescriptionImages = ListToJson(request.PrescriptionImages),
            ExamType = request.ExamType,
            Exams = ListToJson(request.Exams),
            ExamImages = ListToJson(request.ExamImages),
            Symptoms = request.Symptoms,
            Price = request.Price?.Amount,
            Notes = request.Notes,
            RejectionReason = request.RejectionReason,
            AccessCode = request.AccessCode,
            SignedAt = request.SignedAt,
            SignedDocumentUrl = request.SignedDocumentUrl,
            SignatureId = request.SignatureId,
            AiSummaryForDoctor = request.AiSummaryForDoctor,
            AiExtractedJson = request.AiExtractedJson,
            AiRiskLevel = request.AiRiskLevel,
            AiUrgency = request.AiUrgency,
            AiReadabilityOk = request.AiReadabilityOk,
            AiMessageToUser = request.AiMessageToUser,
            AutoObservation = request.AutoObservation,
            DoctorConductNotes = request.DoctorConductNotes,
            IncludeConductInPdf = request.IncludeConductInPdf,
            AiConductSuggestion = request.AiConductSuggestion,
            AiSuggestedExams = request.AiSuggestedExams,
            ConductUpdatedAt = request.ConductUpdatedAt,
            ConductUpdatedBy = request.ConductUpdatedBy,
            ConsultationType = request.ConsultationType,
            ContractedMinutes = request.ContractedMinutes,
            PricePerMinute = request.PricePerMinute,
            ConsultationStartedAt = request.ConsultationStartedAt,
            DoctorCallConnectedAt = request.DoctorCallConnectedAt,
            PatientCallConnectedAt = request.PatientCallConnectedAt,
            CreatedAt = request.CreatedAt,
            UpdatedAt = request.UpdatedAt
        };
    }
    private static string? ListToJson(List<string>? list) => list == null || list.Count == 0 ? null : JsonSerializer.Serialize(list);
    private static List<string> JsonToList(string? json) { if (string.IsNullOrWhiteSpace(json) || json == "null") return new(); try { return JsonSerializer.Deserialize<List<string>>(json) ?? new(); } catch { return new(); } }
}
