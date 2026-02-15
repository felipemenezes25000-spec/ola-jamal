using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

/// <summary>
/// Repositório de logs de auditoria para conformidade LGPD.
/// </summary>
public interface IAuditLogRepository
{
    /// <summary>
    /// Cria um novo registro de auditoria.
    /// </summary>
    Task CreateAsync(AuditLog auditLog, CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtém logs de auditoria por ID do usuário com paginação.
    /// </summary>
    Task<List<AuditLog>> GetByUserIdAsync(Guid userId, int limit = 50, int offset = 0, CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtém logs de auditoria por tipo e ID da entidade.
    /// </summary>
    Task<List<AuditLog>> GetByEntityAsync(string entityType, Guid entityId, int limit = 50, int offset = 0, CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtém os registros mais recentes de auditoria.
    /// </summary>
    Task<List<AuditLog>> GetRecentAsync(int limit = 100, CancellationToken cancellationToken = default);

    /// <summary>
    /// Consulta logs de auditoria com filtros opcionais.
    /// </summary>
    Task<List<AuditLog>> QueryAsync(
        Guid? userId = null,
        string? entityType = null,
        string? entityId = null,
        DateTime? from = null,
        DateTime? to = null,
        int limit = 50,
        int offset = 0,
        CancellationToken cancellationToken = default);
}
