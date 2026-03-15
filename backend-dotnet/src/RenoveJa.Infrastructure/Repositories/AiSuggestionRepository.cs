using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

public class AiSuggestionRepository(PostgresClient supabase) : IAiSuggestionRepository
{
    private const string TableName = "ai_suggestions";

    public async Task<AiSuggestion?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<AiSuggestionModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model == null ? null : MapToDomain(model);
    }

    public async Task<List<AiSuggestion>> GetByConsultationAsync(
        Guid consultationId,
        IReadOnlyCollection<string>? statuses = null,
        CancellationToken cancellationToken = default)
    {
        var filter = $"consultation_id=eq.{consultationId}";
        if (statuses != null && statuses.Count > 0)
        {
            var statusesCsv = string.Join(",", statuses.Select(s => s.Trim().ToLowerInvariant()));
            filter += $"&status=in.({statusesCsv})";
        }

        var models = await supabase.GetAllAsync<AiSuggestionModel>(
            TableName,
            filter: $"{filter}&order=created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<AiSuggestion?> GetByIdempotencyAsync(
        Guid consultationId,
        Guid? doctorId,
        string payloadHash,
        CancellationToken cancellationToken = default)
    {
        var doctorValue = doctorId.HasValue
            ? $"doctor_id=eq.{doctorId.Value}"
            : "doctor_id=is.null";
        var filter = $"consultation_id=eq.{consultationId}&{doctorValue}&payload_hash=eq.{payloadHash}";

        var model = await supabase.GetSingleAsync<AiSuggestionModel>(
            TableName,
            filter: filter,
            cancellationToken: cancellationToken);

        return model == null ? null : MapToDomain(model);
    }

    public async Task<AiSuggestion> CreateAsync(AiSuggestion suggestion, CancellationToken cancellationToken = default)
    {
        var created = await supabase.InsertAsync<AiSuggestionModel>(
            TableName,
            MapToModel(suggestion),
            cancellationToken);
        return MapToDomain(created);
    }

    public async Task<AiSuggestion> UpdateAsync(AiSuggestion suggestion, CancellationToken cancellationToken = default)
    {
        var updated = await supabase.UpdateAsync<AiSuggestionModel>(
            TableName,
            $"id=eq.{suggestion.Id}",
            MapToModel(suggestion),
            cancellationToken);
        return MapToDomain(updated);
    }

    private static AiSuggestion MapToDomain(AiSuggestionModel m)
    {
        return AiSuggestion.Reconstitute(
            m.Id,
            m.ConsultationId,
            m.PatientId,
            m.DoctorId,
            m.Type,
            m.Status,
            m.Model,
            m.PayloadJson,
            m.PayloadHash,
            m.CorrelationId,
            m.CreatedAt,
            m.UpdatedAt);
    }

    private static AiSuggestionModel MapToModel(AiSuggestion s)
    {
        return new AiSuggestionModel
        {
            Id = s.Id,
            ConsultationId = s.ConsultationId,
            PatientId = s.PatientId,
            DoctorId = s.DoctorId,
            Type = s.Type,
            Status = s.Status.ToString().ToLowerInvariant(),
            Model = s.Model,
            PayloadJson = s.PayloadJson,
            PayloadHash = s.PayloadHash,
            CorrelationId = s.CorrelationId,
            CreatedAt = s.CreatedAt,
            UpdatedAt = s.UpdatedAt
        };
    }
}
