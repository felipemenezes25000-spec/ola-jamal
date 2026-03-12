using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.CarePlans;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public class CarePlansController(ICarePlanService carePlanService) : ControllerBase
{
    [HttpPost("consultations/{consultationId:guid}/ai/exam-suggestions")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> CreateAiSuggestion(
        Guid consultationId,
        [FromBody] CreateAiSuggestionRequestDto request,
        CancellationToken cancellationToken)
    {
        var created = await carePlanService.CreateAiSuggestionAsync(consultationId, request, cancellationToken);
        return Ok(new { aiSuggestionId = created.Id, suggestion = created });
    }

    [HttpGet("consultations/{consultationId:guid}/ai/exam-suggestions")]
    [Authorize(Roles = "doctor,patient")]
    public async Task<IActionResult> GetAiSuggestions(
        Guid consultationId,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var statuses = string.IsNullOrWhiteSpace(status)
            ? null
            : status.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(x => x.Trim().ToLowerInvariant())
                .ToArray();

        var userId = GetUserId();
        var suggestions = await carePlanService.GetAiSuggestionsAsync(consultationId, statuses, userId, cancellationToken);
        return Ok(suggestions);
    }

    [HttpPost("consultations/{consultationId:guid}/care-plans")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> CreateCarePlan(
        Guid consultationId,
        [FromBody] CreateCarePlanFromSuggestionRequestDto request,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var carePlan = await carePlanService.CreateCarePlanFromSuggestionAsync(
            consultationId,
            doctorId,
            request,
            cancellationToken);
        return Ok(new { carePlanId = carePlan.Id, status = carePlan.Status, carePlan });
    }

    [HttpGet("consultations/{consultationId:guid}/care-plan")]
    [Authorize(Roles = "doctor,patient")]
    public async Task<IActionResult> GetCarePlanByConsultation(
        Guid consultationId,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var result = await carePlanService.GetCarePlanByConsultationIdAsync(consultationId, userId, cancellationToken);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpGet("care-plans/{carePlanId:guid}")]
    [Authorize(Roles = "doctor,patient")]
    public async Task<IActionResult> GetCarePlan(
        Guid carePlanId,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var result = await carePlanService.GetCarePlanByIdAsync(carePlanId, userId, cancellationToken);
        return Ok(result);
    }

    [HttpPost("care-plans/{carePlanId:guid}/tasks/{taskId:guid}/actions")]
    [Authorize(Roles = "doctor,patient")]
    public async Task<IActionResult> ExecuteTaskAction(
        Guid carePlanId,
        Guid taskId,
        [FromBody] CarePlanTaskActionRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var role = GetUserRole();
        var result = await carePlanService.ExecuteTaskActionAsync(
            carePlanId,
            taskId,
            userId,
            role,
            request,
            cancellationToken);
        return Ok(result);
    }

    [HttpPost("care-plans/{carePlanId:guid}/tasks/{taskId:guid}/files")]
    [Authorize(Roles = "patient")]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public async Task<IActionResult> UploadTaskFile(
        Guid carePlanId,
        Guid taskId,
        [FromForm] IFormFile? file,
        CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "Arquivo é obrigatório" });

        await using var stream = file.OpenReadStream();
        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms, cancellationToken);

        var uploaded = await carePlanService.UploadTaskFileAsync(
            carePlanId,
            taskId,
            GetUserId(),
            file.FileName,
            file.ContentType ?? "application/octet-stream",
            ms.ToArray(),
            cancellationToken);

        return Ok(uploaded);
    }

    [HttpPost("care-plans/{carePlanId:guid}/review")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> ReviewCarePlan(
        Guid carePlanId,
        [FromBody] ReviewCarePlanRequestDto request,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var result = await carePlanService.ReviewAndOptionallyCloseAsync(carePlanId, doctorId, request, cancellationToken);
        return Ok(result);
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }

    private string GetUserRole()
    {
        return User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
    }
}
