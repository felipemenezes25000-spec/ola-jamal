using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Interfaces;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por solicitações médicas (receita, exame, consulta) e fluxo de aprovação.
/// </summary>
[ApiController]
[Route("api/requests")]
[Authorize]
public class RequestsController(IRequestService requestService) : ControllerBase
{
    /// <summary>
    /// Cria uma solicitação de receita médica.
    /// </summary>
    [HttpPost("prescription")]
    public async Task<IActionResult> CreatePrescription(
        [FromBody] CreatePrescriptionRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var result = await requestService.CreatePrescriptionAsync(request, userId, cancellationToken);
        return Ok(new { request = result.Request, payment = result.Payment });
    }

    /// <summary>
    /// Cria uma solicitação de exame.
    /// </summary>
    [HttpPost("exam")]
    public async Task<IActionResult> CreateExam(
        [FromBody] CreateExamRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var result = await requestService.CreateExamAsync(request, userId, cancellationToken);
        return Ok(new { request = result.Request, payment = result.Payment });
    }

    /// <summary>
    /// Cria uma solicitação de consulta.
    /// </summary>
    [HttpPost("consultation")]
    public async Task<IActionResult> CreateConsultation(
        [FromBody] CreateConsultationRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var result = await requestService.CreateConsultationAsync(request, userId, cancellationToken);
        return Ok(new { request = result.Request, payment = result.Payment });
    }

    /// <summary>
    /// Lista solicitações do usuário, com filtros opcionais por status e tipo.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetRequests(
        [FromQuery] string? status,
        [FromQuery] string? type,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var requests = await requestService.GetUserRequestsAsync(userId, status, type, cancellationToken);
        return Ok(requests);
    }

    /// <summary>
    /// Obtém uma solicitação pelo ID.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetRequest(
        Guid id,
        CancellationToken cancellationToken)
    {
        var request = await requestService.GetRequestByIdAsync(id, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Atualiza o status de uma solicitação (médico).
    /// </summary>
    [HttpPut("{id}/status")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        [FromBody] UpdateRequestStatusDto dto,
        CancellationToken cancellationToken)
    {
        var request = await requestService.UpdateStatusAsync(id, dto, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Aprova uma solicitação e define valor (médico).
    /// </summary>
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> Approve(
        Guid id,
        [FromBody] ApproveRequestDto dto,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var request = await requestService.ApproveAsync(id, dto, doctorId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Rejeita uma solicitação com motivo (médico).
    /// </summary>
    [HttpPost("{id}/reject")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> Reject(
        Guid id,
        [FromBody] RejectRequestDto dto,
        CancellationToken cancellationToken)
    {
        var request = await requestService.RejectAsync(id, dto, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Atribui a solicitação à fila (próximo médico disponível).
    /// </summary>
    [HttpPost("{id}/assign-queue")]
    public async Task<IActionResult> AssignQueue(
        Guid id,
        CancellationToken cancellationToken)
    {
        var request = await requestService.AssignToQueueAsync(id, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Aceita a consulta e cria sala de vídeo (médico).
    /// </summary>
    [HttpPost("{id}/accept-consultation")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> AcceptConsultation(
        Guid id,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var result = await requestService.AcceptConsultationAsync(id, doctorId, cancellationToken);
        return Ok(new { request = result.Request, video_room = result.VideoRoom });
    }

    /// <summary>
    /// Assina digitalmente a solicitação (médico).
    /// </summary>
    [HttpPost("{id}/sign")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> Sign(
        Guid id,
        [FromBody] SignRequestDto dto,
        CancellationToken cancellationToken)
    {
        var request = await requestService.SignAsync(id, dto, cancellationToken);
        return Ok(request);
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
