using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RenoveJa.Application.DTOs.Doctors;
using RenoveJa.Application.Services.Doctors;
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
[EnableRateLimiting("auth")]
public class AdminDoctorsController(
    IDoctorRepository doctorRepository,
    IUserRepository userRepository,
    ILogger<AdminDoctorsController> logger) : ControllerBase
{
    /// <summary>
    /// Lista médicos filtrando por status de aprovação.
    /// Exemplo: GET /api/admin/doctors?status=pending
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetDoctors(
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
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

        if (all.Count == 0)
            return Ok(Array.Empty<DoctorListResponseDto>());

        var userIds = all.Select(d => d.UserId).Distinct();
        var users = await userRepository.GetByIdsAsync(userIds, cancellationToken);
        var userMap = users.ToDictionary(u => u.Id);

        var dtos = new List<DoctorListResponseDto>();
        foreach (var profile in all)
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

        return Ok(dtos);
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

