using System.Text.RegularExpressions;
using FluentValidation;
using RenoveJa.Application.DTOs.Auth;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para registro de paciente (nome, e-mail, senha, telefone, CPF).
/// </summary>
public class RegisterRequestValidator : AbstractValidator<RegisterRequestDto>
{
    private static readonly Regex EmailRegex = new(
        @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase
    );

    public RegisterRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .MaximumLength(200).WithMessage("Name cannot exceed 200 characters")
            .Must(name => name != null && name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).Length >= 2)
            .WithMessage("Name must contain at least two words");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .Matches(EmailRegex)
            .WithMessage("Invalid email format");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Phone is required")
            .Matches(@"^\d{10,11}$")
            .WithMessage("Phone must contain only numbers (10 or 11 digits)");

        RuleFor(x => x.Cpf)
            .NotEmpty().WithMessage("CPF is required")
            .Matches(@"^\d{11}$")
            .WithMessage("CPF must contain only numbers (11 digits)");
    }
}
