using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Api.Controllers;

[ApiController]
[Route("api/patients")]
[Authorize]
public class PatientsController(
    IUserRepository userRepository,
    IPatientRepository patientRepository,
    IRequestRepository requestRepository,
    IConsentRepository consentRepository,
    IAuditLogRepository auditLogRepository,
    IEncounterRepository encounterRepository,
    IMedicalDocumentRepository medicalDocumentRepository,
    IAuditService auditService) : ControllerBase
{
    [HttpGet("me/export")]
    [EnableRateLimiting("export")]
    public async Task<IActionResult> ExportMyData(CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { error = "Usuário não autenticado." });

        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        if (user == null)
            return NotFound(new { error = "Paciente não encontrado." });

        var requests = await requestRepository.GetByPatientIdAsync(userId, cancellationToken);
        var consents = await consentRepository.GetByPatientIdAsync(userId, cancellationToken);
        var auditLogs = await auditLogRepository.GetByUserIdAsync(userId, limit: 1000, offset: 0, cancellationToken);

        // Fetch encounters and medical documents via patient record (encounters FK → patients.id)
        var patient = await patientRepository.GetByUserIdAsync(userId, cancellationToken);
        var patientId = patient?.Id;

        var encounters = patientId.HasValue
            ? await encounterRepository.GetByPatientIdAsync(patientId.Value, cancellationToken)
            : [];

        var medicalDocuments = patientId.HasValue
            ? await medicalDocumentRepository.GetByPatientIdAsync(patientId.Value, cancellationToken)
            : [];

        await auditService.LogAsync(
            userId,
            "Export",
            "PatientDataExport",
            userId,
            metadata: new Dictionary<string, object?>
            {
                ["requests_count"] = requests.Count,
                ["consents_count"] = consents.Count,
                ["audit_count"] = auditLogs.Count,
                ["encounters_count"] = encounters.Count,
                ["medical_documents_count"] = medicalDocuments.Count
            });

        var payload = new
        {
            exportedAt = DateTime.UtcNow,
            patient = new
            {
                user.Id,
                user.Name,
                user.Email,
                user.Phone,
                user.Cpf,
                user.Role,
                user.CreatedAt,
                user.UpdatedAt
            },
            requests = requests.Select(r => new
            {
                r.Id,
                r.RequestType,
                r.Status,
                r.PrescriptionType,
                r.PrescriptionKind,
                r.Medications,
                r.Exams,
                r.Symptoms,
                r.SignedDocumentUrl,
                r.SignedAt,
                r.CreatedAt,
                r.UpdatedAt
            }),
            consents = consents.Select(c => new
            {
                c.Id,
                c.ConsentType,
                c.LegalBasis,
                c.Purpose,
                c.AcceptedAt,
                c.Channel,
                c.TextVersion,
                c.CreatedAt
            }),
            encounters = encounters.Select(e => new
            {
                e.Id,
                Type = e.Type.ToString(),
                e.Status,
                e.StartedAt,
                e.FinishedAt,
                e.Channel,
                e.Anamnesis,
                e.MainIcd10Code,
                e.CreatedAt
            }),
            medicalDocuments = medicalDocuments.Select(d => new
            {
                d.Id,
                d.DocumentType,
                d.Status,
                d.CreatedAt
            }),
            auditLogs = auditLogs.Select(a => new
            {
                a.Id,
                a.Action,
                a.EntityType,
                a.EntityId,
                a.CorrelationId,
                a.Metadata,
                a.CreatedAt
            })
        };

        return Ok(payload);
    }
}
