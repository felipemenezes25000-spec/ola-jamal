using Dapper;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de logs de auditoria via db REST API.
/// </summary>
public class AuditLogRepository(PostgresClient db) : IAuditLogRepository
{
    private const string TableName = "audit_logs";

    /// <inheritdoc />
    public async Task CreateAsync(AuditLog auditLog, CancellationToken cancellationToken = default)
    {
        var model = AuditLogModel.FromDomain(auditLog);
        await db.InsertAsync<AuditLogModel>(TableName, model, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<List<AuditLog>> GetByUserIdAsync(Guid userId, int limit = 50, int offset = 0, CancellationToken cancellationToken = default)
    {
        var models = await db.GetAllAsync<AuditLogModel>(
            TableName,
            filter: $"user_id=eq.{userId}",
            orderBy: "created_at.desc",
            limit: limit,
            cancellationToken: cancellationToken);

        return models.Select(m => m.ToDomain()).ToList();
    }

    /// <summary>
    /// Usa raw SQL porque entity_id é coluna TEXT que armazena UUIDs como string.
    /// PostgREST filter converte para System.Guid → Npgsql envia como uuid → PG 42883.
    /// </summary>
    public async Task<List<AuditLog>> GetByEntityAsync(string entityType, Guid entityId, int limit = 50, int offset = 0, CancellationToken cancellationToken = default)
    {
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var sql = """
            SELECT * FROM public.audit_logs
            WHERE "entity_type" = @entityType AND "entity_id" = @entityId
            ORDER BY created_at DESC LIMIT @limit OFFSET @offset
            """;
        var models = (await conn.QueryAsync<AuditLogModel>(
            new CommandDefinition(sql, new { entityType, entityId = entityId.ToString(), limit, offset },
                cancellationToken: cancellationToken))).AsList();
        return models.Select(m => m.ToDomain()).ToList();
    }

    /// <inheritdoc />
    public async Task<List<AuditLog>> GetRecentAsync(int limit = 100, CancellationToken cancellationToken = default)
    {
        var models = await db.GetAllAsync<AuditLogModel>(
            TableName,
            orderBy: "created_at.desc",
            limit: limit,
            cancellationToken: cancellationToken);

        return models.Select(m => m.ToDomain()).ToList();
    }

    /// <summary>
    /// Usa raw SQL porque entity_id é coluna TEXT — evita type mismatch uuid=text.
    /// </summary>
    public async Task<List<AuditLog>> QueryAsync(
        Guid? userId = null,
        string? entityType = null,
        string? entityId = null,
        DateTime? from = null,
        DateTime? to = null,
        int limit = 50,
        int offset = 0,
        CancellationToken cancellationToken = default)
    {
        var conditions = new List<string>();
        var parameters = new DynamicParameters();

        if (userId.HasValue)
        {
            conditions.Add("\"user_id\" = @userId");
            parameters.Add("userId", userId.Value);
        }
        if (!string.IsNullOrWhiteSpace(entityType))
        {
            conditions.Add("\"entity_type\" = @entityType");
            parameters.Add("entityType", entityType);
        }
        if (!string.IsNullOrWhiteSpace(entityId))
        {
            conditions.Add("\"entity_id\" = @entityId");
            parameters.Add("entityId", entityId); // string — não converter para Guid
        }
        if (from.HasValue)
        {
            conditions.Add("\"created_at\" >= @from");
            parameters.Add("from", from.Value);
        }
        if (to.HasValue)
        {
            conditions.Add("\"created_at\" <= @to");
            parameters.Add("to", to.Value);
        }

        parameters.Add("limit", limit);
        parameters.Add("offset", offset);

        var where = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";
        var sql = $"SELECT * FROM public.audit_logs {where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset";

        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var models = (await conn.QueryAsync<AuditLogModel>(
            new CommandDefinition(sql, parameters, cancellationToken: cancellationToken))).AsList();
        return models.Select(m => m.ToDomain()).ToList();
    }
}
