using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por endpoints de receita e pedido de exame
/// (validação, assinatura, reanálise, PDF, preview, edição de conteúdo).
/// </summary>
[ApiController]
[Route("api/requests")]
[Authorize]
#pragma warning disable CS9113 // logger reserved for future logging
public class PrescriptionExamController(
    IRequestService requestService,
    IPrescriptionPdfService pdfService,
    IRequestRepository requestRepository,
    ILogger<PrescriptionExamController> logger)
    : ControllerBase
#pragma warning restore CS9113
{
    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }

    private async Task<Guid?> ResolveRequestIdAsync(string id, CancellationToken cancellationToken)
    {
        if (Guid.TryParse(id, out var guid))
            return guid;
        var req = await requestRepository.GetByShortCodeAsync(id, cancellationToken);
        return req?.Id;
    }

    /// <summary>
    /// Valida conformidade da receita (campos obrigatórios por tipo). Médico ou paciente.
    /// Retorna 200 com valid: true ou 400 com valid: false, missingFields e messages.
    /// </summary>
    [HttpPost("{id}/validate-prescription")]
    public async Task<IActionResult> ValidatePrescription(
        string id,
        CancellationToken cancellationToken)
    {
        var resolvedId = await ResolveRequestIdAsync(id, cancellationToken);
        if (resolvedId == null) return NotFound();
        var userId = GetUserId();
        var (isValid, missingFields, messages) = await requestService.ValidatePrescriptionAsync(resolvedId.Value, userId, cancellationToken);
        if (isValid)
            return Ok(new { valid = true });
        return BadRequest(new { valid = false, missingFields, messages });
    }

    /// <summary>
    /// Assina digitalmente a solicitação (médico).
    /// </summary>
    [HttpPost("{id}/sign")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> Sign(
        string id,
        [FromBody] SignRequestDto dto,
        CancellationToken cancellationToken)
    {
        var resolvedId = await ResolveRequestIdAsync(id, cancellationToken);
        if (resolvedId == null) return NotFound();
        var request = await requestService.SignAsync(resolvedId.Value, dto, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Reanalisa a receita com novas imagens (ex.: mais legíveis). Somente o paciente.
    /// Se a IA tiver dificuldade de leitura, use este endpoint após enviar foto mais nítida.
    /// </summary>
    [HttpPost("{id}/reanalyze-prescription")]
    public async Task<IActionResult> ReanalyzePrescription(
        Guid id,
        [FromBody] ReanalyzePrescriptionDto dto,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestService.ReanalyzePrescriptionAsync(id, dto, userId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Reanalisa o pedido de exame com novas imagens e/ou texto. Somente o paciente.
    /// </summary>
    [HttpPost("{id}/reanalyze-exam")]
    public async Task<IActionResult> ReanalyzeExam(
        Guid id,
        [FromBody] ReanalyzeExamDto dto,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestService.ReanalyzeExamAsync(id, dto, userId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Médico reexecuta a análise de IA com as imagens já existentes da receita ou exame.
    /// </summary>
    [HttpPost("{id}/reanalyze-as-doctor")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> ReanalyzeAsDoctor(
        string id,
        CancellationToken cancellationToken)
    {
        var resolvedId = await ResolveRequestIdAsync(id, cancellationToken);
        if (resolvedId == null) return NotFound();
        var doctorId = GetUserId();
        var request = await requestService.ReanalyzeAsDoctorAsync(resolvedId.Value, doctorId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Gera o PDF de receita de uma solicitação aprovada. Somente médicos.
    /// </summary>
    [HttpPost("{id}/generate-pdf")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> GeneratePdf(
        string id,
        CancellationToken cancellationToken)
    {
        var resolvedId = await ResolveRequestIdAsync(id, cancellationToken);
        if (resolvedId == null) return NotFound();
        var userId = GetUserId();
        var request = await requestService.GetRequestByIdAsync(resolvedId.Value, userId, cancellationToken);

        if (request.RequestType != "prescription")
            return BadRequest(new { error = "Apenas solicitações de receita podem gerar PDF." });

        var kindStr = (request.PrescriptionKind ?? "simple").Replace("_", "");
        var kind = Enum.TryParse<RenoveJa.Domain.Enums.PrescriptionKind>(kindStr, true, out var pk)
            ? pk
            : (RenoveJa.Domain.Enums.PrescriptionKind?)null;
        var pdfData = new PrescriptionPdfData(
            request.Id,
            request.PatientName ?? "Paciente",
            null,
            request.DoctorName ?? "Médico",
            "CRM",
            "SP",
            "Clínica Geral",
            request.Medications ?? new List<string>(),
            request.PrescriptionType ?? "simples",
            DateTime.UtcNow,
            PrescriptionKind: kind);

        var result = await pdfService.GenerateAndUploadAsync(pdfData, cancellationToken);

        if (!result.Success)
            return BadRequest(new { error = result.ErrorMessage ?? "Erro ao gerar PDF." });

        return Ok(new { success = true, pdfUrl = result.PdfUrl, message = "PDF gerado com sucesso." });
    }

    /// <summary>
    /// Pré-visualização do PDF da receita (base64). Médico ou paciente.
    /// </summary>
    [HttpGet("{id}/preview-pdf")]
    public async Task<IActionResult> PreviewPdf(string id, CancellationToken cancellationToken)
    {
        var resolvedId = await ResolveRequestIdAsync(id, cancellationToken);
        if (resolvedId == null) return NotFound();
        var userId = GetUserId();
        var bytes = await requestService.GetPrescriptionPdfPreviewAsync(resolvedId.Value, userId, cancellationToken);
        if (bytes == null || bytes.Length == 0)
            return BadRequest(new { error = "Não foi possível gerar o preview. Verifique se há medicamentos informados ou extraídos pela IA." });
        return File(bytes, "application/pdf", $"preview-receita-{resolvedId.Value}.pdf");
    }

    /// <summary>
    /// Pré-visualização do PDF de pedido de exame. Médico ou paciente.
    /// </summary>
    [HttpGet("{id}/preview-exam-pdf")]
    public async Task<IActionResult> PreviewExamPdf(string id, CancellationToken cancellationToken)
    {
        var resolvedId = await ResolveRequestIdAsync(id, cancellationToken);
        if (resolvedId == null) return NotFound();
        var userId = GetUserId();
        var bytes = await requestService.GetExamPdfPreviewAsync(resolvedId.Value, userId, cancellationToken);
        if (bytes == null || bytes.Length == 0)
            return BadRequest(new { error = "Não foi possível gerar o preview. Verifique se a solicitação é do tipo exame e se você tem acesso." });
        return File(bytes, "application/pdf", $"preview-pedido-exame-{resolvedId.Value}.pdf");
    }

    /// <summary>
    /// Médico atualiza medicamentos e/ou notas da receita antes da assinatura.
    /// </summary>
    [HttpPatch("{id}/prescription-content")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> UpdatePrescriptionContent(
        string id,
        [FromBody] UpdatePrescriptionContentDto dto,
        CancellationToken cancellationToken)
    {
        var resolvedId = await ResolveRequestIdAsync(id, cancellationToken);
        if (resolvedId == null) return NotFound();
        var doctorId = GetUserId();
        var request = await requestService.UpdatePrescriptionContentAsync(resolvedId.Value, dto.Medications, dto.Notes, doctorId, cancellationToken, dto.PrescriptionKind);
        return Ok(request);
    }

    /// <summary>
    /// Médico atualiza exames e/ou notas do pedido antes da assinatura.
    /// </summary>
    [HttpPatch("{id}/exam-content")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> UpdateExamContent(
        string id,
        [FromBody] UpdateExamContentDto dto,
        CancellationToken cancellationToken)
    {
        var resolvedId = await ResolveRequestIdAsync(id, cancellationToken);
        if (resolvedId == null) return NotFound();
        var doctorId = GetUserId();
        var request = await requestService.UpdateExamContentAsync(resolvedId.Value, dto.Exams, dto.Notes, doctorId, cancellationToken);
        return Ok(request);
    }
}
