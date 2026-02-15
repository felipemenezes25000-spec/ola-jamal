using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Infrastructure.Auth;

/// <summary>
/// Implementação do serviço de usuário atual usando HttpContext.
/// </summary>
public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IDoctorRepository _doctorRepository;

    public CurrentUserService(
        IHttpContextAccessor httpContextAccessor,
        IDoctorRepository doctorRepository)
    {
        _httpContextAccessor = httpContextAccessor;
        _doctorRepository = doctorRepository;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public Guid? GetUserId()
    {
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    public string? GetEmail()
    {
        return User?.FindFirst(ClaimTypes.Email)?.Value;
    }

    public bool IsDoctor()
    {
        return User?.IsInRole("doctor") ?? false;
    }

    public bool IsPatient()
    {
        return User?.IsInRole("patient") ?? false;
    }

    public async Task<Guid?> GetDoctorProfileIdAsync()
    {
        var userId = GetUserId();
        if (userId == null || !IsDoctor())
            return null;

        var profile = await _doctorRepository.GetByUserIdAsync(userId.Value);
        return profile?.Id;
    }

    // Sync version for controller compatibility
    public Guid? GetDoctorProfileId()
    {
        // Stored as a claim during login
        var profileIdClaim = User?.FindFirst("doctor_profile_id")?.Value;
        return Guid.TryParse(profileIdClaim, out var profileId) ? profileId : null;
    }

    public IEnumerable<Claim> GetClaims()
    {
        return User?.Claims ?? Enumerable.Empty<Claim>();
    }
}
