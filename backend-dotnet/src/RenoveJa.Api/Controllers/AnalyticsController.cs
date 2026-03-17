using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RenoveJa.Application.DTOs.Analytics;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Ingestão de analytics do app mobile e métricas de saúde da API.
/// </summary>
[ApiController]
[Route("api/analytics")]
public class AnalyticsController(
    ILogger<AnalyticsController> logger) : ControllerBase
{
    private static readonly DateTimeOffset StartupTime = DateTimeOffset.UtcNow;

    /// <summary>
    /// Recebe um lote de eventos de analytics do app mobile.
    /// Aceita chamadas autenticadas e anônimas (extrai userId quando possível).
    /// </summary>
    [HttpPost("events")]
    [Authorize]
    [EnableRateLimiting("fixed")]
    public IActionResult IngestEvents([FromBody] AnalyticsBatchDto batch)
    {
        if (batch.Events is not { Count: > 0 })
            return Accepted();

        // NL-2: Cap batch size to prevent abuse
        const int maxBatchSize = 100;
        if (batch.Events.Count > maxBatchSize)
            return BadRequest(new { error = $"Batch size exceeds maximum of {maxBatchSize} events." });

        Guid? userId = null;
        try
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(claim, out var uid))
                userId = uid;
        }
        catch
        {
            // anônimo — segue sem userId
        }

        foreach (var evt in batch.Events)
        {
            logger.LogInformation(
                "[Analytics] Event={EventName} Timestamp={Timestamp} Session={SessionId} " +
                "Platform={Platform} Version={Version} UserId={UserId} Props={@Properties}",
                evt.EventName,
                evt.Timestamp,
                evt.SessionId,
                evt.DevicePlatform,
                evt.DeviceVersion,
                userId,
                evt.Properties);
        }

        logger.LogInformation("[Analytics] Batch ingested: {Count} events, userId={UserId}",
            batch.Events.Count, userId);

        return Accepted();
    }

    /// <summary>
    /// Retorna métricas de saúde da API (uptime, timestamp). Sem autenticação.
    /// </summary>
    [HttpGet("health")]
    [AllowAnonymous]
    public IActionResult Health()
    {
        var uptime = DateTimeOffset.UtcNow - StartupTime;

        return Ok(new HealthMetricsDto
        {
            ServerTime = DateTimeOffset.UtcNow,
            UptimeSeconds = (long)uptime.TotalSeconds,
            Status = "healthy"
        });
    }
}
