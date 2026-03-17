using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RenoveJa.Application.DTOs.Doctors;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Doctors;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Endpoints administrativos para aprovação de médicos.
/// A UI/admin será implementada externamente e irá consumir estas APIs.
/// </summary>
[ApiController]
[Route("api/admin/doctors")]
[Authorize(Roles = "admin")]
[EnableRateLimiting("admin")]  // NM-6: separate rate limit bucket from login "auth" policy
public class AdminDoctorsController(
    IDoctorRepository doctorRepository,
    IUserRepository userRepository,
    IPushNotificationDispatcher pushDispatcher,
    ILogger<AdminDoctorsController> logger) : ControllerBase
{
    /// <summary>
    /// Lista médicos filtrando por status de aprovação.
    /// Exemplo: GET /api/admin/doctors?status=pending
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetDoctors(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        // NH-5: enforce pagination to prevent unbounded queries
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        DoctorApprovalStatus? filterStatus = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim().ToLowerInvariant();
            filterStatus = normalized switch
            {
                "approved" => DoctorApprovalStatus.Approved,
                "rejected" => DoctorApprovalStatus.Rejected,
                "pending" => DoctorApprovalStatus.Pending,
                _ => null
            };
        }

        var all = await doctorRepository.GetAllAsync(cancellationToken);
        if (filterStatus.HasValue)
        {
            all = all.Where(d => d.ApprovalStatus == filterStatus.Value).ToList();
        }

        var totalCount = all.Count;

        if (totalCount == 0)
            return Ok(new { items = Array.Empty<DoctorListResponseDto>(), totalCount = 0, page, pageSize });

        // NH-5: apply pagination
        var pagedProfiles = all.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        var userIds = pagedProfiles.Select(d => d.UserId).Distinct();
        var users = await userRepository.GetByIdsAsync(userIds, cancellationToken);
        var userMap = users.ToDictionary(u => u.Id);

        var dtos = new List<DoctorListResponseDto>();
        foreach (var profile in pagedProfiles)
        {
            if (!userMap.TryGetValue(profile.UserId, out var user))
                continue;

            dtos.Add(new DoctorListResponseDto(
                profile.Id,
                user.Name,
                user.Email,
                user.Phone?.Value,
                user.AvatarUrl,
                profile.Crm,
                profile.CrmState,
                profile.Specialty,
                profile.Bio,
                profile.Rating,
                profile.TotalConsultations,
                profile.Available,
                profile.ApprovalStatus.ToString().ToLowerInvariant(),
                user.BirthDate,
                user.Cpf,
                user.Street,
                user.Number,
                user.Neighborhood,
                user.Complement,
                user.City,
                user.State,
                user.PostalCode,
                profile.ProfessionalAddress,
                profile.ProfessionalPhone,
                profile.ProfessionalPostalCode,
                profile.ProfessionalStreet,
                profile.ProfessionalNumber,
                profile.ProfessionalNeighborhood,
                profile.ProfessionalComplement,
                profile.ProfessionalCity,
                profile.ProfessionalState,
                profile.University,
                profile.Courses,
                profile.HospitalsServices));
        }

        return Ok(new { items = dtos, totalCount, page, pageSize });
    }

    /// <summary>
    /// Aprova um médico para atuar na plataforma.
    /// </summary>
    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> ApproveDoctor(
        Guid id,
        CancellationToken cancellationToken)
    {
        var profile = await doctorRepository.GetByIdAsync(id, cancellationToken);
        if (profile == null)
            return NotFound(new { error = "Médico não encontrado." });

        profile.Approve();
        profile = await doctorRepository.UpdateAsync(profile, cancellationToken);
        logger.LogInformation("Doctor approved by admin: doctorProfileId={DoctorProfileId}", id);

        // Notificar médico sobre aprovação (fire-and-forget)
        _ = pushDispatcher.SendAsync(
                PushNotificationRules.DoctorApprovedByAdmin(profile.UserId), CancellationToken.None)
            .ContinueWith(t =>
            {
                if (t.IsFaulted)
                    logger.LogDebug(t.Exception?.InnerException, "Failed to notify doctor about approval");
            }, TaskScheduler.Default);

        return Ok(new
        {
            id = profile.Id,
            approvalStatus = profile.ApprovalStatus.ToString().ToLowerInvariant(),
            available = profile.Available
        });
    }

    /// <summary>
    /// Reprova um médico para atuar na plataforma.
    /// </summary>
    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> RejectDoctor(
        Guid id,
        [FromBody] AdminRejectDoctorRequest? body,
        CancellationToken cancellationToken)
    {
        var profile = await doctorRepository.GetByIdAsync(id, cancellationToken);
        if (profile == null)
            return NotFound(new { error = "Médico não encontrado." });

        profile.Reject();
        profile = await doctorRepository.UpdateAsync(profile, cancellationToken);

        logger.LogInformation("Doctor rejected by admin: doctorProfileId={DoctorProfileId}, reason={Reason}", id, body?.Reason);

        // TODO [NL-4]: Send email notification to the doctor informing them of the rejection.
        // Use IEmailService (add a SendDoctorRejectionEmailAsync method) with the doctor's email and body?.Reason.
        // The doctor's email can be retrieved via userRepository.GetByIdAsync(profile.UserId).

        // Notificar médico sobre rejeição (fire-and-forget)
        _ = pushDispatcher.SendAsync(
                PushNotificationRules.DoctorRejectedByAdmin(profile.UserId), CancellationToken.None)
            .ContinueWith(t =>
            {
                if (t.IsFaulted)
                    logger.LogDebug(t.Exception?.InnerException, "Failed to notify doctor about rejection");
            }, TaskScheduler.Default);

        return Ok(new
        {
            id = profile.Id,
            approvalStatus = profile.ApprovalStatus.ToString().ToLowerInvariant(),
            available = profile.Available,
            reason = body?.Reason
        });
    }
}

/// <summary>
/// Payload opcional para reprovar médico com motivo.
/// </summary>
public record AdminRejectDoctorRequest(string? Reason);

