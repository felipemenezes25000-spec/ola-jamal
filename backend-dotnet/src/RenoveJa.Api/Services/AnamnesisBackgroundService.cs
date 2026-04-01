using Microsoft.AspNetCore.SignalR;
using RenoveJa.Api.Hubs;
using RenoveJa.Application.DTOs.Consultation;
using RenoveJa.Application.Interfaces;
using RenoveJa.Infrastructure.ConsultationAnamnesis;

namespace RenoveJa.Api.Services;

/// <summary>
/// Background service that consumes <see cref="AnamnesisWorkItem"/> entries from
/// <see cref="AnamnesisChannel"/> and processes them in a dedicated DI scope.
/// This avoids the ObjectDisposedException caused by fire-and-forget lambdas
/// that outlive the HTTP request scope.
/// Same pattern as <see cref="AuditBackgroundService"/>.
/// </summary>
public sealed class AnamnesisBackgroundService(
    AnamnesisChannel channel,
    IServiceScopeFactory scopeFactory,
    IHubContext<VideoSignalingHub> hubContext,
    IConsultationSessionStore sessionStore,
    ILogger<AnamnesisBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("AnamnesisBackgroundService started");

        await foreach (var item in channel.Reader.ReadAllAsync(stoppingToken))
        {
            await ProcessWorkItemAsync(item);
        }

        // Graceful shutdown: drain remaining items
        logger.LogInformation("AnamnesisBackgroundService draining remaining entries...");
        while (channel.Reader.TryRead(out var remaining))
        {
            await ProcessWorkItemAsync(remaining);
        }

        logger.LogInformation("AnamnesisBackgroundService stopped");
    }

    private async Task ProcessWorkItemAsync(AnamnesisWorkItem item)
    {
        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromMinutes(2));
        try
        {
            using var scope = scopeFactory.CreateScope();
            var anamnesisService = scope.ServiceProvider.GetRequiredService<IConsultationAnamnesisService>();

            var result = await anamnesisService.UpdateAnamnesisAndSuggestionsAsync(
                item.FullText, item.PreviousAnamnesisJson, timeoutCts.Token);

            if (result != null)
            {
                var suggestionsJson = System.Text.Json.JsonSerializer.Serialize(result.Suggestions);
                var evidenceJson = result.Evidence.Count > 0
                    ? System.Text.Json.JsonSerializer.Serialize(result.Evidence,
                        new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase })
                    : null;

                sessionStore.UpdateAnamnesis(item.RequestId, result.AnamnesisJson, suggestionsJson, evidenceJson);

                await hubContext.Clients.Group(item.GroupName)
                    .SendAsync("AnamnesisUpdate", new AnamnesisUpdateDto(result.AnamnesisJson));
                await hubContext.Clients.Group(item.GroupName)
                    .SendAsync("SuggestionUpdate", new SuggestionUpdateDto(result.Suggestions));

                if (result.Evidence.Count > 0)
                {
                    await hubContext.Clients.Group(item.GroupName)
                        .SendAsync("EvidenceUpdate", new EvidenceUpdateDto(result.Evidence));
                }

                var groundingReport = CidGroundingValidator.Validate(item.FullText, result.AnamnesisJson);
                await hubContext.Clients.Group(item.GroupName)
                    .SendAsync("GroundingUpdate", groundingReport);

                if (!groundingReport.IsGrounded)
                    logger.LogWarning("[Anamnesis] GROUNDING FALHOU: RequestId={RequestId} Score={Score} Issues={Issues}",
                        item.RequestId, groundingReport.Score, string.Join(" | ", groundingReport.Issues));

                logger.LogInformation("[Anamnesis] IA OK: RequestId={RequestId} suggestions={Count} evidence={EvidenceCount} grounding={Score}",
                    item.RequestId, result.Suggestions.Count, result.Evidence.Count, groundingReport.Score);
            }
            else
            {
                logger.LogWarning("[Anamnesis] ANAMNESE_NAO_OCORRE: Serviço retornou null. RequestId={RequestId} | Verifique logs [Anamnese IA] para causa (OpenAI key, API error, parse JSON)",
                    item.RequestId);
            }
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning("[Anamnesis] IA cancelada por timeout (2min). RequestId={RequestId}", item.RequestId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Anamnesis] ANAMNESE_NAO_OCORRE: Exceção ao atualizar anamnese. RequestId={RequestId}", item.RequestId);
        }
    }
}
