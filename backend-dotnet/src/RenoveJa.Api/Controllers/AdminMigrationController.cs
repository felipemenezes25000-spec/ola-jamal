using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.Interfaces;
using RenoveJa.Infrastructure.Storage;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Endpoint administrativo para migração de paths S3 legados para o padrão
/// baseado em paciente (pacientes/{patientId}/...).
/// Protegido por header X-Admin-Key.
/// </summary>
[ApiController]
[Route("api/admin/migration")]
[Authorize(Roles = "admin")]
public class AdminMigrationController(
    S3MigrationService migrationService,
    IClinicalEvidenceService clinicalEvidenceService,
    IConfiguration configuration,
    ILogger<AdminMigrationController> logger) : ControllerBase
{
    /// <summary>
    /// GET /api/admin/migration/s3?dryRun=true
    /// Dry-run por padrão. Envie dryRun=false para executar de fato.
    /// Requer header X-Admin-Key com valor configurado em ADMIN_MIGRATION_KEY.
    /// </summary>
    [HttpPost("s3")]
    public async Task<IActionResult> MigrateS3(
        [FromQuery] bool dryRun = true,
        CancellationToken ct = default)
    {
        var expectedKey = configuration["ADMIN_MIGRATION_KEY"]
            ?? Environment.GetEnvironmentVariable("ADMIN_MIGRATION_KEY");

        if (string.IsNullOrWhiteSpace(expectedKey))
        {
            return StatusCode(503, new { error = "ADMIN_MIGRATION_KEY not configured." });
        }

        var providedKey = Request.Headers["X-Admin-Key"].ToString();
        if (!string.Equals(providedKey, expectedKey, StringComparison.Ordinal))
        {
            return Unauthorized(new { error = "Invalid X-Admin-Key." });
        }

        logger.LogWarning("[AdminMigration] S3 migration triggered. DryRun={DryRun}", dryRun);

        var result = await migrationService.MigrateAsync(dryRun, ct);

        return Ok(new
        {
            mode = dryRun ? "DRY-RUN" : "LIVE",
            scanned = result.Scanned,
            copied = result.Copied,
            db_updated = result.DbUpdated,
            errors = result.Errors,
            error_details = result.ErrorDetails.Take(50)
        });
    }

    /// <summary>
    /// POST /api/admin/migration/clear-evidence-cache
    /// Limpa todo o cache Redis de evidências clínicas (PubMed/GPT).
    /// Útil após fix de rate limiting ou quando cache tem resultados vazios envenenados.
    /// </summary>
    [HttpPost("clear-evidence-cache")]
    public async Task<IActionResult> ClearEvidenceCache(CancellationToken ct)
    {
        var expectedKey = configuration["ADMIN_MIGRATION_KEY"]
            ?? Environment.GetEnvironmentVariable("ADMIN_MIGRATION_KEY");

        if (string.IsNullOrWhiteSpace(expectedKey))
        {
            return StatusCode(503, new { error = "ADMIN_MIGRATION_KEY not configured." });
        }

        {
            var providedKey = Request.Headers["X-Admin-Key"].ToString();
            if (!string.Equals(providedKey, expectedKey, StringComparison.Ordinal))
                return Unauthorized(new { error = "Invalid X-Admin-Key." });
        }

        logger.LogWarning("[Admin] Limpeza de cache de evidências clínicas solicitada.");
        var deleted = await clinicalEvidenceService.ClearCacheAsync(ct);

        return Ok(new { cleared = deleted, message = $"{deleted} cache entries removed" });
    }
}
