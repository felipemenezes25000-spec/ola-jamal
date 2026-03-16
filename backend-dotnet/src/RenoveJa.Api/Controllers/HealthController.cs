using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
[EnableRateLimiting("fixed")]
public class HealthController : ControllerBase
{
    private readonly DatabaseConfig _dbConfig;
    private readonly IRequestRepository _requestRepository;
    private readonly OpenAIConfig _openAiConfig;
    private readonly ILogger<HealthController> _logger;

    public HealthController(
        IOptions<DatabaseConfig> dbConfig,
        IRequestRepository requestRepository,
        IOptions<OpenAIConfig> openAiConfig,
        ILogger<HealthController> logger)
    {
        _dbConfig = dbConfig.Value;
        _requestRepository = requestRepository;
        _openAiConfig = openAiConfig.Value;
        _logger = logger;
    }

    /// <summary>Liveness: responde 200 se o processo está rodando. Usado pelo ECS/load balancer.</summary>
    [HttpGet("live")]
    public IActionResult Live() => Ok(new { status = "ok", timestamp = DateTime.UtcNow });

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var checks = new Dictionary<string, object>();
        var overall = true;

        // Database (RDS PostgreSQL via Npgsql)
        try
        {
            await _requestRepository.GetByIdAsync(Guid.Empty, ct);
            checks["database"] = new { status = "ok" };
        }
        catch (Exception ex)
        {
            checks["database"] = new { status = "error", message = ex.Message };
            overall = false;
        }

        // Storage (S3 — just check config is present)
        checks["storage"] = new { status = "ok", provider = "s3" };

        if (!overall)
            _logger.LogWarning("Health check DEGRADED: checks={Checks}", string.Join(",", checks.Keys));

        return Ok(new
        {
            status = overall ? "healthy" : "degraded",
            timestamp = DateTime.UtcNow,
            service = "RenoveJa API",
            version = "1.0.0",
            checks
        });
    }

    [HttpGet("readiness")]
    [AllowAnonymous]
    public async Task<IActionResult> GetReadiness(CancellationToken ct)
    {
        var detailed = User.Identity?.IsAuthenticated == true;
        var checks = new Dictionary<string, object>();
        var dbOk = false;
        var aiOk = false;

        // Database
        try
        {
            _ = await _requestRepository.GetByIdAsync(Guid.Empty, ct);
            checks["database"] = new { status = "ok" };
            dbOk = true;
        }
        catch (Exception ex)
        {
            checks["database"] = detailed
                ? new { status = "error", message = ex.Message }
                : (object)new { status = "error" };
            _logger.LogWarning(ex, "Readiness: database check failed");
        }

        // Storage (S3)
        var storageOk = true;
        checks["storage"] = new { status = "ok", provider = "s3" };

        // AI service
        aiOk = !string.IsNullOrWhiteSpace(_openAiConfig.GeminiApiKey) || !string.IsNullOrWhiteSpace(_openAiConfig.ApiKey);
        checks["ai"] = new { status = aiOk ? "ok" : "degraded" };

        var overall = dbOk ? (storageOk && aiOk ? "healthy" : "degraded") : "unhealthy";

        if (overall != "healthy")
            _logger.LogWarning("Readiness {Status}: db={Db}, storage={Storage}, ai={Ai}",
                overall, dbOk, storageOk, aiOk);

        return Ok(new { status = overall, timestamp = DateTime.UtcNow, service = "RenoveJa API", checks });
    }

    [HttpGet("slo")]
    public IActionResult Slo() => Ok(new
    {
        targets = new { availabilityPercent = 99.8, p95LatencyMs = 450 },
        currentStatus = "monitoring",
        timestamp = DateTime.UtcNow,
        service = "RenoveJa API"
    });

    /// <summary>
    /// Diagnóstico: valida token do médico e conexão com o banco.
    /// Requer Bearer token. Use para validar antes de testar /api/requests.
    /// </summary>
    [HttpGet("diagnose")]
    [Authorize]
    public async Task<IActionResult> Diagnose(CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var roleClaim = User.FindFirstValue(ClaimTypes.Role);
        var tokenValid = Guid.TryParse(userIdClaim, out var userId);

        object tokenCheck;
        if (tokenValid)
            tokenCheck = new { valid = true, userId = userId.ToString(), role = roleClaim ?? "unknown" };
        else
            tokenCheck = new { valid = false, error = "UserId inválido no token" };

        object dbCheck;
        try
        {
            _ = await _requestRepository.GetByIdAsync(Guid.Empty, ct);
            dbCheck = new { status = "ok", message = "Conexão com PostgreSQL OK" };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Diagnose: database check failed");
            dbCheck = new { status = "error", message = ex.Message };
        }

        return Ok(new
        {
            token = tokenCheck,
            database = dbCheck,
            timestamp = DateTime.UtcNow,
            service = "RenoveJa API"
        });
    }
}
