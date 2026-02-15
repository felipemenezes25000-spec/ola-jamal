using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Audit;

/// <summary>
/// Implementação do serviço de auditoria para conformidade LGPD.
/// Registra acessos e modificações a dados sensíveis de saúde.
/// </summary>
public class AuditService(
    IAuditLogRepository auditLogRepository,
    ILogger<AuditService> logger) : IAuditService
{
    /// <inheritdoc />
    public async Task LogAsync(
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
        CancellationToken cancellationToken = default)
    {
        try
        {
            var auditLog = AuditLog.Create(
                userId: userId,
                action: action,
                entityType: entityType,
                entityId: entityId,
                oldValues: oldValues,
                newValues: newValues,
                ipAddress: ipAddress,
                userAgent: userAgent,
                correlationId: correlationId,
                metadata: metadata);

            await auditLogRepository.CreateAsync(auditLog, cancellationToken);
        }
        catch (Exception ex)
        {
            // Nunca deixa falha de auditoria derrubar a operação principal
            logger.LogError(ex, "Falha ao registrar log de auditoria: {Action} {EntityType} {EntityId}",
                action, entityType, entityId);
        }
    }

    /// <inheritdoc />
    public async Task LogAccessAsync(
        Guid? userId,
        string entityType,
        Guid? entityId = null,
        string? ipAddress = null,
        string? userAgent = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default)
    {
        await LogAsync(userId, "Read", entityType, entityId, ipAddress: ipAddress, userAgent: userAgent, correlationId: correlationId, cancellationToken: cancellationToken);
    }

    /// <inheritdoc />
    public async Task LogModificationAsync(
        Guid? userId,
        string action,
        string entityType,
        Guid? entityId = null,
        Dictionary<string, object?>? oldValues = null,
        Dictionary<string, object?>? newValues = null,
        string? ipAddress = null,
        string? userAgent = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default)
    {
        await LogAsync(userId, action, entityType, entityId, oldValues, newValues, ipAddress, userAgent, correlationId, cancellationToken: cancellationToken);
    }

    /// <inheritdoc />
    public async Task<List<AuditLog>> GetUserAuditTrailAsync(
        Guid userId, int limit = 50, int offset = 0,
        CancellationToken cancellationToken = default)
    {
        return await auditLogRepository.GetByUserIdAsync(userId, limit, offset, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<List<AuditLog>> GetEntityAuditTrailAsync(
        string entityType, Guid entityId, int limit = 50, int offset = 0,
        CancellationToken cancellationToken = default)
    {
        return await auditLogRepository.GetByEntityAsync(entityType, entityId, limit, offset, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<List<AuditLog>> QueryAuditLogsAsync(
        Guid? userId = null,
        string? entityType = null,
        string? entityId = null,
        DateTime? from = null,
        DateTime? to = null,
        int limit = 50,
        int offset = 0,
        CancellationToken cancellationToken = default)
    {
        return await auditLogRepository.QueryAsync(userId, entityType, entityId, from, to, limit, offset, cancellationToken);
    }
}
