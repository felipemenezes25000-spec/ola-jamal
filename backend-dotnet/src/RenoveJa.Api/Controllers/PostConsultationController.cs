using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Clinical;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
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
    IPatientRepository patientRepository,
    IDocumentTokenService documentTokenService,
    IStorageService storageService,
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
    /// medical_documents.patient_id referencia patients(id), não users(id). JWT é user id — resolvemos via Patient.UserId.
    /// </summary>
    private async Task<bool> UserCanAccessMedicalDocumentAsync(MedicalDocument doc, Guid userId, CancellationToken cancellationToken)
    {
        if (doc.PractitionerId == userId)
            return true;
        var patient = await patientRepository.GetByIdAsync(doc.PatientId, cancellationToken);
        return patient != null && patient.UserId == userId;
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
            // Mobile/api-client lê `error` ou `message` — enviar os dois para parsing consistente.
            return StatusCode(403, new { error = ex.Message, message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex,
                "Post-consultation emit failed for request {RequestId}",
                request.RequestId);
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Post-consultation emit unexpected error for request {RequestId}: {Message}",
                request.RequestId, ex.Message);
            return StatusCode(500, new { error = "Erro inesperado ao emitir documentos. Tente novamente." });
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
                    label = d switch
                    {
                        _ when d.DocumentType == Domain.Enums.DocumentType.Prescription => "Receita médica",
                        _ when d.DocumentType == Domain.Enums.DocumentType.ExamOrder => "Pedido de exame",
                        MedicalReport mr when mr.LeaveDays.HasValue && mr.LeaveDays > 0 => "Atestado médico",
                        MedicalReport => "Encaminhamento",
                        _ when d.DocumentType == Domain.Enums.DocumentType.MedicalCertificate => "Atestado médico",
                        _ => "Documento"
                    },
                    icon = d switch
                    {
                        _ when d.DocumentType == Domain.Enums.DocumentType.Prescription => "medkit",
                        _ when d.DocumentType == Domain.Enums.DocumentType.ExamOrder => "flask",
                        MedicalReport mr when mr.LeaveDays.HasValue && mr.LeaveDays > 0 => "document-text",
                        MedicalReport => "people",
                        _ when d.DocumentType == Domain.Enums.DocumentType.MedicalCertificate => "document-text",
                        _ => "document"
                    },
                    color = d switch
                    {
                        _ when d.DocumentType == Domain.Enums.DocumentType.Prescription => "#2E5BFF",
                        _ when d.DocumentType == Domain.Enums.DocumentType.ExamOrder => "#00B27A",
                        MedicalReport mr when mr.LeaveDays.HasValue && mr.LeaveDays > 0 => "#E88D1A",
                        MedicalReport => "#7C3AED",
                        _ when d.DocumentType == Domain.Enums.DocumentType.MedicalCertificate => "#E88D1A",
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
        if (!await UserCanAccessMedicalDocumentAsync(doc, userId, cancellationToken))
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
                var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!Guid.TryParse(userIdClaim, out var userId))
                    return Unauthorized(new { error = "Invalid or missing authentication" });
                if (!await UserCanAccessMedicalDocumentAsync(doc, userId, cancellationToken))
                    return StatusCode(403, new { error = "Access denied" });
            }

            // Streaming via backend — usa IStorageService para buckets privados (S3)
            var refOrUrl = await medicalDocumentRepository.GetSignedDocumentUrlAsync(documentId, cancellationToken);
            if (string.IsNullOrEmpty(refOrUrl))
                return NotFound(new { error = "PDF not yet available. Document may not be signed." });

            byte[]? pdfBytes = null;
            var pathOrUrl = refOrUrl.Trim();
            if (!pathOrUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                pdfBytes = await storageService.DownloadAsync(pathOrUrl, cancellationToken);
            else
            {
                pdfBytes = await storageService.DownloadFromStorageUrlAsync(pathOrUrl, cancellationToken);
                if (pdfBytes == null)
                {
                    var httpClient = httpClientFactory.CreateClient();
                    httpClient.Timeout = TimeSpan.FromSeconds(30);
                    pdfBytes = await httpClient.GetByteArrayAsync(pathOrUrl, cancellationToken);
                }
            }
            if (pdfBytes == null || pdfBytes.Length == 0)
                return NotFound(new { error = "Document not found." });
            return File(pdfBytes, "application/pdf", $"document-{documentId}.pdf");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to download document {DocumentId}", documentId);
            return BadRequest(new { error = "Erro ao baixar documento. Tente novamente." });
        }
    }
}
