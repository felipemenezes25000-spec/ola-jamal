using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;
using ConsultationAnamnesisEntity = RenoveJa.Domain.Entities.ConsultationAnamnesis;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de anamnese de consulta via db.
/// </summary>
public class ConsultationAnamnesisRepository(PostgresClient db) : IConsultationAnamnesisRepository
{
    private const string TableName = "consultation_anamnesis";

    public async Task<ConsultationAnamnesisEntity?> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        var model = await db.GetSingleAsync<ConsultationAnamnesisModel>(
            TableName,
            filter: $"request_id=eq.{requestId}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<Dictionary<Guid, ConsultationAnamnesisEntity>> GetByRequestIdsAsync(IEnumerable<Guid> requestIds, CancellationToken cancellationToken = default)
    {
        var ids = requestIds.Distinct().ToList();
        if (ids.Count == 0) return new Dictionary<Guid, ConsultationAnamnesisEntity>();

        var idsStr = string.Join(",", ids.Select(i => i.ToString()));
        var filter = $"request_id=in.({idsStr})";
        var models = await db.GetAllAsync<ConsultationAnamnesisModel>(TableName, filter: filter, cancellationToken: cancellationToken);
        return models.ToDictionary(m => m.RequestId, MapToDomain);
    }

    public async Task<ConsultationAnamnesisEntity> CreateAsync(ConsultationAnamnesisEntity entity, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(entity);
        var created = await db.InsertAsync<ConsultationAnamnesisModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<ConsultationAnamnesisEntity> UpdateAsync(ConsultationAnamnesisEntity entity, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(entity);
        var updated = await db.UpdateAsync<ConsultationAnamnesisModel>(
            TableName,
            $"id=eq.{entity.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    private static ConsultationAnamnesisEntity MapToDomain(ConsultationAnamnesisModel model)
    {
        return ConsultationAnamnesisEntity.Reconstitute(
            model.Id,
            model.RequestId,
            model.PatientId,
            model.TranscriptText,
            model.TranscriptFileUrl,
            model.RecordingFileUrl,
            model.AnamnesisJson,
            model.AiSuggestionsJson,
            model.EvidenceJson,
            model.CreatedAt,
            model.SoapNotesJson,
            model.SoapNotesGeneratedAt);
    }

    private static ConsultationAnamnesisModel MapToModel(ConsultationAnamnesisEntity entity)
    {
        return new ConsultationAnamnesisModel
        {
            Id = entity.Id,
            RequestId = entity.RequestId,
            PatientId = entity.PatientId,
            TranscriptText = entity.TranscriptText,
            TranscriptFileUrl = entity.TranscriptFileUrl,
            RecordingFileUrl = entity.RecordingFileUrl,
            AnamnesisJson = entity.AnamnesisJson,
            AiSuggestionsJson = entity.AiSuggestionsJson,
            EvidenceJson = entity.EvidenceJson,
            SoapNotesJson = entity.SoapNotesJson,
            SoapNotesGeneratedAt = entity.SoapNotesGeneratedAt,
            CreatedAt = entity.CreatedAt
        };
    }
}
