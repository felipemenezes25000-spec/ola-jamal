using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Domain.Interfaces;

public interface IAuditEventRepository
{
    Task<AuditEvent> CreateAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default);
    Task<List<AuditEvent>> GetByEntityAsync(string entityType, Guid entityId, int limit = 50, int offset = 0, CancellationToken cancellationToken = default);
    Task<List<AuditEvent>> GetByUserAsync(Guid userId, AuditAction? action = null, int limit = 50, int offset = 0, CancellationToken cancellationToken = default);
}

