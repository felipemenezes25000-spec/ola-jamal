using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório para certificados digitais de médicos via db REST API.
/// </summary>
public class CertificateRepository(PostgresClient db) : ICertificateRepository
{
    private const string TableName = "doctor_certificates";

    public async Task<DoctorCertificate?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await db.GetSingleAsync<CertificateModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model?.ToDomain();
    }

    public async Task<DoctorCertificate?> GetActiveByDoctorIdAsync(Guid doctorProfileId, CancellationToken cancellationToken = default)
    {
        var model = await db.GetSingleAsync<CertificateModel>(
            TableName,
            filter: $"doctor_profile_id=eq.{doctorProfileId}&is_valid=eq.true&is_revoked=eq.false",
            cancellationToken: cancellationToken);

        // Check expiry in code (db REST doesn't easily support now() comparison)
        if (model != null && model.NotAfter < DateTime.UtcNow)
            return null;

        return model?.ToDomain();
    }

    public async Task<List<DoctorCertificate>> GetByDoctorIdAsync(Guid doctorProfileId, CancellationToken cancellationToken = default)
    {
        var models = await db.GetAllAsync<CertificateModel>(
            TableName,
            filter: $"doctor_profile_id=eq.{doctorProfileId}",
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(m => m.ToDomain()).ToList();
    }

    public async Task<DoctorCertificate> CreateAsync(DoctorCertificate certificate, CancellationToken cancellationToken = default)
    {
        var model = CertificateModel.FromDomain(certificate);
        var created = await db.InsertAsync<CertificateModel>(
            TableName,
            model,
            cancellationToken);

        return created.ToDomain();
    }

    public async Task<DoctorCertificate> UpdateAsync(DoctorCertificate certificate, CancellationToken cancellationToken = default)
    {
        var model = CertificateModel.FromDomain(certificate);
        var updated = await db.UpdateAsync<CertificateModel>(
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
            await db.DeleteAsync(
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

    public async Task<List<DoctorCertificate>> GetExpiringAsync(int withinDays, CancellationToken cancellationToken = default)
    {
        // Fetch all valid, non-revoked certificates and filter expiry in code
        // (db REST API doesn't support date arithmetic easily)
        var models = await db.GetAllAsync<CertificateModel>(
            TableName,
            filter: "is_valid=eq.true&is_revoked=eq.false",
            cancellationToken: cancellationToken);

        var now = DateTime.UtcNow;
        var cutoff = now.AddDays(withinDays);

        return models
            .Where(m => m.NotAfter > now && m.NotAfter <= cutoff)
            .Select(m => m.ToDomain())
            .ToList();
    }
}
