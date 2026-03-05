using RenoveJa.Application.DTOs.Assistant;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Regras da assistente para navegacao do fluxo do paciente.
/// </summary>
public interface IAssistantNavigatorService
{
    Task<AssistantNextActionResponseDto> GetNextActionAsync(
        AssistantNextActionRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default);

    AssistantCompleteResponseDto EvaluateCompleteness(AssistantCompleteRequestDto request);
}
