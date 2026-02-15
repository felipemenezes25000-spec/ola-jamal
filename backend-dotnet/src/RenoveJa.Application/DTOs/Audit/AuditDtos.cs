namespace RenoveJa.Application.DTOs.Audit;

/// <summary>
/// DTO de resposta de um log de auditoria.
/// </summary>
public record AuditLogDto(
    Guid Id,
    Guid? UserId,
    string Action,
    string EntityType,
    Guid? EntityId,
    Dictionary<string, object?>? OldValues,
    Dictionary<string, object?>? NewValues,
    string? IpAddress,
    string? UserAgent,
    string? CorrelationId,
    Dictionary<string, object?>? Metadata,
    DateTime CreatedAt);

/// <summary>
/// DTO de resposta paginada de logs de auditoria.
/// </summary>
public record AuditLogListDto(
    List<AuditLogDto> Items,
    int Count);
