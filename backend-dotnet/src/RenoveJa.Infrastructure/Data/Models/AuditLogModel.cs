using System.Text.Json;
using RenoveJa.Domain.Entities;

namespace RenoveJa.Infrastructure.Data.Models;

/// <summary>Modelo de persistência de log de auditoria (tabela audit_logs).</summary>
public class AuditLogModel
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    /// <summary>entity_id é TEXT no PostgreSQL; usamos string para evitar InvalidCastException.</summary>
    public string? EntityId { get; set; }
    // TEXT columns in PostgreSQL — Dapper reads as string, not Dictionary
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? CorrelationId { get; set; }
    public string? Metadata { get; set; }
    public DateTime CreatedAt { get; set; }

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    private static string? DictToJson(Dictionary<string, object?>? dict)
        => dict == null || dict.Count == 0 ? null : JsonSerializer.Serialize(dict, JsonOpts);

    private static Dictionary<string, object?>? JsonToDict(string? json)
    {
        if (string.IsNullOrWhiteSpace(json) || json == "{}" || json == "null") return null;
        try { return JsonSerializer.Deserialize<Dictionary<string, object?>>(json, JsonOpts); }
        catch { return null; }
    }

    public static AuditLogModel FromDomain(AuditLog auditLog)
    {
        return new AuditLogModel
        {
            Id = auditLog.Id,
            UserId = auditLog.UserId,
            Action = auditLog.Action,
            EntityType = auditLog.EntityType,
            EntityId = auditLog.EntityId?.ToString(),
            OldValues = DictToJson(auditLog.OldValues),
            NewValues = DictToJson(auditLog.NewValues),
            IpAddress = auditLog.IpAddress,
            UserAgent = auditLog.UserAgent,
            CorrelationId = auditLog.CorrelationId,
            Metadata = DictToJson(auditLog.Metadata),
            CreatedAt = auditLog.CreatedAt
        };
    }

    public AuditLog ToDomain()
    {
        return AuditLog.Reconstitute(
            Id,
            UserId,
            Action,
            EntityType,
            Guid.TryParse(EntityId, out var eid) ? eid : null,
            JsonToDict(OldValues),
            JsonToDict(NewValues),
            IpAddress,
            UserAgent,
            CorrelationId,
            JsonToDict(Metadata),
            CreatedAt);
    }
}
