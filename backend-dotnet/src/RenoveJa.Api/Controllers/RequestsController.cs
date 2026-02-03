using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Interfaces;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

[ApiController]
[Route("api/requests")]
[Authorize]
public class RequestsController : ControllerBase
{
    private readonly IRequestService _requestService;

    public RequestsController(IRequestService requestService)
    {
        _requestService = requestService;
    }

    [HttpPost("prescription")]
    public async Task<IActionResult> CreatePrescription(
        [FromBody] CreatePrescriptionRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var result = await _requestService.CreatePrescriptionAsync(request, userId, cancellationToken);
        return Ok(new { request = result.Request, payment = result.Payment });
    }

    [HttpPost("exam")]
    public async Task<IActionResult> CreateExam(
        [FromBody] CreateExamRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var result = await _requestService.CreateExamAsync(request, userId, cancellationToken);
        return Ok(new { request = result.Request, payment = result.Payment });
    }

    [HttpPost("consultation")]
    public async Task<IActionResult> CreateConsultation(
        [FromBody] CreateConsultationRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var result = await _requestService.CreateConsultationAsync(request, userId, cancellationToken);
        return Ok(new { request = result.Request, payment = result.Payment });
    }

    [HttpGet]
    public async Task<IActionResult> GetRequests(
        [FromQuery] string? status,
        [FromQuery] string? type,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var requests = await _requestService.GetUserRequestsAsync(userId, status, type, cancellationToken);
        return Ok(requests);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetRequest(
        Guid id,
        CancellationToken cancellationToken)
    {
        var request = await _requestService.GetRequestByIdAsync(id, cancellationToken);
        return Ok(request);
    }

    [HttpPut("{id}/status")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        [FromBody] UpdateRequestStatusDto dto,
        CancellationToken cancellationToken)
    {
        var request = await _requestService.UpdateStatusAsync(id, dto, cancellationToken);
        return Ok(request);
    }

    [HttpPost("{id}/approve")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> Approve(
        Guid id,
        [FromBody] ApproveRequestDto dto,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var request = await _requestService.ApproveAsync(id, dto, doctorId, cancellationToken);
        return Ok(request);
    }

    [HttpPost("{id}/reject")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> Reject(
        Guid id,
        [FromBody] RejectRequestDto dto,
        CancellationToken cancellationToken)
    {
        var request = await _requestService.RejectAsync(id, dto, cancellationToken);
        return Ok(request);
    }

    [HttpPost("{id}/assign-queue")]
    public async Task<IActionResult> AssignQueue(
        Guid id,
        CancellationToken cancellationToken)
    {
        var request = await _requestService.AssignToQueueAsync(id, cancellationToken);
        return Ok(request);
    }

    [HttpPost("{id}/accept-consultation")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> AcceptConsultation(
        Guid id,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var result = await _requestService.AcceptConsultationAsync(id, doctorId, cancellationToken);
        return Ok(new { request = result.Request, video_room = result.VideoRoom });
    }

    [HttpPost("{id}/sign")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> Sign(
        Guid id,
        [FromBody] SignRequestDto dto,
        CancellationToken cancellationToken)
    {
        var request = await _requestService.SignAsync(id, dto, cancellationToken);
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
