using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Clinical;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller para emissão e consulta de documentos pós-consulta.
/// </summary>
[ApiController]
[Route("api/post-consultation")]
[Authorize]
public class PostConsultationController(
    IPostConsultationService postConsultationService,
    IEncounterRepository encounterRepository,
    IMedicalDocumentRepository medicalDocumentRepository,
    IRequestRepository requestRepository,
    IDocumentTokenService documentTokenService,
    IHttpClientFactory httpClientFactory,
    ILogger<PostConsultationController> logger) : ControllerBase
{
    private Guid GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(claim, out var id))
            throw new UnauthorizedAccessException("Invalid user ID");
        return id;
    }

    /// <summary>
    /// Emite todos os documentos pós-consulta de uma vez.
    /// Cria receita, exames e/ou atestado, vincula ao Encounter,
    /// atualiza o prontuário e retorna os IDs dos documentos criados.
    /// </summary>
    /// <remarks>
    /// A assinatura digital (ICP-Brasil PAdES) e geração de PDF
    /// acontecem no fluxo existente de sign do editor de receitas.
    /// Este endpoint cria os documentos em status Draft; o médico
    /// assina via o fluxo normal do PrescriptionExamController.
    /// </remarks>
    [HttpPost("emit")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> EmitDocuments(
        [FromBody] PostConsultationEmitRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var doctorId = GetUserId();
            var result = await postConsultationService
                .EmitDocumentsAsync(doctorId, request, cancellationToken);

            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex,
                "Post-consultation emit failed for request {RequestId}",
                request.RequestId);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Lista todos os documentos emitidos na pós-consulta de um request.
    /// Paciente ou médico podem acessar.
    /// </summary>
    [HttpGet("{requestId}/documents")]
    public async Task<IActionResult> GetDocuments(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        try
        {
            var userId = GetUserId();

            // Validar acesso — apenas paciente ou médico atribuído
            var medicalRequest = await requestRepository.GetByIdAsync(requestId, cancellationToken);
            if (medicalRequest == null) return NotFound(new { error = "Request not found" });
            if (medicalRequest.PatientId != userId && medicalRequest.DoctorId != userId)
                return StatusCode(403, new { error = "Access denied" });

            // Buscar encounter do request
            var encounter = await encounterRepository.GetBySourceRequestIdAsync(requestId, cancellationToken);
            if (encounter == null)
                return Ok(new { documents = Array.Empty<object>() });

            // Buscar todos os MedicalDocuments vinculados ao encounter
            var docs = await medicalDocumentRepository.GetByEncounterIdAsync(encounter.Id, cancellationToken);

            var result = new List<object>();
            foreach (var d in docs)
            {
                var sec = await medicalDocumentRepository.GetSecurityFieldsAsync(d.Id, cancellationToken);
                result.Add(new
                {
                    id = d.Id,
                    documentType = d.DocumentType.ToString().ToLowerInvariant(),
                    status = d.Status.ToString().ToLowerInvariant(),
                    signedAt = d.SignedAt,
                    expiresAt = sec?.expiresAt,
                    accessCode = sec?.accessCode,
                    dispensedCount = sec?.dispensedCount ?? 0,
                    label = d.DocumentType switch
                    {
                        Domain.Enums.DocumentType.Prescription => "Receita médica",
                        Domain.Enums.DocumentType.ExamOrder => "Pedido de exame",
                        Domain.Enums.DocumentType.MedicalCertificate => "Atestado médico",
                        Domain.Enums.DocumentType.MedicalReport => "Relatório médico",
                        _ => "Documento"
                    },
                    icon = d.DocumentType switch
                    {
                        Domain.Enums.DocumentType.Prescription => "medkit",
                        Domain.Enums.DocumentType.ExamOrder => "flask",
                        Domain.Enums.DocumentType.MedicalCertificate => "document-text",
                        _ => "document"
                    },
                    color = d.DocumentType switch
                    {
                        Domain.Enums.DocumentType.Prescription => "#2E5BFF",
                        Domain.Enums.DocumentType.ExamOrder => "#00B27A",
                        Domain.Enums.DocumentType.MedicalCertificate => "#E88D1A",
                        _ => "#6B7280"
                    },
                });
            }

            return Ok(new { documents = result });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to get documents for request {RequestId}", requestId);
            return BadRequest(new { error = "Erro ao buscar documentos. Tente novamente." });
        }
    }

    /// <summary>
    /// Gera token temporário para download de um MedicalDocument específico.
    /// </summary>
    [HttpPost("documents/{documentId}/token")]
    public async Task<IActionResult> CreateDocumentTokenById(
        Guid documentId, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var doc = await medicalDocumentRepository.GetByIdAsync(documentId, cancellationToken);
        if (doc == null) return NotFound(new { error = "Document not found" });
        if (doc.PatientId != userId && doc.PractitionerId != userId)
            return StatusCode(403, new { error = "Access denied" });

        var token = documentTokenService.GenerateDocumentToken(documentId, validMinutes: 5);
        return Ok(new { token });
    }

    /// <summary>
    /// Download do PDF de um MedicalDocument específico.
    /// Aceita Bearer ou ?token= (temporário).
    /// </summary>
    [HttpGet("documents/{documentId}/download")]
    [AllowAnonymous]
    public async Task<IActionResult> DownloadDocumentById(
        Guid documentId, [FromQuery] string? token, CancellationToken cancellationToken)
    {
        try
        {
            var doc = await medicalDocumentRepository.GetByIdAsync(documentId, cancellationToken);
            if (doc == null) return NotFound(new { error = "Document not found" });

            // Validar acesso via token ou JWT
            if (!string.IsNullOrWhiteSpace(token))
            {
                if (!documentTokenService.ValidateDocumentToken(token, documentId))
                    return StatusCode(403, new { error = "Invalid or expired token" });
            }
            else
            {
                var userId = GetUserId();
                if (doc.PatientId != userId && doc.PractitionerId != userId)
                    return StatusCode(403, new { error = "Access denied" });
            }

            // Streaming via backend — não redirecionar para S3 (pode ser privado)
            var pdfUrl = await medicalDocumentRepository.GetSignedDocumentUrlAsync(documentId, cancellationToken);
            if (string.IsNullOrEmpty(pdfUrl))
                return NotFound(new { error = "PDF not yet available. Document may not be signed." });

            // FIX B29: Use IHttpClientFactory instead of raw HttpClient to avoid socket exhaustion
            var httpClient = httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30);
            var pdfBytes = await httpClient.GetByteArrayAsync(pdfUrl);
            return File(pdfBytes, "application/pdf", $"document-{documentId}.pdf");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to download document {DocumentId}", documentId);
            return BadRequest(new { error = "Erro ao baixar documento. Tente novamente." });
        }
    }
}
