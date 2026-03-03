using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Clinical;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Endpoints FHIR-lite / prontuário enxuto para consumo pelo app.
/// Foca, neste momento, em resumo de paciente ancorado em consultas, receitas e exames.
/// </summary>
[ApiController]
[Route("api/fhir-lite")]
[Authorize]
public class FhirLiteController(
    IClinicalRecordService clinicalRecordService,
    IAuditEventService auditEventService,
    ILogger<FhirLiteController> logger) : ControllerBase
{
    /// <summary>
    /// Retorna o resumo de prontuário do próprio paciente autenticado,
    /// agregando dados do novo modelo clínico ou, quando vazio, das solicitações (requests).
    /// </summary>
    [HttpGet("patient-summary")]
    [Authorize(Roles = "patient")]
    public async Task<ActionResult<PatientSummaryDto>> GetMyPatientSummary(CancellationToken cancellationToken)
    {
        var userId = GetUserId();

        try
        {
            var dto = await clinicalRecordService.GetPatientSummaryAsync(userId, cancellationToken);

            await auditEventService.LogReadAsync(
                userId,
                "PatientSummary",
                userId,
                channel: "api",
                ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
                userAgent: HttpContext.Request.Headers.UserAgent.ToString(),
                cancellationToken: cancellationToken);

            return Ok(dto);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("not found", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning(ex, "Patient summary: usuário {UserId} não encontrado", userId);
            return NotFound(new { error = "Usuário não encontrado." });
        }
    }

    /// <summary>
    /// Retorna o histórico de atendimentos (encounters) do paciente autenticado.
    /// </summary>
    [HttpGet("encounters")]
    [Authorize(Roles = "patient")]
    public async Task<ActionResult<IReadOnlyList<EncounterSummaryDto>>> GetMyEncounters(
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0,
        CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        var encounters = await clinicalRecordService.GetEncountersByPatientAsync(userId, limit, offset, cancellationToken);

        await auditEventService.LogReadAsync(
            userId,
            "EncounterList",
            userId,
            channel: "api",
            ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
            userAgent: HttpContext.Request.Headers.UserAgent.ToString(),
            cancellationToken: cancellationToken);

        return Ok(encounters);
    }

    /// <summary>
    /// Retorna a lista de documentos médicos (receitas, exames, atestados) do paciente autenticado.
    /// </summary>
    [HttpGet("documents")]
    [Authorize(Roles = "patient")]
    public async Task<ActionResult<IReadOnlyList<MedicalDocumentSummaryDto>>> GetMyDocuments(
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0,
        CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        var documents = await clinicalRecordService.GetMedicalDocumentsByPatientAsync(userId, limit, offset, cancellationToken);

        await auditEventService.LogReadAsync(
            userId,
            "MedicalDocumentList",
            userId,
            channel: "api",
            ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
            userAgent: HttpContext.Request.Headers.UserAgent.ToString(),
            cancellationToken: cancellationToken);

        return Ok(documents);
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}

