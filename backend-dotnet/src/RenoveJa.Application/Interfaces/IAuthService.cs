using RenoveJa.Application.DTOs.Auth;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de autenticação: registro, login, validação de token e perfil.
/// </summary>
public interface IAuthService
{
    /// <summary>Registra um novo paciente.</summary>
    Task<AuthResponseDto> RegisterAsync(RegisterRequestDto request, CancellationToken cancellationToken = default);
    /// <summary>Registra um novo médico.</summary>
    Task<AuthResponseDto> RegisterDoctorAsync(RegisterDoctorRequestDto request, CancellationToken cancellationToken = default);
    /// <summary>Realiza login com e-mail e senha.</summary>
    Task<AuthResponseDto> LoginAsync(LoginRequestDto request, CancellationToken cancellationToken = default);
    /// <summary>Retorna os dados do usuário pelo ID.</summary>
    Task<UserDto> GetMeAsync(Guid userId, CancellationToken cancellationToken = default);
    /// <summary>Encerra a sessão invalidando o token.</summary>
    Task LogoutAsync(string token, CancellationToken cancellationToken = default);
    /// <summary>Autentica via Google OAuth.</summary>
    Task<AuthResponseDto> GoogleAuthAsync(GoogleAuthRequestDto request, CancellationToken cancellationToken = default);
    /// <summary>Conclui o cadastro (phone, CPF, birth date) para usuários criados via Google.</summary>
    Task<UserDto> CompleteProfileAsync(Guid userId, CompleteProfileRequestDto request, CancellationToken cancellationToken = default);
    /// <summary>Cancela o cadastro e remove o usuário (apenas se perfil ainda incompleto). Rollback para quem não completou.</summary>
    Task CancelRegistrationAsync(Guid userId, CancellationToken cancellationToken = default);
    /// <summary>Valida o token e retorna o ID do usuário e a role.</summary>
    Task<(Guid UserId, string Role)> ValidateTokenAsync(string token, CancellationToken cancellationToken = default);
}
