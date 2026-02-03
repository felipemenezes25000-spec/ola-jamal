using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

public class DoctorRepository : IDoctorRepository
{
    private readonly SupabaseClient _supabase;
    private const string TableName = "doctor_profiles";

    public DoctorRepository(SupabaseClient supabase)
    {
        _supabase = supabase;
    }

    public async Task<DoctorProfile?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await _supabase.GetSingleAsync<DoctorProfileModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<DoctorProfile?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var model = await _supabase.GetSingleAsync<DoctorProfileModel>(
            TableName,
            filter: $"user_id=eq.{userId}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<DoctorProfile>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var models = await _supabase.GetAllAsync<DoctorProfileModel>(
            TableName,
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<DoctorProfile>> GetBySpecialtyAsync(string specialty, CancellationToken cancellationToken = default)
    {
        var models = await _supabase.GetAllAsync<DoctorProfileModel>(
            TableName,
            filter: $"specialty=eq.{specialty}",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<DoctorProfile>> GetAvailableAsync(string? specialty = null, CancellationToken cancellationToken = default)
    {
        var filter = "available=eq.true";
        if (!string.IsNullOrWhiteSpace(specialty))
            filter += $"&specialty=eq.{specialty}";

        var models = await _supabase.GetAllAsync<DoctorProfileModel>(
            TableName,
            filter: filter,
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<DoctorProfile> CreateAsync(DoctorProfile doctorProfile, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(doctorProfile);
        var created = await _supabase.InsertAsync<DoctorProfileModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<DoctorProfile> UpdateAsync(DoctorProfile doctorProfile, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(doctorProfile);
        var updated = await _supabase.UpdateAsync<DoctorProfileModel>(
            TableName,
            $"id=eq.{doctorProfile.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await _supabase.DeleteAsync(
            TableName,
            $"id=eq.{id}",
            cancellationToken);
    }

    private static DoctorProfile MapToDomain(DoctorProfileModel model)
    {
        return DoctorProfile.Reconstitute(
            model.Id,
            model.UserId,
            model.Crm,
            model.CrmState,
            model.Specialty,
            model.Bio,
            model.Rating,
            model.TotalConsultations,
            model.Available,
            model.CreatedAt);
    }

    private static DoctorProfileModel MapToModel(DoctorProfile profile)
    {
        return new DoctorProfileModel
        {
            Id = profile.Id,
            UserId = profile.UserId,
            Crm = profile.Crm,
            CrmState = profile.CrmState,
            Specialty = profile.Specialty,
            Bio = profile.Bio,
            Rating = profile.Rating,
            TotalConsultations = profile.TotalConsultations,
            Available = profile.Available,
            CreatedAt = profile.CreatedAt
        };
    }
}

public class AuthTokenRepository : IAuthTokenRepository
{
    private readonly SupabaseClient _supabase;
    private const string TableName = "auth_tokens";

    public AuthTokenRepository(SupabaseClient supabase)
    {
        _supabase = supabase;
    }

    public async Task<AuthToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var model = await _supabase.GetSingleAsync<AuthTokenModel>(
            TableName,
            filter: $"token=eq.{token}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<AuthToken>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var models = await _supabase.GetAllAsync<AuthTokenModel>(
            TableName,
            filter: $"user_id=eq.{userId}",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<AuthToken> CreateAsync(AuthToken authToken, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(authToken);
        var created = await _supabase.InsertAsync<AuthTokenModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await _supabase.DeleteAsync(
            TableName,
            $"id=eq.{id}",
            cancellationToken);
    }

    public async Task DeleteByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        await _supabase.DeleteAsync(
            TableName,
            $"token=eq.{token}",
            cancellationToken);
    }

    public async Task DeleteExpiredTokensAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        await _supabase.DeleteAsync(
            TableName,
            $"expires_at=lt.{now:O}",
            cancellationToken);
    }

    private static AuthToken MapToDomain(AuthTokenModel model)
    {
        return AuthToken.Reconstitute(
            model.Id,
            model.UserId,
            model.Token,
            model.ExpiresAt,
            model.CreatedAt);
    }

    private static AuthTokenModel MapToModel(AuthToken token)
    {
        return new AuthTokenModel
        {
            Id = token.Id,
            UserId = token.UserId,
            Token = token.Token,
            ExpiresAt = token.ExpiresAt,
            CreatedAt = token.CreatedAt
        };
    }
}

public class RequestRepository : IRequestRepository
{
    private readonly SupabaseClient _supabase;
    private const string TableName = "requests";

    public RequestRepository(SupabaseClient supabase)
    {
        _supabase = supabase;
    }

    public async Task<MedicalRequest?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await _supabase.GetSingleAsync<RequestModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<MedicalRequest>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var models = await _supabase.GetAllAsync<RequestModel>(
            TableName,
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<MedicalRequest>> GetByPatientIdAsync(Guid patientId, CancellationToken cancellationToken = default)
    {
        var models = await _supabase.GetAllAsync<RequestModel>(
            TableName,
            filter: $"patient_id=eq.{patientId}",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<MedicalRequest>> GetByDoctorIdAsync(Guid doctorId, CancellationToken cancellationToken = default)
    {
        var models = await _supabase.GetAllAsync<RequestModel>(
            TableName,
            filter: $"doctor_id=eq.{doctorId}",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<MedicalRequest>> GetByStatusAsync(RenoveJa.Domain.Enums.RequestStatus status, CancellationToken cancellationToken = default)
    {
        var statusStr = status.ToString().ToLowerInvariant();
        var models = await _supabase.GetAllAsync<RequestModel>(
            TableName,
            filter: $"status=eq.{statusStr}",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<MedicalRequest>> GetByTypeAsync(RenoveJa.Domain.Enums.RequestType type, CancellationToken cancellationToken = default)
    {
        var typeStr = type.ToString().ToLowerInvariant();
        var models = await _supabase.GetAllAsync<RequestModel>(
            TableName,
            filter: $"request_type=eq.{typeStr}",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<MedicalRequest> CreateAsync(MedicalRequest request, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(request);
        var created = await _supabase.InsertAsync<RequestModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<MedicalRequest> UpdateAsync(MedicalRequest request, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(request);
        var updated = await _supabase.UpdateAsync<RequestModel>(
            TableName,
            $"id=eq.{request.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await _supabase.DeleteAsync(
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

public class PaymentRepository : IPaymentRepository
{
    private readonly SupabaseClient _supabase;
    private const string TableName = "payments";

    public PaymentRepository(SupabaseClient supabase)
    {
        _supabase = supabase;
    }

    public async Task<Payment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await _supabase.GetSingleAsync<PaymentModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<Payment?> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        var model = await _supabase.GetSingleAsync<PaymentModel>(
            TableName,
            filter: $"request_id=eq.{requestId}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<Payment?> GetByExternalIdAsync(string externalId, CancellationToken cancellationToken = default)
    {
        var model = await _supabase.GetSingleAsync<PaymentModel>(
            TableName,
            filter: $"external_id=eq.{externalId}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<Payment>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var models = await _supabase.GetAllAsync<PaymentModel>(
            TableName,
            filter: $"user_id=eq.{userId}",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<Payment> CreateAsync(Payment payment, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(payment);
        var created = await _supabase.InsertAsync<PaymentModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<Payment> UpdateAsync(Payment payment, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(payment);
        var updated = await _supabase.UpdateAsync<PaymentModel>(
            TableName,
            $"id=eq.{payment.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await _supabase.DeleteAsync(
            TableName,
            $"id=eq.{id}",
            cancellationToken);
    }

    private static Payment MapToDomain(PaymentModel model)
    {
        return Payment.Reconstitute(
            model.Id,
            model.RequestId,
            model.UserId,
            model.Amount,
            model.Status,
            model.PaymentMethod,
            model.ExternalId,
            model.PixQrCode,
            model.PixQrCodeBase64,
            model.PixCopyPaste,
            model.PaidAt,
            model.CreatedAt,
            model.UpdatedAt);
    }

    private static PaymentModel MapToModel(Payment payment)
    {
        return new PaymentModel
        {
            Id = payment.Id,
            RequestId = payment.RequestId,
            UserId = payment.UserId,
            Amount = payment.Amount.Amount,
            Status = payment.Status.ToString().ToLowerInvariant(),
            PaymentMethod = payment.PaymentMethod,
            ExternalId = payment.ExternalId,
            PixQrCode = payment.PixQrCode,
            PixQrCodeBase64 = payment.PixQrCodeBase64,
            PixCopyPaste = payment.PixCopyPaste,
            PaidAt = payment.PaidAt,
            CreatedAt = payment.CreatedAt,
            UpdatedAt = payment.UpdatedAt
        };
    }
}
