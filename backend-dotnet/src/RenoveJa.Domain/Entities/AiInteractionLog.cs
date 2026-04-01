namespace RenoveJa.Domain.Entities;

/// <summary>
/// Log técnico de interações com IA para auditoria e conformidade.
/// </summary>
public class AiInteractionLog : AggregateRoot
{
    public string ServiceName { get; private set; } = string.Empty;
    public string ModelName { get; private set; } = string.Empty;
    public string? ModelVersion { get; private set; }
    public string PromptHash { get; private set; } = string.Empty;
    public string? ResponseSummary { get; private set; }
    public int? TokensUsed { get; private set; }
    public long? DurationMs { get; private set; }
    public Guid? RequestId { get; private set; }
    public Guid? UserId { get; private set; }
    public bool Success { get; private set; }
    public string? ErrorMessage { get; private set; }

    private AiInteractionLog() : base() { }

    public static AiInteractionLog Create(
        string serviceName,
        string modelName,
        string promptHash,
        bool success,
        string? modelVersion = null,
        string? responseSummary = null,
        int? tokensUsed = null,
        long? durationMs = null,
        Guid? requestId = null,
        Guid? userId = null,
        string? errorMessage = null)
    {
        if (string.IsNullOrWhiteSpace(serviceName))
            throw new Domain.Exceptions.DomainException("ServiceName is required");
        if (string.IsNullOrWhiteSpace(modelName))
            throw new Domain.Exceptions.DomainException("ModelName is required");
        if (string.IsNullOrWhiteSpace(promptHash))
            throw new Domain.Exceptions.DomainException("PromptHash is required");

        return new AiInteractionLog
        {
            ServiceName = serviceName,
            ModelName = modelName,
            ModelVersion = modelVersion,
            PromptHash = promptHash,
            ResponseSummary = responseSummary,
            TokensUsed = tokensUsed,
            DurationMs = durationMs,
            RequestId = requestId,
            UserId = userId,
            Success = success,
            ErrorMessage = errorMessage
        };
    }
}
