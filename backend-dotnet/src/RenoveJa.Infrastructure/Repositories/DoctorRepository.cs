using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de perfis de médicos via db.
/// </summary>
public class DoctorRepository(PostgresClient db) : IDoctorRepository
{
    private const string TableName = "doctor_profiles";

    /// <summary>
    /// Obtém um perfil de médico pelo ID.
    /// </summary>
    public async Task<DoctorProfile?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await db.GetSingleAsync<DoctorProfileModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<DoctorProfile?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var model = await db.GetSingleAsync<DoctorProfileModel>(
            TableName,
            filter: $"user_id=eq.{userId}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<DoctorProfile>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var models = await db.GetAllAsync<DoctorProfileModel>(
            TableName,
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<DoctorProfile>> GetBySpecialtyAsync(string specialty, CancellationToken cancellationToken = default)
    {
        var sanitized = SanitizeFilterValue(specialty);
        var models = await db.GetAllAsync<DoctorProfileModel>(
            TableName,
            filter: $"specialty=eq.{sanitized}",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<DoctorProfile>> GetAvailableAsync(string? specialty = null, CancellationToken cancellationToken = default)
    {
        var filter = "available=eq.true&approval_status=eq.approved";
        if (!string.IsNullOrWhiteSpace(specialty))
            filter += $"&specialty=eq.{SanitizeFilterValue(specialty)}";

        var models = await db.GetAllAsync<DoctorProfileModel>(
            TableName,
            filter: filter,
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<(List<DoctorProfile> Items, int TotalCount)> GetPagedAsync(string? specialty, bool? available, int offset, int limit, CancellationToken cancellationToken = default)
    {
        string? filter = null;
        var sanitizedSpecialty = specialty != null ? SanitizeFilterValue(specialty) : null;
        if (available == true)
        {
            filter = "available=eq.true&approval_status=eq.approved";
            if (!string.IsNullOrWhiteSpace(sanitizedSpecialty))
                filter += $"&specialty=eq.{sanitizedSpecialty}";
        }
        else if (!string.IsNullOrWhiteSpace(sanitizedSpecialty))
        {
            filter = $"specialty=eq.{sanitizedSpecialty}";
        }

        var models = await db.GetAllAsync<DoctorProfileModel>(
            TableName,
            filter: filter,
            limit: limit,
            offset: offset,
            cancellationToken: cancellationToken);

        var totalCount = await db.CountAsync(TableName, filter: filter, cancellationToken: cancellationToken);
        var items = models.Select(MapToDomain).ToList();
        return (items, totalCount);
    }

    public async Task<DoctorProfile> CreateAsync(DoctorProfile doctorProfile, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(doctorProfile);
        var created = await db.InsertAsync<DoctorProfileModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<DoctorProfile> UpdateAsync(DoctorProfile doctorProfile, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(doctorProfile);
        var updated = await db.UpdateAsync<DoctorProfileModel>(
            TableName,
            $"id=eq.{doctorProfile.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await db.DeleteAsync(
            TableName,
            $"id=eq.{id}",
            cancellationToken);
    }

    /// <summary>
    /// Sanitizes a user-supplied value before embedding in a PostgREST-style filter string.
    /// Strips characters that could inject additional filter segments (e.g. '&', '=', '(', ')').
    /// </summary>
    private static string SanitizeFilterValue(string value)
    {
        // Remove characters that have structural meaning in PostgREST filter syntax
        return new string(value.Where(c => c != '&' && c != '=' && c != '(' && c != ')').ToArray());
    }

    private static DoctorProfile MapToDomain(DoctorProfileModel model)
    {
        var approvalStatus = model.ApprovalStatus?.ToLowerInvariant() switch
        {
            "approved" => DoctorApprovalStatus.Approved,
            "rejected" => DoctorApprovalStatus.Rejected,
            _ => DoctorApprovalStatus.Pending
        };

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
            approvalStatus,
            model.ActiveCertificateId,
            model.CrmValidated,
            model.CrmValidatedAt,
            model.CreatedAt,
            model.ProfessionalAddress,
            model.ProfessionalPhone,
            model.University,
            model.Courses,
            model.HospitalsServices,
            model.ProfessionalPostalCode,
            model.ProfessionalStreet,
            model.ProfessionalNumber,
            model.ProfessionalNeighborhood,
            model.ProfessionalComplement,
            model.ProfessionalCity,
            model.ProfessionalState);
    }

    private static DoctorProfileModel MapToModel(DoctorProfile profile)
    {
        return DoctorProfileModel.FromDomain(profile);
    }
}
