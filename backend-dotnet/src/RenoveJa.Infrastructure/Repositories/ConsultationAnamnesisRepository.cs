using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;
using ConsultationAnamnesisEntity = RenoveJa.Domain.Entities.ConsultationAnamnesis;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de anamnese de consulta via Supabase.
/// </summary>
public class ConsultationAnamnesisRepository(SupabaseClient supabase) : IConsultationAnamnesisRepository
{
    private const string TableName = "consultation_anamnesis";

    public async Task<ConsultationAnamnesisEntity?> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<ConsultationAnamnesisModel>(
            TableName,
            filter: $"request_id=eq.{requestId}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<ConsultationAnamnesisEntity> CreateAsync(ConsultationAnamnesisEntity entity, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(entity);
        var created = await supabase.InsertAsync<ConsultationAnamnesisModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<ConsultationAnamnesisEntity> UpdateAsync(ConsultationAnamnesisEntity entity, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(entity);
        var updated = await supabase.UpdateAsync<ConsultationAnamnesisModel>(
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
            model.AnamnesisJson,
            model.AiSuggestionsJson,
            model.CreatedAt);
    }

    private static ConsultationAnamnesisModel MapToModel(ConsultationAnamnesisEntity entity)
    {
        return new ConsultationAnamnesisModel
        {
            Id = entity.Id,
            RequestId = entity.RequestId,
            PatientId = entity.PatientId,
            TranscriptText = entity.TranscriptText,
            AnamnesisJson = entity.AnamnesisJson,
            AiSuggestionsJson = entity.AiSuggestionsJson,
            CreatedAt = entity.CreatedAt
        };
    }
}
