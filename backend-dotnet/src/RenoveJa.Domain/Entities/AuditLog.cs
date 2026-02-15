namespace RenoveJa.Domain.Entities;

/// <summary>
/// Entidade de log de auditoria para conformidade LGPD.
/// Registra acessos e modificações a dados sensíveis de saúde.
/// </summary>
public class AuditLog : Entity
{
    /// <summary>ID do usuário que realizou a ação (null se anônimo/sistema).</summary>
    public Guid? UserId { get; private set; }

    /// <summary>Ação realizada: Create, Read, Update, Delete, Sign, Download, Export.</summary>
    public string Action { get; private set; } = string.Empty;

    /// <summary>Tipo da entidade acessada: Request, User, Payment, Certificate, DoctorProfile.</summary>
    public string EntityType { get; private set; } = string.Empty;

    /// <summary>ID do registro acessado.</summary>
    public Guid? EntityId { get; private set; }

    /// <summary>Valores anteriores (para updates).</summary>
    public Dictionary<string, object?>? OldValues { get; private set; }

    /// <summary>Valores novos (para updates).</summary>
    public Dictionary<string, object?>? NewValues { get; private set; }

    /// <summary>Endereço IP do cliente.</summary>
    public string? IpAddress { get; private set; }

    /// <summary>User-Agent do cliente.</summary>
    public string? UserAgent { get; private set; }

    /// <summary>ID de correlação para rastrear requisições.</summary>
    public string? CorrelationId { get; private set; }

    /// <summary>Metadados extras (endpoint, método, status, duração, etc.).</summary>
    public Dictionary<string, object?>? Metadata { get; private set; }

    /// <summary>
    /// Construtor privado para uso interno.
    /// </summary>
    private AuditLog() : base() { }

    /// <summary>
    /// Cria um novo registro de auditoria.
    /// </summary>
    public static AuditLog Create(
        Guid? userId,
        string action,
        string entityType,
        Guid? entityId = null,
        Dictionary<string, object?>? oldValues = null,
        Dictionary<string, object?>? newValues = null,
        string? ipAddress = null,
        string? userAgent = null,
        string? correlationId = null,
        Dictionary<string, object?>? metadata = null)
    {
        var log = new AuditLog
        {
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            OldValues = oldValues,
            NewValues = newValues,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CorrelationId = correlationId,
            Metadata = metadata
        };

        return log;
    }

    /// <summary>
    /// Reconstitui a entidade a partir de dados persistidos.
    /// </summary>
    public static AuditLog Reconstitute(
        Guid id,
        Guid? userId,
        string action,
        string entityType,
        Guid? entityId,
        Dictionary<string, object?>? oldValues,
        Dictionary<string, object?>? newValues,
        string? ipAddress,
        string? userAgent,
        string? correlationId,
        Dictionary<string, object?>? metadata,
        DateTime createdAt)
    {
        var log = new AuditLog
        {
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            OldValues = oldValues,
            NewValues = newValues,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CorrelationId = correlationId,
            Metadata = metadata
        };

        log.Id = id;
        log.CreatedAt = createdAt;

        return log;
    }
}
