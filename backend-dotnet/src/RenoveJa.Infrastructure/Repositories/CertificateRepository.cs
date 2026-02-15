using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório para certificados digitais de médicos via Supabase REST API.
/// </summary>
public class CertificateRepository(SupabaseClient supabase) : ICertificateRepository
{
    private const string TableName = "doctor_certificates";

    public async Task<DoctorCertificate?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<CertificateModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model?.ToDomain();
    }

    public async Task<DoctorCertificate?> GetActiveByDoctorIdAsync(Guid doctorProfileId, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<CertificateModel>(
            TableName,
            filter: $"doctor_profile_id=eq.{doctorProfileId}&is_valid=eq.true&is_revoked=eq.false",
            cancellationToken: cancellationToken);

        // Check expiry in code (Supabase REST doesn't easily support now() comparison)
        if (model != null && model.NotAfter < DateTime.UtcNow)
            return null;

        return model?.ToDomain();
    }

    public async Task<List<DoctorCertificate>> GetByDoctorIdAsync(Guid doctorProfileId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<CertificateModel>(
            TableName,
            filter: $"doctor_profile_id=eq.{doctorProfileId}",
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(m => m.ToDomain()).ToList();
    }

    public async Task<DoctorCertificate> CreateAsync(DoctorCertificate certificate, CancellationToken cancellationToken = default)
    {
        var model = CertificateModel.FromDomain(certificate);
        var created = await supabase.InsertAsync<CertificateModel>(
            TableName,
            model,
            cancellationToken);

        return created.ToDomain();
    }

    public async Task<DoctorCertificate> UpdateAsync(DoctorCertificate certificate, CancellationToken cancellationToken = default)
    {
        var model = CertificateModel.FromDomain(certificate);
        var updated = await supabase.UpdateAsync<CertificateModel>(
            TableName,
            $"id=eq.{certificate.Id}",
            model,
            cancellationToken);

        return updated.ToDomain();
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        try
        {
            await supabase.DeleteAsync(
                TableName,
                $"id=eq.{id}",
                cancellationToken);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
