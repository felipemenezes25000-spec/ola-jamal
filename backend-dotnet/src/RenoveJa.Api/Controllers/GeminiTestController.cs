using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Endpoints de teste dos fluxos Gemini (apenas Development).
/// Valida que todos os serviços de IA estão funcionando com Gemini.
/// </summary>
#if DEBUG
[ApiController]
[Route("api/gemini-test")]
public class GeminiTestController(
    ITriageEnrichmentService triageEnrichmentService,
    IClinicalSummaryService clinicalSummaryService,
    IAiConductSuggestionService conductSuggestionService,
    IAiPrescriptionGeneratorService prescriptionGeneratorService,
    ILogger<GeminiTestController> logger) : ControllerBase
{
    /// <summary>
    /// Testa triagem (enriquecimento de mensagem com IA).
    /// </summary>
    [AllowAnonymous]
    [HttpPost("triage")]
    public async Task<IActionResult> TestTriage(CancellationToken cancellationToken)
    {
        if (!IsDevelopment()) return NotFound();

        var input = new TriageEnrichmentInput(
            Context: "prescription",
            Step: "idle",
            RuleKey: "rx:general_tip",
            RuleText: "Oriente o paciente a guardar a receita e seguir a posologia.",
            PrescriptionType: "receita_simples",
            ExamType: null,
            Exams: null,
            Symptoms: "dor de cabeça",
            TotalRequests: 1,
            RecentPrescriptionCount: 0,
            RecentExamCount: 0,
            LastPrescriptionDaysAgo: null,
            LastExamDaysAgo: null,
            PatientAge: 35,
            RecentMedications: ["Paracetamol"]);

        try
        {
            var result = await triageEnrichmentService.EnrichAsync(input, cancellationToken);
            if (result == null)
                return Ok(new { success = false, message = "Triage retornou null (API indisponível ou regra ignorada)" });
            return Ok(new { success = true, text = result.Text, isPersonalized = result.IsPersonalized });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[GeminiTest] Triage falhou");
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    /// <summary>
    /// Testa resumo clínico estruturado.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("clinical-summary")]
    public async Task<IActionResult> TestClinicalSummary(CancellationToken cancellationToken)
    {
        if (!IsDevelopment()) return NotFound();

        var input = new ClinicalSummaryInput(
            PatientName: "Paciente Teste",
            PatientBirthDate: new DateTime(1990, 5, 15),
            PatientGender: "M",
            Allergies: new List<string> { "NKDA" },
            Consultations: new List<ClinicalSummaryConsultation>
            {
                new(new DateTime(2025, 3, 1), "Dor de cabeça há 3 dias", "R51 - Cefaleia", "Paracetamol 500mg", null)
            },
            Prescriptions: new List<ClinicalSummaryPrescription>
            {
                new(new DateTime(2025, 3, 1), "receita_simples", new List<string> { "Paracetamol 500mg" }, null)
            },
            Exams: new List<ClinicalSummaryExam>());

        try
        {
            var result = await clinicalSummaryService.GenerateStructuredAsync(input, cancellationToken);
            if (result == null)
                return Ok(new { success = false, message = "Clinical summary retornou null" });
            return Ok(new
            {
                success = true,
                problemList = result.ProblemList,
                activeMedications = result.ActiveMedications,
                narrativeSummary = result.NarrativeSummary != null ? result.NarrativeSummary[..Math.Min(200, result.NarrativeSummary.Length)] + "..." : null
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[GeminiTest] Clinical summary falhou");
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    /// <summary>
    /// Testa sugestão de conduta médica.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("conduct")]
    public async Task<IActionResult> TestConduct(CancellationToken cancellationToken)
    {
        if (!IsDevelopment()) return NotFound();

        var input = new AiConductSuggestionInput(
            RequestType: "prescription",
            PrescriptionType: "receita_simples",
            ExamType: null,
            PatientName: "Paciente Teste",
            PatientBirthDate: new DateTime(1990, 5, 15),
            PatientGender: "M",
            Symptoms: "Dor de cabeça há 3 dias, febre leve",
            Medications: new List<string> { "Losartana 50mg" },
            Exams: null,
            AiSummaryForDoctor: "Paciente com cefaleia e febre. Sem alergias.",
            AiExtractedJson: null,
            DoctorNotes: null);

        try
        {
            var result = await conductSuggestionService.GenerateAsync(input, cancellationToken);
            if (result == null)
                return Ok(new { success = false, message = "Conduct suggestion retornou null" });
            return Ok(new
            {
                success = true,
                conduct = result.ConductSuggestion != null ? result.ConductSuggestion[..Math.Min(300, result.ConductSuggestion.Length)] + "..." : null,
                suggestedExams = result.SuggestedExams
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[GeminiTest] Conduct suggestion falhou");
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    /// <summary>
    /// Testa geração de medicamentos para prescrição.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("prescription")]
    public async Task<IActionResult> TestPrescription(CancellationToken cancellationToken)
    {
        if (!IsDevelopment()) return NotFound();

        var input = new AiPrescriptionGeneratorInput(
            PatientName: "Paciente Teste",
            PatientBirthDate: new DateTime(1990, 5, 15),
            PatientGender: "M",
            Symptoms: "Dor de cabeça há 3 dias, febre leve",
            AiSummaryForDoctor: "Paciente com cefaleia e febre. Sem alergias. Renovação de Paracetamol 500mg.",
            AiExtractedJson: """{"medicamentos":[{"nome":"Paracetamol","dose":"500mg","posologia":"1 comprimido de 6/6h"}]}""",
            DoctorNotes: null,
            Kind: PrescriptionKind.Simple);

        try
        {
            var result = await prescriptionGeneratorService.GenerateMedicationsAsync(input, cancellationToken);
            if (result == null)
                return Ok(new { success = false, message = "Prescription generator retornou null" });
            return Ok(new { success = true, count = result.Count, medications = result.Select(m => m.Name).Take(5) });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[GeminiTest] Prescription generator falhou");
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    private static bool IsDevelopment() =>
        string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);
}
#endif
