using RenoveJa.Domain.Entities;

namespace RenoveJa.Infrastructure.Data.Models;

/// <summary>Modelo de persistência de log de auditoria (tabela audit_logs).</summary>
public class AuditLogModel
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public Dictionary<string, object?>? OldValues { get; set; }
    public Dictionary<string, object?>? NewValues { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? CorrelationId { get; set; }
    public Dictionary<string, object?>? Metadata { get; set; }
    public DateTime CreatedAt { get; set; }

    public static AuditLogModel FromDomain(AuditLog auditLog)
    {
        return new AuditLogModel
        {
            Id = auditLog.Id,
            UserId = auditLog.UserId,
            Action = auditLog.Action,
            EntityType = auditLog.EntityType,
            EntityId = auditLog.EntityId,
            OldValues = auditLog.OldValues,
            NewValues = auditLog.NewValues,
            IpAddress = auditLog.IpAddress,
            UserAgent = auditLog.UserAgent,
            CorrelationId = auditLog.CorrelationId,
            Metadata = auditLog.Metadata,
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
            EntityId,
            OldValues,
            NewValues,
            IpAddress,
            UserAgent,
            CorrelationId,
            Metadata,
            CreatedAt);
    }
}
