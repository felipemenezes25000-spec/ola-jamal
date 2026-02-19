namespace RenoveJa.Application.DTOs.Auth;

/// <summary>DTO de registro de paciente.</summary>
public record RegisterRequestDto(
    string Name,
    string Email,
    string Password,
    string ConfirmPassword,
    string Phone,
    string Cpf,
    DateTime? BirthDate = null,
    string? Street = null,
    string? Number = null,
    string? Neighborhood = null,
    string? Complement = null,
    string? City = null,
    string? State = null,
    string? PostalCode = null
);

/// <summary>DTO de registro de médico.</summary>
public record RegisterDoctorRequestDto(
    string Name,
    string Email,
    string Password,
    string ConfirmPassword,
    string Phone,
    string Cpf,
    string Crm,
    string CrmState,
    string Specialty,
    DateTime? BirthDate = null,
    string? Bio = null
);

public record LoginRequestDto(
    string Email,
    string Password
);

/// <summary>Request para "Esqueci minha senha".</summary>
public record ForgotPasswordRequestDto(string Email);

/// <summary>Request para redefinir senha com o token recebido por e-mail.</summary>
public record ResetPasswordRequestDto(string Token, string NewPassword);

/// <summary>Request para alterar senha (usuário logado).</summary>
public record ChangePasswordRequestDto(string CurrentPassword, string NewPassword);

/// <summary>DTO de autenticação via Google. Role opcional: "patient" (padrão) ou "doctor".</summary>
public record GoogleAuthRequestDto(
    string GoogleToken,
    string? Role = null
);

/// <summary>Resposta de autenticação (usuário, token e perfil médico opcional).</summary>
public record AuthResponseDto(
    UserDto User,
    string Token,
    DoctorProfileDto? DoctorProfile = null,
    bool ProfileComplete = true
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
    DateTime UpdatedAt,
    bool ProfileComplete = true,
    string? Street = null,
    string? Number = null,
    string? Neighborhood = null,
    string? Complement = null,
    string? City = null,
    string? State = null,
    string? PostalCode = null
);

/// <summary>DTO para concluir cadastro (usuários criados via Google). Para médico, preencher também Crm, CrmState e Specialty.</summary>
public record CompleteProfileRequestDto(
    string Phone,
    string Cpf,
    DateTime? BirthDate = null,
    string? Crm = null,
    string? CrmState = null,
    string? Specialty = null,
    string? Bio = null,
    string? Street = null,
    string? Number = null,
    string? Neighborhood = null,
    string? Complement = null,
    string? City = null,
    string? State = null,
    string? PostalCode = null
);

/// <summary>DTO de perfil de médico.</summary>
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
