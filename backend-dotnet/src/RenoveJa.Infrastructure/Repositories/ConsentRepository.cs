using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;
using RenoveJa.Infrastructure.Utils;

namespace RenoveJa.Infrastructure.Repositories;

public class ConsentRepository(PostgresClient supabase) : IConsentRepository
{
    private const string TableName = "consent_records";

    public async Task<ConsentRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<ConsentRecordModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<ConsentRecord>> GetByPatientIdAsync(Guid patientId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<ConsentRecordModel>(
            TableName,
            filter: $"patient_id=eq.{patientId}",
            orderBy: "accepted_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<ConsentRecord> CreateAsync(ConsentRecord consent, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(consent);
        var created = await supabase.InsertAsync<ConsentRecordModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    private static ConsentRecord MapToDomain(ConsentRecordModel model)
    {
        var consentType = Enum.TryParse<ConsentType>(SnakeCaseHelper.ToPascalCase(model.ConsentType ?? ""), true, out var ct)
            ? ct
            : ConsentType.PrivacyPolicy;
        var legalBasis = Enum.TryParse<LegalBasis>(SnakeCaseHelper.ToPascalCase(model.LegalBasis ?? ""), true, out var lb)
            ? lb
            : LegalBasis.HealthCareProvision;

        return ConsentRecord.Reconstitute(
            model.Id,
            model.PatientId,
            consentType,
            legalBasis,
            model.Purpose,
            model.AcceptedAt,
            model.Channel,
            model.TextVersion,
            model.CreatedAt);
    }

    private static ConsentRecordModel MapToModel(ConsentRecord consent)
    {
        return new ConsentRecordModel
        {
            Id = consent.Id,
            PatientId = consent.PatientId,
            ConsentType = SnakeCaseHelper.ToSnakeCase(consent.ConsentType.ToString()),
            LegalBasis = SnakeCaseHelper.ToSnakeCase(consent.LegalBasis.ToString()),
            Purpose = consent.Purpose,
            AcceptedAt = consent.AcceptedAt,
            Channel = consent.Channel,
            TextVersion = consent.TextVersion,
            CreatedAt = consent.CreatedAt
        };
    }
}
