namespace RenoveJa.Application.DTOs.Requests;

/// <summary>
/// Resultado da análise por IA de imagem(ns) de receita.
/// Se ReadabilityOk é false, o usuário deve enviar imagem mais legível.
/// </summary>
public record AiPrescriptionAnalysisResult(
    bool ReadabilityOk,
    string? SummaryForDoctor,
    string? ExtractedJson,
    string? RiskLevel,
    string? MessageToUser
);

/// <summary>
/// Resultado da análise por IA de pedido de exame (imagem e/ou texto).
/// Se ReadabilityOk é false (quando houve imagem), o usuário deve enviar imagem mais legível.
/// </summary>
public record AiExamAnalysisResult(
    bool ReadabilityOk,
    string? SummaryForDoctor,
    string? ExtractedJson,
    string? Urgency,
    string? MessageToUser
);
