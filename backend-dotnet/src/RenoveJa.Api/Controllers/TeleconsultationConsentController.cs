using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Api.Controllers;

[ApiController]
[Route("api/requests")]
[Authorize]
public class TeleconsultationConsentController(
    IUserRepository userRepository,
    IPatientRepository patientRepository,
    IConsentRepository consentRepository,
    IAuditEventService auditEventService,
    ILogger<TeleconsultationConsentController> logger) : ControllerBase
{
    public record TeleconsultationConsentRequest(string? Channel);

    [HttpPost("{requestId:guid}/teleconsultation-consent")]
    [Authorize(Roles = "patient")]
    public async Task<IActionResult> CreateTeleconsultationConsent(
        Guid requestId,
        [FromBody] TeleconsultationConsentRequest? request,
        CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { error = "Usuário não autenticado." });

        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        if (user == null)
            return NotFound(new { error = "Usuário não encontrado." });

        var patient = await patientRepository.GetByUserIdAsync(userId, cancellationToken);
        if (patient == null)
            return NotFound(new { error = "Paciente não encontrado." });

        var channel = string.IsNullOrWhiteSpace(request?.Channel) ? "mobile" : request.Channel.Trim();

        var consent = ConsentRecord.Create(
            patientId: patient.Id,
            consentType: ConsentType.TelemedicineSession,
            legalBasis: LegalBasis.ExplicitConsent,
            purpose: "Consentimento livre e esclarecido para teleconsulta conforme Resolução CFM 2.314/2022",
            acceptedAt: DateTime.UtcNow,
            channel: channel,
            textVersion: "1.0");

        var saved = await consentRepository.CreateAsync(consent, cancellationToken);

        patient.LinkConsentRecord(saved.Id);
        await patientRepository.UpdateAsync(patient, cancellationToken);

        await auditEventService.LogWriteAsync(
            userId,
            action: "ConsentCreated",
            entityType: "ConsentRecord",
            entityId: saved.Id,
            channel: channel,
            cancellationToken: cancellationToken);

        logger.LogInformation(
            "Teleconsultation consent {ConsentId} created for patient {PatientId} on request {RequestId}",
            saved.Id, patient.Id, requestId);

        return Created($"api/requests/{requestId}/teleconsultation-consent/{saved.Id}", new
        {
            consentId = saved.Id,
            requestId,
            consentType = ConsentType.TelemedicineSession.ToString(),
            acceptedAt = saved.AcceptedAt,
            channel = saved.Channel
        });
    }
}
