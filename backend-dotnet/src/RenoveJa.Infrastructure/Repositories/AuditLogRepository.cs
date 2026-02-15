using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de logs de auditoria via Supabase REST API.
/// </summary>
public class AuditLogRepository(SupabaseClient supabase) : IAuditLogRepository
{
    private const string TableName = "audit_logs";

    /// <inheritdoc />
    public async Task CreateAsync(AuditLog auditLog, CancellationToken cancellationToken = default)
    {
        var model = AuditLogModel.FromDomain(auditLog);
        await supabase.InsertAsync<AuditLogModel>(TableName, model, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<List<AuditLog>> GetByUserIdAsync(Guid userId, int limit = 50, int offset = 0, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<AuditLogModel>(
            TableName,
            filter: $"user_id=eq.{userId}",
            orderBy: "created_at.desc",
            limit: limit,
            cancellationToken: cancellationToken);

        return models.Select(m => m.ToDomain()).ToList();
    }

    /// <inheritdoc />
    public async Task<List<AuditLog>> GetByEntityAsync(string entityType, Guid entityId, int limit = 50, int offset = 0, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<AuditLogModel>(
            TableName,
            filter: $"entity_type=eq.{entityType}&entity_id=eq.{entityId}",
            orderBy: "created_at.desc",
            limit: limit,
            cancellationToken: cancellationToken);

        return models.Select(m => m.ToDomain()).ToList();
    }

    /// <inheritdoc />
    public async Task<List<AuditLog>> GetRecentAsync(int limit = 100, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<AuditLogModel>(
            TableName,
            orderBy: "created_at.desc",
            limit: limit,
            cancellationToken: cancellationToken);

        return models.Select(m => m.ToDomain()).ToList();
    }

    /// <inheritdoc />
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
        var filters = new List<string>();

        if (userId.HasValue)
            filters.Add($"user_id=eq.{userId.Value}");

        if (!string.IsNullOrWhiteSpace(entityType))
            filters.Add($"entity_type=eq.{entityType}");

        if (!string.IsNullOrWhiteSpace(entityId))
            filters.Add($"entity_id=eq.{entityId}");

        if (from.HasValue)
            filters.Add($"created_at=gte.{from.Value:yyyy-MM-ddTHH:mm:ssZ}");

        if (to.HasValue)
            filters.Add($"created_at=lte.{to.Value:yyyy-MM-ddTHH:mm:ssZ}");

        var filter = filters.Count > 0 ? string.Join("&", filters) : null;

        var models = await supabase.GetAllAsync<AuditLogModel>(
            TableName,
            filter: filter,
            orderBy: "created_at.desc",
            limit: limit,
            cancellationToken: cancellationToken);

        return models.Select(m => m.ToDomain()).ToList();
    }
}
