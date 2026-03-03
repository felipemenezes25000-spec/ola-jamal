namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de auditoria para entidades clínicas (Patient, Encounter, MedicalDocument).
/// Registra leituras e alterações para conformidade LGPD.
/// </summary>
public interface IAuditEventService
{
    Task LogReadAsync(
        Guid? userId,
        string entityType,
        Guid? entityId,
        string? channel = null,
        string? ipAddress = null,
        string? userAgent = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default);

    Task LogWriteAsync(
        Guid? userId,
        string action,
        string entityType,
        Guid? entityId,
        string? channel = null,
        string? ipAddress = null,
        string? userAgent = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default);
}
