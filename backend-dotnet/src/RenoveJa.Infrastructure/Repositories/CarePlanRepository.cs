using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

public class CarePlanRepository(PostgresClient supabase) : ICarePlanRepository
{
    private const string TableName = "care_plans";

    public async Task<CarePlan?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<CarePlanModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);
        return model == null ? null : MapToDomain(model);
    }

    public async Task<CarePlan?> GetActiveByConsultationIdAsync(Guid consultationId, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<CarePlanModel>(
            TableName,
            filter:
            $"consultation_id=eq.{consultationId}&status=in.(active,waiting_patient,waiting_results,ready_for_review)",
            cancellationToken: cancellationToken);
        return model == null ? null : MapToDomain(model);
    }

    public async Task<CarePlan> CreateAsync(CarePlan carePlan, CancellationToken cancellationToken = default)
    {
        var created = await supabase.InsertAsync<CarePlanModel>(
            TableName,
            MapToModel(carePlan),
            cancellationToken);
        return MapToDomain(created);
    }

    public async Task<CarePlan> UpdateAsync(CarePlan carePlan, CancellationToken cancellationToken = default)
    {
        var updated = await supabase.UpdateAsync<CarePlanModel>(
            TableName,
            $"id=eq.{carePlan.Id}",
            MapToModel(carePlan),
            cancellationToken);
        return MapToDomain(updated);
    }

    private static CarePlan MapToDomain(CarePlanModel m)
    {
        return CarePlan.Reconstitute(
            m.Id,
            m.ConsultationId,
            m.PatientId,
            m.ResponsibleDoctorId,
            m.Status,
            m.CreatedFromAiSuggestionId,
            m.CorrelationId,
            m.CreatedAt,
            m.UpdatedAt,
            m.ClosedAt);
    }

    private static CarePlanModel MapToModel(CarePlan c)
    {
        return new CarePlanModel
        {
            Id = c.Id,
            ConsultationId = c.ConsultationId,
            PatientId = c.PatientId,
            ResponsibleDoctorId = c.ResponsibleDoctorId,
            Status = c.Status.ToString().ToLowerInvariant(),
            CreatedFromAiSuggestionId = c.CreatedFromAiSuggestionId,
            CorrelationId = c.CorrelationId,
            CreatedAt = c.CreatedAt,
            UpdatedAt = c.UpdatedAt,
            ClosedAt = c.ClosedAt
        };
    }
}
