using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.ClinicalEvidence;

/// <summary>
/// One-shot hosted service that clears poisoned clinical evidence cache on application startup.
/// Runs once, then stops. Ensures that stale empty-result cache entries from previous
/// PubMed rate-limiting incidents are flushed on each deploy.
/// </summary>
public sealed class EvidenceCacheStartupCleaner(
    IServiceScopeFactory scopeFactory,
    ILogger<EvidenceCacheStartupCleaner> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var evidenceService = scope.ServiceProvider.GetRequiredService<IClinicalEvidenceService>();
            var deleted = await evidenceService.ClearCacheAsync(cancellationToken);
            if (deleted > 0)
                logger.LogWarning("[EvidenceCacheStartup] Cleared {Count} stale evidence cache entries on deploy", deleted);
            else
                logger.LogInformation("[EvidenceCacheStartup] No evidence cache entries to clear");
        }
        catch (Exception ex)
        {
            // Non-fatal: if Redis is unreachable on startup, the app should still start
            logger.LogError(ex, "[EvidenceCacheStartup] Failed to clear evidence cache on startup");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
