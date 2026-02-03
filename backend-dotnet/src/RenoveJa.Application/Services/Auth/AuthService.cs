using BCrypt.Net;
using RenoveJa.Application.DTOs.Auth;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Auth;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IDoctorRepository _doctorRepository;
    private readonly IAuthTokenRepository _tokenRepository;

    public AuthService(
        IUserRepository userRepository,
        IDoctorRepository doctorRepository,
        IAuthTokenRepository tokenRepository)
    {
        _userRepository = userRepository;
        _doctorRepository = doctorRepository;
        _tokenRepository = tokenRepository;
    }

    public async Task<AuthResponseDto> RegisterAsync(
        RegisterRequestDto request,
        CancellationToken cancellationToken = default)
    {
        // Check if email already exists
        if (await _userRepository.ExistsByEmailAsync(request.Email, cancellationToken))
            throw new InvalidOperationException("Email already registered");

        // Hash password
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        // Create user
        var user = User.CreatePatient(
            request.Name,
            request.Email,
            passwordHash,
            request.Phone,
            request.Cpf,
            request.BirthDate);

        user = await _userRepository.CreateAsync(user, cancellationToken);

        // Create token
        var token = AuthToken.Create(user.Id);
        await _tokenRepository.CreateAsync(token, cancellationToken);

        return new AuthResponseDto(
            MapUserToDto(user),
            token.Token);
    }

    public async Task<AuthResponseDto> RegisterDoctorAsync(
        RegisterDoctorRequestDto request,
        CancellationToken cancellationToken = default)
    {
        // Check if email already exists
        if (await _userRepository.ExistsByEmailAsync(request.Email, cancellationToken))
            throw new InvalidOperationException("Email already registered");

        // Hash password
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        // Create user
        var user = User.CreateDoctor(
            request.Name,
            request.Email,
            passwordHash,
            request.Phone,
            request.Cpf,
            request.BirthDate);

        user = await _userRepository.CreateAsync(user, cancellationToken);

        // Create doctor profile
        var doctorProfile = DoctorProfile.Create(
            user.Id,
            request.Crm,
            request.CrmState,
            request.Specialty,
            request.Bio);

        doctorProfile = await _doctorRepository.CreateAsync(doctorProfile, cancellationToken);

        // Create token
        var token = AuthToken.Create(user.Id);
        await _tokenRepository.CreateAsync(token, cancellationToken);

        return new AuthResponseDto(
            MapUserToDto(user),
            token.Token,
            MapDoctorProfileToDto(doctorProfile));
    }

    public async Task<AuthResponseDto> LoginAsync(
        LoginRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);
        
        if (user == null)
            throw new UnauthorizedAccessException("Invalid email or password");

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid email or password");

        // Create token
        var token = AuthToken.Create(user.Id);
        await _tokenRepository.CreateAsync(token, cancellationToken);

        DoctorProfileDto? doctorProfile = null;
        if (user.IsDoctor())
        {
            var profile = await _doctorRepository.GetByUserIdAsync(user.Id, cancellationToken);
            if (profile != null)
                doctorProfile = MapDoctorProfileToDto(profile);
        }

        return new AuthResponseDto(
            MapUserToDto(user),
            token.Token,
            doctorProfile);
    }

    public async Task<UserDto> GetMeAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken);
        
        if (user == null)
            throw new InvalidOperationException("User not found");

        return MapUserToDto(user);
    }

    public async Task LogoutAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        await _tokenRepository.DeleteByTokenAsync(token, cancellationToken);
    }

    public async Task<AuthResponseDto> GoogleAuthAsync(
        GoogleAuthRequestDto request,
        CancellationToken cancellationToken = default)
    {
        // TODO: Implement Google OAuth validation
        // This requires Google.Apis.Auth library to verify the token
        // For now, throw not implemented
        throw new NotImplementedException("Google authentication not yet implemented");
    }

    public async Task<(Guid UserId, string Role)> ValidateTokenAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        var authToken = await _tokenRepository.GetByTokenAsync(token, cancellationToken);
        
        if (authToken == null || authToken.IsExpired())
            throw new UnauthorizedAccessException("Invalid or expired token");

        var user = await _userRepository.GetByIdAsync(authToken.UserId, cancellationToken);
        
        if (user == null)
            throw new UnauthorizedAccessException("User not found");

        return (user.Id, user.Role.ToString().ToLowerInvariant());
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
            user.UpdatedAt);
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
