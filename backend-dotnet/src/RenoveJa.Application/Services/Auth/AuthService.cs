using BCrypt.Net;
using Google.Apis.Auth;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Auth;
using RenoveJa.Application.Exceptions;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Auth;

/// <summary>
/// Serviço de autenticação: registro, login, validação de token e perfil do usuário.
/// </summary>
public class AuthService(
    IUserRepository userRepository,
    IDoctorRepository doctorRepository,
    IAuthTokenRepository tokenRepository,
    IPasswordResetTokenRepository passwordResetTokenRepository,
    IEmailService emailService,
    IOptions<SmtpConfig> smtpConfig,
    IOptions<GoogleAuthConfig> googleAuthConfig) : IAuthService
{
    /// <summary>
    /// Registra um novo paciente na plataforma.
    /// Em caso de falha após criar o user, faz rollback (remove o user).
    /// </summary>
    public async Task<AuthResponseDto> RegisterAsync(
        RegisterRequestDto request,
        CancellationToken cancellationToken = default)
    {
        if (await userRepository.ExistsByEmailAsync(request.Email, cancellationToken))
            throw new AuthConflictException("Este e-mail já está cadastrado. Use outro ou faça login.");

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        var user = User.CreatePatient(
            request.Name,
            request.Email,
            passwordHash,
            request.Cpf,
            request.Phone,
            request.BirthDate,
            request.Street,
            request.Number,
            request.Neighborhood,
            request.Complement,
            request.City,
            request.State,
            request.PostalCode);

        user = await userRepository.CreateAsync(user, cancellationToken);

        try
        {
            var token = AuthToken.Create(user.Id);
            await tokenRepository.CreateAsync(token, cancellationToken);
            return new AuthResponseDto(MapUserToDto(user), token.Token);
        }
        catch
        {
            await RollbackUserAsync(user.Id, cancellationToken);
            throw;
        }
    }

    /// <summary>
    /// Registra um novo médico na plataforma.
    /// Em caso de falha ao criar doctor_profile ou token, faz rollback (remove perfil e/ou user).
    /// </summary>
    public async Task<AuthResponseDto> RegisterDoctorAsync(
        RegisterDoctorRequestDto request,
        CancellationToken cancellationToken = default)
    {
        if (await userRepository.ExistsByEmailAsync(request.Email, cancellationToken))
            throw new AuthConflictException("Este e-mail já está cadastrado. Use outro ou faça login.");

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        var user = User.CreateDoctor(
            request.Name,
            request.Email,
            passwordHash,
            request.Phone,
            request.Cpf,
            request.BirthDate);

        user = await userRepository.CreateAsync(user, cancellationToken);

        DoctorProfile? doctorProfile = null;
        try
        {
            doctorProfile = DoctorProfile.Create(
                user.Id,
                request.Crm,
                request.CrmState,
                request.Specialty,
                request.Bio);
            doctorProfile = await doctorRepository.CreateAsync(doctorProfile, cancellationToken);
        }
        catch
        {
            await RollbackUserAsync(user.Id, cancellationToken);
            throw;
        }

        try
        {
            var token = AuthToken.Create(user.Id);
            await tokenRepository.CreateAsync(token, cancellationToken);
            return new AuthResponseDto(
                MapUserToDto(user),
                token.Token,
                MapDoctorProfileToDto(doctorProfile));
        }
        catch
        {
            await RollbackDoctorRegistrationAsync(user.Id, doctorProfile.Id, cancellationToken);
            throw;
        }
    }

    /// <summary>
    /// Remove o user criado (rollback quando falha criação de token no registro de paciente).
    /// </summary>
    private async Task RollbackUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        try
        {
            await userRepository.DeleteAsync(userId, cancellationToken);
        }
        catch
        {
            // Log could be added here; original exception is already thrown
        }
    }

    /// <summary>
    /// Remove doctor_profile e user (rollback quando falha criação de token no registro de médico).
    /// </summary>
    private async Task RollbackDoctorRegistrationAsync(Guid userId, Guid doctorProfileId, CancellationToken cancellationToken)
    {
        try
        {
            await doctorRepository.DeleteAsync(doctorProfileId, cancellationToken);
        }
        catch
        {
            // best effort
        }

        try
        {
            await userRepository.DeleteAsync(userId, cancellationToken);
        }
        catch
        {
            // best effort; original exception is already thrown
        }
    }

    /// <summary>
    /// Realiza login com e-mail e senha.
    /// </summary>
    public async Task<AuthResponseDto> LoginAsync(
        LoginRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByEmailAsync(request.Email, cancellationToken);
        
        if (user == null)
            throw new UnauthorizedAccessException("Invalid email or password");

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid email or password");

        // Create token
        var token = AuthToken.Create(user.Id);
        await tokenRepository.CreateAsync(token, cancellationToken);

        DoctorProfileDto? doctorProfile = null;
        if (user.IsDoctor())
        {
            var profile = await doctorRepository.GetByUserIdAsync(user.Id, cancellationToken);
            if (profile != null)
                doctorProfile = MapDoctorProfileToDto(profile);
        }

        return new AuthResponseDto(
            MapUserToDto(user),
            token.Token,
            doctorProfile);
    }

    /// <summary>
    /// Retorna os dados do usuário pelo ID.
    /// </summary>
    public async Task<UserDto> GetMeAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        
        if (user == null)
            throw new InvalidOperationException("User not found");

        return MapUserToDto(user);
    }

    /// <summary>
    /// Encerra a sessão invalidando o token.
    /// </summary>
    public async Task LogoutAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        await tokenRepository.DeleteByTokenAsync(token, cancellationToken);
    }

    /// <summary>
    /// Autentica via Google OAuth: valida o ID token do Google, busca ou cria o usuário e retorna o token do app.
    /// </summary>
    public async Task<AuthResponseDto> GoogleAuthAsync(
        GoogleAuthRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var clientId = googleAuthConfig.Value?.ClientId;
        if (string.IsNullOrWhiteSpace(clientId))
            throw new InvalidOperationException("Google:ClientId não configurado em appsettings.");

        GoogleJsonWebSignature.Payload payload;
        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings { Audience = new[] { clientId } };
            payload = await GoogleJsonWebSignature.ValidateAsync(request.GoogleToken, settings);
        }
        catch (InvalidJwtException)
        {
            throw new UnauthorizedAccessException("Token do Google inválido ou expirado.");
        }

        var email = payload.Email;
        if (string.IsNullOrWhiteSpace(email))
            throw new UnauthorizedAccessException("Token do Google não contém e-mail.");

        var name = payload.Name?.Trim() ?? payload.Email?.Split('@')[0] ?? "Usuário Google";

        var user = await userRepository.GetByEmailAsync(email, cancellationToken);
        if (user == null)
        {
            var role = string.Equals(request.Role, "doctor", StringComparison.OrdinalIgnoreCase)
                ? UserRole.Doctor
                : UserRole.Patient;
            var passwordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N"));
            user = User.CreateFromGoogleIdentity(name, email, passwordHash, role);
            user = await userRepository.CreateAsync(user, cancellationToken);
        }

        var token = AuthToken.Create(user.Id);
        await tokenRepository.CreateAsync(token, cancellationToken);

        DoctorProfileDto? doctorProfile = null;
        if (user.IsDoctor())
        {
            var profile = await doctorRepository.GetByUserIdAsync(user.Id, cancellationToken);
            if (profile != null)
                doctorProfile = MapDoctorProfileToDto(profile);
        }

        return new AuthResponseDto(
            MapUserToDto(user),
            token.Token,
            doctorProfile,
            user.ProfileComplete);
    }

    /// <summary>
    /// Conclui o cadastro (phone, CPF, birth date). Se for médico, exige também Crm, CrmState e Specialty e cria o DoctorProfile.
    /// </summary>
    public async Task<UserDto> CompleteProfileAsync(
        Guid userId,
        CompleteProfileRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new InvalidOperationException("User not found");

        if (user.ProfileComplete)
            throw new InvalidOperationException("Profile is already complete.");

        if (user.IsDoctor())
        {
            if (string.IsNullOrWhiteSpace(request.Crm) || string.IsNullOrWhiteSpace(request.CrmState) || string.IsNullOrWhiteSpace(request.Specialty))
                throw new InvalidOperationException("Doctor profile requires Crm, CrmState and Specialty.");
            if (request.Crm.Length > 20)
                throw new InvalidOperationException("CRM cannot exceed 20 characters.");
            if (request.CrmState.Trim().Length != 2)
                throw new InvalidOperationException("CrmState must be exactly 2 characters (state abbreviation).");
            if (request.Specialty.Length > 100)
                throw new InvalidOperationException("Specialty cannot exceed 100 characters.");
            if (!MedicalSpecialtyDisplay.IsValid(request.Specialty))
                throw new InvalidOperationException("Invalid specialty. Use GET /api/specialties for valid values.");

            user.SetContactInfo(request.Phone, request.Cpf, request.BirthDate, street: request.Street, number: request.Number, neighborhood: request.Neighborhood, complement: request.Complement, city: request.City, state: request.State, postalCode: request.PostalCode);
            user = await userRepository.UpdateAsync(user, cancellationToken);

            try
            {
                var profile = DoctorProfile.Create(user.Id, request.Crm, request.CrmState, request.Specialty, request.Bio);
                await doctorRepository.CreateAsync(profile, cancellationToken);
                user.MarkProfileComplete();
                user = await userRepository.UpdateAsync(user, cancellationToken);
            }
            catch
            {
                user.MarkProfileIncomplete();
                await userRepository.UpdateAsync(user, cancellationToken);
                throw;
            }
        }
        else
        {
            user.CompleteProfile(request.Phone, request.Cpf, request.BirthDate, request.Street, request.Number, request.Neighborhood, request.Complement, request.City, request.State, request.PostalCode);
            user = await userRepository.UpdateAsync(user, cancellationToken);
        }

        return MapUserToDto(user);
    }

    /// <summary>
    /// Cancela o cadastro e remove o usuário (rollback). Apenas para usuários com perfil incompleto (ex.: criados via Google que desistiram).
    /// Se for médico, remove antes o DoctorProfile (se existir) por causa de FK.
    /// </summary>
    public async Task CancelRegistrationAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new InvalidOperationException("User not found");

        if (user.ProfileComplete)
            throw new InvalidOperationException("Cannot cancel registration: profile is already complete. Use another flow to delete account.");

        if (user.IsDoctor())
        {
            var profile = await doctorRepository.GetByUserIdAsync(userId, cancellationToken);
            if (profile != null)
            {
                try { await doctorRepository.DeleteAsync(profile.Id, cancellationToken); }
                catch { /* best effort */ }
            }
        }

        await tokenRepository.DeleteByUserIdAsync(userId, cancellationToken);
        await userRepository.DeleteAsync(userId, cancellationToken);
    }

    /// <summary>
    /// Valida o token e retorna o ID do usuário e a role.
    /// </summary>
    public async Task<(Guid UserId, string Role)> ValidateTokenAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        var authToken = await tokenRepository.GetByTokenAsync(token, cancellationToken);
        
        if (authToken == null || authToken.IsExpired())
            throw new UnauthorizedAccessException("Invalid or expired token");

        var user = await userRepository.GetByIdAsync(authToken.UserId, cancellationToken);
        
        if (user == null)
            throw new UnauthorizedAccessException("User not found");

        return (user.Id, user.Role.ToString().ToLowerInvariant());
    }

    /// <summary>
    /// Envia e-mail com link para redefinição de senha. Sempre retorna sem erro para não revelar se o e-mail existe.
    /// </summary>
    public async Task ForgotPasswordAsync(string email, CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByEmailAsync(email?.Trim() ?? "", cancellationToken);
        if (user == null)
            return;

        await passwordResetTokenRepository.InvalidateByUserIdAsync(user.Id, cancellationToken);

        var resetToken = PasswordResetToken.Create(user.Id, expirationHours: 2);
        resetToken = await passwordResetTokenRepository.CreateAsync(resetToken, cancellationToken);

        var baseUrl = smtpConfig.Value.ResetPasswordBaseUrl?.TrimEnd('/') ?? "https://renovejasaude.com.br/recuperar-senha";
        var resetLink = $"{baseUrl}?token={Uri.EscapeDataString(resetToken.Token)}";

        await emailService.SendPasswordResetEmailAsync(user.Email.Value, user.Name, resetLink, cancellationToken);
    }

    /// <summary>
    /// Redefine a senha usando o token recebido por e-mail.
    /// </summary>
    public async Task ResetPasswordAsync(string token, string newPassword, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new ArgumentException("Token é obrigatório.");
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8)
            throw new ArgumentException("A nova senha deve ter no mínimo 8 caracteres.");

        // Token pode vir codificado da URL do e-mail (%3D%3D = ==); normaliza para o valor gravado no banco
        var rawToken = Uri.UnescapeDataString(token.Trim());
        var resetToken = await passwordResetTokenRepository.GetByTokenAsync(rawToken, cancellationToken);
        if (resetToken == null || !resetToken.IsValid())
            throw new UnauthorizedAccessException("Token inválido ou expirado. Solicite uma nova redefinição de senha.");

        var user = await userRepository.GetByIdAsync(resetToken.UserId, cancellationToken);
        if (user == null)
            throw new InvalidOperationException("Usuário não encontrado.");

        var newHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.UpdatePassword(newHash);
        await userRepository.UpdateAsync(user, cancellationToken);

        resetToken.MarkAsUsed();
        await passwordResetTokenRepository.UpdateAsync(resetToken, cancellationToken);
    }

    /// <summary>
    /// Altera a senha do usuário logado (requer senha atual).
    /// </summary>
    public async Task ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(currentPassword))
            throw new ArgumentException("A senha atual é obrigatória.");
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8)
            throw new ArgumentException("A nova senha deve ter no mínimo 8 caracteres.");

        var user = await userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new InvalidOperationException("Usuário não encontrado.");

        if (!BCrypt.Net.BCrypt.Verify(currentPassword, user.PasswordHash))
            throw new UnauthorizedAccessException("Senha atual incorreta.");

        var newHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.UpdatePassword(newHash);
        await userRepository.UpdateAsync(user, cancellationToken);
    }

    private static UserDto MapUserToDto(User user)
    {
        return new UserDto(
            user.Id,
            user.Name,
            user.Email,
            user.Phone?.Value,
            user.Cpf,
            user.BirthDate,
            user.AvatarUrl,
            user.Role.ToString().ToLowerInvariant(),
            user.CreatedAt,
            user.UpdatedAt,
            user.ProfileComplete,
            user.Street,
            user.Number,
            user.Neighborhood,
            user.Complement,
            user.City,
            user.State,
            user.PostalCode);
    }

    private static DoctorProfileDto MapDoctorProfileToDto(DoctorProfile profile)
    {
        return new DoctorProfileDto(
            profile.Id,
            profile.UserId,
            profile.Crm,
            profile.CrmState,
            profile.Specialty,
            profile.Bio,
            profile.Rating,
            profile.TotalConsultations,
            profile.Available,
            profile.CreatedAt);
    }
}
