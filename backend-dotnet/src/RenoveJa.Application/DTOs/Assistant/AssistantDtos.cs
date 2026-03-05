namespace RenoveJa.Application.DTOs.Assistant;

/// <summary>
/// Entrada para obter o proximo passo recomendado da assistente.
/// Pode receber requestId (preferencial) ou status/requestType diretamente.
/// </summary>
public record AssistantNextActionRequestDto(
    Guid? RequestId = null,
    string? Status = null,
    string? RequestType = null,
    bool? HasSignedDocument = null
);

/// <summary>
/// Saida com orientacao curta e acionavel para o paciente.
/// </summary>
public record AssistantNextActionResponseDto(
    string Title,
    string StatusSummary,
    string WhatToDo,
    string Eta,
    string? CtaLabel,
    string Intent
);

/// <summary>
/// Entrada para avaliacao de completude antes do envio.
/// </summary>
public record AssistantCompleteRequestDto(
    string Flow,
    string? PrescriptionType = null,
    int? ImagesCount = null,
    string? ExamType = null,
    int? ExamsCount = null,
    string? Symptoms = null,
    string? ConsultationType = null,
    int? DurationMinutes = null
);

/// <summary>
/// Item de checklist usado no score de completude.
/// </summary>
public record AssistantCompletenessCheckDto(
    string Id,
    string Label,
    bool Required,
    bool Done
);

/// <summary>
/// Saida da avaliacao de completude e triagem de urgencia.
/// </summary>
public record AssistantCompleteResponseDto(
    int Score,
    int DoneCount,
    int TotalCount,
    IReadOnlyList<string> MissingFields,
    IReadOnlyList<AssistantCompletenessCheckDto> Checks,
    bool HasUrgencyRisk,
    IReadOnlyList<string> UrgencySignals,
    string? UrgencyMessage
);
