using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Audit;

public class AuditEventService(
    IAuditEventRepository auditEventRepository,
    ILogger<AuditEventService> logger) : IAuditEventService
{
    public async Task LogReadAsync(
        Guid? userId,
        string entityType,
        Guid? entityId,
        string? channel = null,
        string? ipAddress = null,
        string? userAgent = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var evt = AuditEvent.Create(
                userId,
                AuditAction.Read,
                entityType,
                entityId,
                channel,
                ipAddress,
                userAgent,
                correlationId);

            await auditEventRepository.CreateAsync(evt, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Falha ao registrar auditoria de leitura: {EntityType} {EntityId}", entityType, entityId);
        }
    }

    public async Task LogWriteAsync(
        Guid? userId,
        string action,
        string entityType,
        Guid? entityId,
        string? channel = null,
        string? ipAddress = null,
        string? userAgent = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var actionEnum = action?.ToLowerInvariant() switch
            {
                "create" => AuditAction.Create,
                "update" => AuditAction.Update,
                "delete" => AuditAction.Delete,
                "sign" => AuditAction.Sign,
                "export" => AuditAction.Export,
                _ => AuditAction.Update
            };

            var evt = AuditEvent.Create(
                userId,
                actionEnum,
                entityType,
                entityId,
                channel,
                ipAddress,
                userAgent,
                correlationId);

            await auditEventRepository.CreateAsync(evt, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Falha ao registrar auditoria de escrita: {Action} {EntityType} {EntityId}", action, entityType, entityId);
        }
    }
}
