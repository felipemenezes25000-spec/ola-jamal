using RenoveJa.Domain.Entities;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de auditoria para conformidade LGPD com dados de saúde.
/// </summary>
public interface IAuditService
{
    /// <summary>
    /// Registra um log de auditoria genérico.
    /// </summary>
    Task LogAsync(
        Guid? userId,
        string action,
        string entityType,
        Guid? entityId = null,
        Dictionary<string, object?>? oldValues = null,
        Dictionary<string, object?>? newValues = null,
        string? ipAddress = null,
        string? userAgent = null,
        string? correlationId = null,
        Dictionary<string, object?>? metadata = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Atalho para registrar acesso (leitura) a uma entidade.
    /// </summary>
    Task LogAccessAsync(
        Guid? userId,
        string entityType,
        Guid? entityId = null,
        string? ipAddress = null,
        string? userAgent = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Registra modificação (Create/Update/Delete) em uma entidade.
    /// </summary>
    Task LogModificationAsync(
        Guid? userId,
        string action,
        string entityType,
        Guid? entityId = null,
        Dictionary<string, object?>? oldValues = null,
        Dictionary<string, object?>? newValues = null,
        string? ipAddress = null,
        string? userAgent = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtém o histórico de auditoria de um usuário.
    /// </summary>
    Task<List<AuditLog>> GetUserAuditTrailAsync(Guid userId, int limit = 50, int offset = 0, CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtém o histórico de auditoria de uma entidade.
    /// </summary>
    Task<List<AuditLog>> GetEntityAuditTrailAsync(string entityType, Guid entityId, int limit = 50, int offset = 0, CancellationToken cancellationToken = default);

    /// <summary>
    /// Consulta logs de auditoria com filtros.
    /// </summary>
    Task<List<AuditLog>> QueryAuditLogsAsync(
        Guid? userId = null,
        string? entityType = null,
        string? entityId = null,
        DateTime? from = null,
        DateTime? to = null,
        int limit = 50,
        int offset = 0,
        CancellationToken cancellationToken = default);
}
