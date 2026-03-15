using System.Text.Json.Serialization;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

public class AiInteractionLogRepository(PostgresClient supabase) : IAiInteractionLogRepository
{
    private const string TableName = "ai_interaction_logs";

    public async Task LogAsync(AiInteractionLog log, CancellationToken cancellationToken = default)
    {
        var model = new AiInteractionLogModel
        {
            Id = log.Id,
            ServiceName = log.ServiceName,
            ModelName = log.ModelName,
            ModelVersion = log.ModelVersion,
            PromptHash = log.PromptHash,
            ResponseSummary = log.ResponseSummary,
            TokensUsed = log.TokensUsed,
            DurationMs = log.DurationMs,
            RequestId = log.RequestId,
            UserId = log.UserId,
            Success = log.Success,
            ErrorMessage = log.ErrorMessage,
            CreatedAt = log.CreatedAt
        };

        _ = await supabase.InsertAsync<AiInteractionLogModel>(TableName, model, cancellationToken);
    }

    private sealed class AiInteractionLogModel
    {
        [JsonPropertyName("id")] public Guid Id { get; init; }
        [JsonPropertyName("service_name")] public string ServiceName { get; init; } = string.Empty;
        [JsonPropertyName("model_name")] public string ModelName { get; init; } = string.Empty;
        [JsonPropertyName("model_version")] public string? ModelVersion { get; init; }
        [JsonPropertyName("prompt_hash")] public string PromptHash { get; init; } = string.Empty;
        [JsonPropertyName("response_summary")] public string? ResponseSummary { get; init; }
        [JsonPropertyName("tokens_used")] public int? TokensUsed { get; init; }
        [JsonPropertyName("duration_ms")] public long? DurationMs { get; init; }
        [JsonPropertyName("request_id")] public Guid? RequestId { get; init; }
        [JsonPropertyName("user_id")] public Guid? UserId { get; init; }
        [JsonPropertyName("success")] public bool Success { get; init; }
        [JsonPropertyName("error_message")] public string? ErrorMessage { get; init; }
        [JsonPropertyName("created_at")] public DateTime CreatedAt { get; init; }
    }
}
