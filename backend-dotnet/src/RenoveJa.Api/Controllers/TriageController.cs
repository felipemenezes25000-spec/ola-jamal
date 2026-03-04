using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Endpoints para o assistente de triagem Dra. Renova.
/// IA usada apenas para enriquecer mensagens — nunca define nada. Médico sempre decide.
/// </summary>
[ApiController]
[Route("api/triage")]
[Authorize]
public class TriageController(ITriageEnrichmentService enrichmentService) : ControllerBase
{
    /// <summary>
    /// Enriquece uma mensagem de triagem com IA (personalização de tom).
    /// A IA NUNCA altera o significado — apenas torna mais acolhedor.
    /// Retorna null se: chave crítica (não enriquece), API indisponível ou timeout.
    /// </summary>
    [HttpPost("enrich")]
    public async Task<IActionResult> Enrich([FromBody] TriageEnrichRequest request, CancellationToken cancellationToken)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Context) || string.IsNullOrWhiteSpace(request.RuleText))
            return BadRequest(new { error = "context e ruleText são obrigatórios." });

        var input = new TriageEnrichmentInput(
            request.Context,
            request.Step ?? "idle",
            request.RuleKey,
            request.RuleText.Trim(),
            request.PrescriptionType,
            request.ExamType,
            request.Exams,
            request.Symptoms,
            request.TotalRequests,
            request.RecentPrescriptionCount,
            request.RecentExamCount,
            request.LastPrescriptionDaysAgo,
            request.LastExamDaysAgo,
            request.PatientAge,
            request.RecentMedications);

        var result = await enrichmentService.EnrichAsync(input, cancellationToken);
        if (result == null)
            return Ok(new { text = (string?)null, isPersonalized = false });

        return Ok(new { text = result.Text, isPersonalized = result.IsPersonalized });
    }
}

public record TriageEnrichRequest(
    string Context,
    string? Step,
    string? RuleKey,
    string RuleText,
    string? PrescriptionType,
    string? ExamType,
    string[]? Exams,
    string? Symptoms,
    int? TotalRequests,
    int? RecentPrescriptionCount,
    int? RecentExamCount,
    int? LastPrescriptionDaysAgo,
    int? LastExamDaysAgo,
    int? PatientAge,
    string[]? RecentMedications);
