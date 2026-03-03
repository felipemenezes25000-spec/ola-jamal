using RenoveJa.Domain.Enums;

namespace RenoveJa.Domain.Entities;

/// <summary>
/// Evento de auditoria focado em acesso e alteração de entidades clínicas sensíveis.
/// É um envelope mais enxuto sobre o modelo genérico de AuditLog.
/// </summary>
public class AuditEvent : Entity
{
    public Guid? UserId { get; private set; }
    public AuditAction Action { get; private set; }
    public string EntityType { get; private set; } = string.Empty;
    public Guid? EntityId { get; private set; }
    public string? Channel { get; private set; }
    public string? IpAddress { get; private set; }
    public string? UserAgent { get; private set; }
    public string? CorrelationId { get; private set; }

    private AuditEvent() : base() { }

    private AuditEvent(
        Guid id,
        Guid? userId,
        AuditAction action,
        string entityType,
        Guid? entityId,
        string? channel,
        string? ipAddress,
        string? userAgent,
        string? correlationId,
        DateTime createdAt)
        : base(id, createdAt)
    {
        UserId = userId;
        Action = action;
        EntityType = entityType;
        EntityId = entityId;
        Channel = channel;
        IpAddress = ipAddress;
        UserAgent = userAgent;
        CorrelationId = correlationId;
    }

    public static AuditEvent Create(
        Guid? userId,
        AuditAction action,
        string entityType,
        Guid? entityId,
        string? channel,
        string? ipAddress,
        string? userAgent,
        string? correlationId)
    {
        return new AuditEvent(
            Guid.NewGuid(),
            userId,
            action,
            entityType,
            entityId,
            channel,
            ipAddress,
            userAgent,
            correlationId,
            DateTime.UtcNow);
    }

    public static AuditEvent Reconstitute(
        Guid id,
        Guid? userId,
        AuditAction action,
        string entityType,
        Guid? entityId,
        string? channel,
        string? ipAddress,
        string? userAgent,
        string? correlationId,
        DateTime createdAt)
    {
        return new AuditEvent(
            id,
            userId,
            action,
            entityType,
            entityId,
            channel,
            ipAddress,
            userAgent,
            correlationId,
            createdAt);
    }
}

