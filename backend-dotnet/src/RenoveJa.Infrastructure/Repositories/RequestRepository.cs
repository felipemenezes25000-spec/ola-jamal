using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

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
        var statusStr = status.ToString().ToLowerInvariant();
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
        var updated = await supabase.UpdateAsync<RequestModel>(
            TableName,
            $"id=eq.{request.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
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
            model.Status,
            model.PrescriptionType,
            model.Medications,
            model.PrescriptionImages,
            model.ExamType,
            model.Exams,
            model.Symptoms,
            model.Price,
            model.Notes,
            model.RejectionReason,
            model.SignedAt,
            model.SignedDocumentUrl,
            model.SignatureId,
            model.CreatedAt,
            model.UpdatedAt);
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
            Status = request.Status.ToString().ToLowerInvariant(),
            PrescriptionType = request.PrescriptionType?.ToString().ToLowerInvariant(),
            Medications = request.Medications,
            PrescriptionImages = request.PrescriptionImages,
            ExamType = request.ExamType,
            Exams = request.Exams,
            Symptoms = request.Symptoms,
            Price = request.Price?.Amount,
            Notes = request.Notes,
            RejectionReason = request.RejectionReason,
            SignedAt = request.SignedAt,
            SignedDocumentUrl = request.SignedDocumentUrl,
            SignatureId = request.SignatureId,
            CreatedAt = request.CreatedAt,
            UpdatedAt = request.UpdatedAt
        };
    }
}
