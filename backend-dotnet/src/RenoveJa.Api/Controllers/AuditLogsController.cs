using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Audit;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller para consulta de logs de auditoria (LGPD).
/// Restrito a administradores e médicos.
/// </summary>
[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Roles = "admin,doctor")]
public class AuditLogsController : ControllerBase
{
    private readonly IAuditService _auditService;
    private readonly ILogger<AuditLogsController> _logger;

    public AuditLogsController(IAuditService auditService, ILogger<AuditLogsController> logger)
    {
        _auditService = auditService;
        _logger = logger;
    }

    /// <summary>
    /// Consulta logs de auditoria com filtros opcionais.
    /// </summary>
    /// <param name="userId">Filtrar por ID do usuário.</param>
    /// <param name="entityType">Filtrar por tipo de entidade (Request, User, Payment, Certificate, DoctorProfile).</param>
    /// <param name="entityId">Filtrar por ID da entidade.</param>
    /// <param name="from">Data/hora inicial (UTC).</param>
    /// <param name="to">Data/hora final (UTC).</param>
    /// <param name="limit">Número máximo de registros (padrão: 50, máximo: 200).</param>
    /// <param name="offset">Offset para paginação.</param>
    /// <param name="cancellationToken">Token de cancelamento.</param>
    [HttpGet]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] Guid? userId,
        [FromQuery] string? entityType,
        [FromQuery] string? entityId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0,
        CancellationToken cancellationToken = default)
    {
        // Limitar máximo de registros para evitar sobrecarga
        if (limit > 200) limit = 200;
        if (limit < 1) limit = 1;
        if (offset < 0) offset = 0;

        _logger.LogInformation("AuditLogs GetAuditLogs: userId={UserId}, entityType={EntityType}, limit={Limit}", userId, entityType, limit);
        var logs = await _auditService.QueryAuditLogsAsync(
            userId, entityType, entityId, from, to, limit, offset, cancellationToken);

        var items = logs.Select(l => new AuditLogDto(
            l.Id,
            l.UserId,
            l.Action,
            l.EntityType,
            l.EntityId,
            l.OldValues,
            l.NewValues,
            l.IpAddress,
            l.UserAgent,
            l.CorrelationId,
            l.Metadata,
            l.CreatedAt)).ToList();

        return Ok(new AuditLogListDto(items, items.Count));
    }
}
