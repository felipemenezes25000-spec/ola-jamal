using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;
using RenoveJa.Infrastructure.Utils;

namespace RenoveJa.Infrastructure.Repositories;

public class EncounterRepository(PostgresClient supabase) : IEncounterRepository
{
    private const string TableName = "encounters";

    public async Task<Encounter?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<EncounterModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<Encounter>> GetByPatientIdAsync(Guid patientId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<EncounterModel>(
            TableName,
            filter: $"patient_id=eq.{patientId}",
            orderBy: "started_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<Encounter>> GetByPractitionerIdAsync(Guid practitionerId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<EncounterModel>(
            TableName,
            filter: $"practitioner_id=eq.{practitionerId}",
            orderBy: "started_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<Encounter>> GetByPatientAndTypeAsync(Guid patientId, EncounterType type, CancellationToken cancellationToken = default)
    {
        var typeStr = SnakeCaseHelper.ToSnakeCase(type.ToString());
        var models = await supabase.GetAllAsync<EncounterModel>(
            TableName,
            filter: $"patient_id=eq.{patientId}&type=eq.{typeStr}",
            orderBy: "started_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<Encounter?> GetBySourceRequestIdAsync(Guid sourceRequestId, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<EncounterModel>(
            TableName,
            filter: $"source_request_id=eq.{sourceRequestId}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<Encounter> CreateAsync(Encounter encounter, CancellationToken cancellationToken = default, Guid? sourceRequestId = null)
    {
        var model = MapToModel(encounter, sourceRequestId);
        var created = await supabase.InsertAsync<EncounterModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<Encounter> UpdateAsync(Encounter encounter, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(encounter);
        var updated = await supabase.UpdateAsync<EncounterModel>(
            TableName,
            $"id=eq.{encounter.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    private static Encounter MapToDomain(EncounterModel model)
    {
        var type = Enum.TryParse<EncounterType>(SnakeCaseHelper.ToPascalCase(model.Type ?? "teleconsultation"), true, out var t)
            ? t
            : EncounterType.Teleconsultation;

        return Encounter.Reconstitute(
            model.Id,
            model.PatientId,
            model.PractitionerId,
            type,
            model.StartedAt,
            model.Status ?? "draft",
            model.Channel,
            model.Reason,
            model.Anamnesis,
            model.PhysicalExam,
            model.Plan,
            model.MainIcd10Code,
            model.FinishedAt,
            model.CreatedAt);
    }

    private static EncounterModel MapToModel(Encounter encounter, Guid? sourceRequestId = null)
    {
        var model = new EncounterModel
        {
            Id = encounter.Id,
            PatientId = encounter.PatientId,
            PractitionerId = encounter.PractitionerId,
            Type = SnakeCaseHelper.ToSnakeCase(encounter.Type.ToString()),
            Status = encounter.Status,
            StartedAt = encounter.StartedAt,
            FinishedAt = encounter.FinishedAt,
            Channel = encounter.Channel,
            Reason = encounter.Reason,
            Anamnesis = encounter.Anamnesis,
            PhysicalExam = encounter.PhysicalExam,
            Plan = encounter.Plan,
            MainIcd10Code = encounter.MainIcd10Code,
            CreatedAt = encounter.CreatedAt
        };
        if (sourceRequestId.HasValue)
            model.SourceRequestId = sourceRequestId;
        return model;
    }
}
