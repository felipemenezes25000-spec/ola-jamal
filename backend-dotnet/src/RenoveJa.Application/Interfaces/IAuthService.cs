using RenoveJa.Application.DTOs.Auth;

namespace RenoveJa.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponseDto> RegisterAsync(RegisterRequestDto request, CancellationToken cancellationToken = default);
    Task<AuthResponseDto> RegisterDoctorAsync(RegisterDoctorRequestDto request, CancellationToken cancellationToken = default);
    Task<AuthResponseDto> LoginAsync(LoginRequestDto request, CancellationToken cancellationToken = default);
    Task<UserDto> GetMeAsync(Guid userId, CancellationToken cancellationToken = default);
    Task LogoutAsync(string token, CancellationToken cancellationToken = default);
    Task<AuthResponseDto> GoogleAuthAsync(GoogleAuthRequestDto request, CancellationToken cancellationToken = default);
    Task<(Guid UserId, string Role)> ValidateTokenAsync(string token, CancellationToken cancellationToken = default);
}
