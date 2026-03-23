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
            .NotEmpty().WithMessage("Informe o e-mail.")
            .EmailAddress().WithMessage("E-mail inválido.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Informe a senha.");
    }
}
