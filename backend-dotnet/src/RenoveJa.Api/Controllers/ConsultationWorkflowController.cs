using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Postgres;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

[ApiController]
[Route("api/requests")]
[Authorize]
public class ConsultationWorkflowController(
    IRequestService requestService,
    IConsultationEncounterService consultationEncounterService,
    IRequestRepository requestRepository,
    PostgresClient db,
    ILogger<ConsultationWorkflowController> logger) : ControllerBase
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

    private sealed class PatientChronicRow
    {
        public Guid Id { get; set; }
        public bool HasChronicCondition { get; set; }
    }

    private sealed class EncounterPresentialRow
    {
        public DateTime? StartedAt { get; set; }
    }

    private async Task<string?> BuildChronic180DaysWarningAsync(Guid patientUserId, CancellationToken cancellationToken)
    {
        var patient = await db.GetSingleAsync<PatientChronicRow>(
            "patients",
            "id,has_chronic_condition",
            $"user_id=eq.{patientUserId}",
            cancellationToken);

        if (patient == null || !patient.HasChronicCondition)
            return null;

        // is_presential é TEXT no schema — eq.true virava parâmetro boolean e PG falhava (text = boolean) → 500.
        // ilike.true compara como texto; order/limit no filter eram ignorados pelo GetSingleAsync — usar GetAllAsync.
        var presentialRows = await db.GetAllAsync<EncounterPresentialRow>(
            "encounters",
            "started_at",
            $"patient_id=eq.{patient.Id}&is_presential=ilike.true",
            orderBy: "started_at.desc",
            limit: 1,
            cancellationToken: cancellationToken);
        var lastPresential = presentialRows.Count > 0 ? presentialRows[0] : null;

        if (lastPresential?.StartedAt == null)
            return "Atenção: paciente crônico sem registro de consulta presencial (Art. 6º, §2º, Res. CFM 2.314/2022).";

        var days = (DateTime.UtcNow - lastPresential.StartedAt.Value).TotalDays;
        if (days <= 180)
            return null;

        return $"Atenção: paciente crônico sem consulta presencial há {Math.Floor(days)} dias (Art. 6º, §2º, Res. CFM 2.314/2022).";
    }

    /// <summary>
    /// Aceita a consulta e cria sala de vídeo (médico).
    /// </summary>
    [HttpPost("{id}/accept-consultation")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> AcceptConsultation(
        string id,
        CancellationToken cancellationToken)
    {
        var resolvedId = await ResolveRequestIdAsync(id, cancellationToken);
        if (resolvedId == null) return NotFound();
        var doctorId = GetUserId();
        var result = await requestService.AcceptConsultationAsync(resolvedId.Value, doctorId, cancellationToken);
        return Ok(new AcceptConsultationResponseDto(result.Request, result.VideoRoom));
    }

    /// <summary>
    /// Médico inicia a consulta (status Paid → InConsultation). O timer só começa quando médico e paciente reportam chamada conectada.
    /// </summary>
    [HttpPost("{id}/start-consultation")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> StartConsultation(
        Guid id,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var request = await requestService.StartConsultationAsync(id, doctorId, cancellationToken);
        string? chronicWarning = null;
        try
        {
            chronicWarning = await BuildChronic180DaysWarningAsync(request.PatientId, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[StartConsultation] Falha ao calcular aviso CFM 180d (paciente user {PatientId})", request.PatientId);
        }

        return Ok(new
        {
            request,
            chronicWarning
        });
    }

    /// <summary>
    /// Médico ou paciente reporta que está com a chamada de vídeo conectada (WebRTC). Quando ambos tiverem reportado, o timer começa.
    /// </summary>
    [HttpPost("{id}/report-call-connected")]
    [Authorize]
    public async Task<IActionResult> ReportCallConnected(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestService.ReportCallConnectedAsync(id, userId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Médico encerra a consulta: persiste notas clínicas, deleta sala Daily e notifica paciente.
    /// </summary>
    [HttpPost("{id}/finish-consultation")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> FinishConsultation(
        Guid id,
        [FromBody] FinishConsultationDto? dto,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var request = await requestService.FinishConsultationAsync(id, doctorId, dto, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Médico salva nota clínica editada no prontuário (writeback do resumo da consulta).
    /// </summary>
    [HttpPost("{id}/save-consultation-summary")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> SaveConsultationSummary(
        string id,
        [FromBody] SaveConsultationSummaryDto dto,
        CancellationToken cancellationToken)
    {
        var resolvedId = await ResolveRequestIdAsync(id, cancellationToken);
        if (resolvedId == null) return NotFound();
        try
        {
            var doctorId = GetUserId();
            await consultationEncounterService.UpdateEncounterClinicalNotesAsync(
                resolvedId.Value, doctorId, dto.Anamnesis, dto.Plan, cancellationToken);
            return Ok(new { saved = true });
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("não encontrado"))
        {
            return NotFound(new { error = "Prontuário desta consulta não encontrado. A consulta pode não ter sido iniciada com vídeo conectado." });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    /// <summary>
    /// Encerramento automático da consulta pelo app quando o timer de minutos contratados expirar.
    /// Pode ser chamado pelo paciente ou médico. Credita minutos não usados ao banco de horas.
    /// </summary>
    [HttpPost("{id}/auto-finish-consultation")]
    public async Task<IActionResult> AutoFinishConsultation(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var userId = GetUserId();
            var request = await requestService.AutoFinishConsultationAsync(id, userId, cancellationToken);
            return Ok(request);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Retorna o saldo do banco de horas do paciente para o tipo de consulta especificado.
    /// GET /api/requests/time-bank?consultationType=psicologo
    /// </summary>
    [HttpGet("time-bank")]
    public async Task<IActionResult> GetTimeBankBalance([FromQuery] string consultationType = "medico_clinico", CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        var (balanceSeconds, balanceMinutes, type) = await requestService.GetTimeBankBalanceAsync(userId, consultationType, cancellationToken);
        return Ok(new { balanceSeconds, balanceMinutes, consultationType = type });
    }
}
