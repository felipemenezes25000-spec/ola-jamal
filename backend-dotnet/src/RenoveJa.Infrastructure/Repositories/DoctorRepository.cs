using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de perfis de médicos via Supabase.
/// </summary>
public class DoctorRepository(SupabaseClient supabase) : IDoctorRepository
{
    private const string TableName = "doctor_profiles";

    /// <summary>
    /// Obtém um perfil de médico pelo ID.
    /// </summary>
    public async Task<DoctorProfile?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<DoctorProfileModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<DoctorProfile?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<DoctorProfileModel>(
            TableName,
            filter: $"user_id=eq.{userId}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<DoctorProfile>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<DoctorProfileModel>(
            TableName,
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<DoctorProfile>> GetBySpecialtyAsync(string specialty, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<DoctorProfileModel>(
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

        var models = await supabase.GetAllAsync<DoctorProfileModel>(
            TableName,
            filter: filter,
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<DoctorProfile> CreateAsync(DoctorProfile doctorProfile, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(doctorProfile);
        var created = await supabase.InsertAsync<DoctorProfileModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<DoctorProfile> UpdateAsync(DoctorProfile doctorProfile, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(doctorProfile);
        var updated = await supabase.UpdateAsync<DoctorProfileModel>(
            TableName,
            $"id=eq.{doctorProfile.Id}",
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
            model.ActiveCertificateId,
            model.CrmValidated,
            model.CrmValidatedAt,
            model.CreatedAt,
            model.ProfessionalAddress,
            model.ProfessionalPhone);
    }

    private static DoctorProfileModel MapToModel(DoctorProfile profile)
    {
        return DoctorProfileModel.FromDomain(profile);
    }
}
