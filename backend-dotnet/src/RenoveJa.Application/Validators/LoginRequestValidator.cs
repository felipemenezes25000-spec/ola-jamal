using FluentValidation;
using RenoveJa.Application.DTOs.Auth;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para login (e-mail e senha).
/// </summary>
public class LoginRequestValidator : AbstractValidator<LoginRequestDto>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Invalid email format");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required");
    }
}
