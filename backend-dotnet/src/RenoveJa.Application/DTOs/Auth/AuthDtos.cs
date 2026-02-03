namespace RenoveJa.Application.DTOs.Auth;

public record RegisterRequestDto(
    string Name,
    string Email,
    string Password,
    string? Phone = null,
    string? Cpf = null,
    DateTime? BirthDate = null
);

public record RegisterDoctorRequestDto(
    string Name,
    string Email,
    string Password,
    string Phone,
    string Crm,
    string CrmState,
    string Specialty,
    string? Cpf = null,
    DateTime? BirthDate = null,
    string? Bio = null
);

public record LoginRequestDto(
    string Email,
    string Password
);

public record GoogleAuthRequestDto(
    string GoogleToken
);

public record AuthResponseDto(
    UserDto User,
    string Token,
    DoctorProfileDto? DoctorProfile = null
);

public record UserDto(
    Guid Id,
    string Name,
    string Email,
    string? Phone,
    string? Cpf,
    DateTime? BirthDate,
    string? AvatarUrl,
    string Role,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record DoctorProfileDto(
    Guid Id,
    Guid UserId,
    string Crm,
    string CrmState,
    string Specialty,
    string? Bio,
    decimal Rating,
    int TotalConsultations,
    bool Available,
    DateTime CreatedAt
);
