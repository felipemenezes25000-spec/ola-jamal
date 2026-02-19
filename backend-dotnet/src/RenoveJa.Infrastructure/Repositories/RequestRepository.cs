using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;
using RenoveJa.Infrastructure.Utils;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de solicitações médicas via Supabase.
/// </summary>
public class RequestRepository(SupabaseClient supabase) : IRequestRepository
{
    private const string TableName = "requests";

    /// <summary>
    /// Obtém uma solicitação pelo ID.
    /// </summary>
    public async Task<MedicalRequest?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<RequestModel>(
            TableName,
            filter: $"id=eq.{id}",
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
<<<<<<< HEAD
            PrescriptionKind = model.PrescriptionKind,
=======
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
            Medications = model.Medications,
            PrescriptionImages = model.PrescriptionImages,
            ExamType = model.ExamType,
            Exams = model.Exams,
            ExamImages = model.ExamImages,
            Symptoms = model.Symptoms,
            Price = model.Price,
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
<<<<<<< HEAD
        public string? PrescriptionKind { get; set; }
=======
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
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
        return MedicalRequest.Reconstitute(
            model.Id,
            model.PatientId,
            model.PatientName,
            model.DoctorId,
            model.DoctorName,
            model.RequestType,
            SnakeCaseHelper.ToPascalCase(model.Status ?? ""),
            model.PrescriptionType,
            model.Medications,
            model.PrescriptionImages,
            model.ExamType,
            model.Exams,
            model.ExamImages,
            model.Symptoms,
            model.Price,
            model.Notes,
            model.RejectionReason,
            model.SignedAt,
            model.SignedDocumentUrl,
            model.SignatureId,
            model.CreatedAt,
            model.UpdatedAt,
            model.AiSummaryForDoctor,
            model.AiExtractedJson,
            model.AiRiskLevel,
            model.AiUrgency,
            model.AiReadabilityOk,
            model.AiMessageToUser,
<<<<<<< HEAD
            model.AccessCode,
            prescriptionKind: !string.IsNullOrWhiteSpace(model.PrescriptionKind) ? SnakeCaseHelper.ToPascalCase(model.PrescriptionKind) : null);
=======
            model.AccessCode);
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
    }

    private static RequestModel MapToModel(MedicalRequest request)
    {
        return new RequestModel
        {
            Id = request.Id,
            PatientId = request.PatientId,
            PatientName = request.PatientName,
            DoctorId = request.DoctorId,
            DoctorName = request.DoctorName,
            RequestType = request.RequestType.ToString().ToLowerInvariant(),
            Status = SnakeCaseHelper.ToSnakeCase(request.Status.ToString()),
            PrescriptionType = request.PrescriptionType?.ToString().ToLowerInvariant(),
<<<<<<< HEAD
            PrescriptionKind = request.PrescriptionKind.HasValue ? SnakeCaseHelper.ToSnakeCase(request.PrescriptionKind.Value.ToString()) : null,
=======
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
            Medications = request.Medications,
            PrescriptionImages = request.PrescriptionImages,
            ExamType = request.ExamType,
            Exams = request.Exams,
            ExamImages = request.ExamImages,
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
            CreatedAt = request.CreatedAt,
            UpdatedAt = request.UpdatedAt
        };
    }
}
