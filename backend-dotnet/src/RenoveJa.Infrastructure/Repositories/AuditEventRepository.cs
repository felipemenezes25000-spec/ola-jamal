using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;
using RenoveJa.Infrastructure.Utils;

namespace RenoveJa.Infrastructure.Repositories;

public class AuditEventRepository(PostgresClient supabase) : IAuditEventRepository
{
    private const string TableName = "audit_events";

    public async Task<AuditEvent> CreateAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(auditEvent);
        var created = await supabase.InsertAsync<AuditEventModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<List<AuditEvent>> GetByEntityAsync(string entityType, Guid entityId, int limit = 50, int offset = 0, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<AuditEventModel>(
            TableName,
            filter: $"entity_type=eq.{entityType}&entity_id=eq.{entityId}",
            orderBy: "created_at.desc",
            limit: limit,
            offset: offset,
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<AuditEvent>> GetByUserAsync(Guid userId, AuditAction? action = null, int limit = 50, int offset = 0, CancellationToken cancellationToken = default)
    {
        var filter = $"user_id=eq.{userId}";
        if (action.HasValue)
            filter += $"&action=eq.{SnakeCaseHelper.ToSnakeCase(action.Value.ToString())}";

        var models = await supabase.GetAllAsync<AuditEventModel>(
            TableName,
            filter: filter,
            orderBy: "created_at.desc",
            limit: limit,
            offset: offset,
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    private static AuditEvent MapToDomain(AuditEventModel model)
    {
        var action = Enum.TryParse<AuditAction>(SnakeCaseHelper.ToPascalCase(model.Action ?? ""), true, out var a)
            ? a
            : AuditAction.Read;

        return AuditEvent.Reconstitute(
            model.Id,
            model.UserId,
            action,
            model.EntityType ?? "",
            model.EntityId,
            model.Channel,
            model.IpAddress,
            model.UserAgent,
            model.CorrelationId,
            model.CreatedAt);
    }

    private static AuditEventModel MapToModel(AuditEvent auditEvent)
    {
        return new AuditEventModel
        {
            Id = auditEvent.Id,
            UserId = auditEvent.UserId,
            Action = SnakeCaseHelper.ToSnakeCase(auditEvent.Action.ToString()),
            EntityType = auditEvent.EntityType,
            EntityId = auditEvent.EntityId,
            Channel = auditEvent.Channel,
            IpAddress = auditEvent.IpAddress,
            UserAgent = auditEvent.UserAgent,
            CorrelationId = auditEvent.CorrelationId,
            CreatedAt = auditEvent.CreatedAt
        };
    }
}
