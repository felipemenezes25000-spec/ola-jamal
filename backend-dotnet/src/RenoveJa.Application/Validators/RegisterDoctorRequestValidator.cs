using System.Text.RegularExpressions;
using FluentValidation;
using RenoveJa.Application.DTOs.Auth;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para registro de médico (nome, e-mail, senha, telefone, CRM, especialidade).
/// </summary>
public class RegisterDoctorRequestValidator : AbstractValidator<RegisterDoctorRequestDto>
{
    private static readonly Regex EmailRegex = new(
        @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase
    );

    public RegisterDoctorRequestValidator()
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

        RuleFor(x => x.Crm)
            .NotEmpty().WithMessage("CRM is required")
            .MaximumLength(20).WithMessage("CRM cannot exceed 20 characters");

        RuleFor(x => x.CrmState)
            .NotEmpty().WithMessage("CRM State is required")
            .Length(2).WithMessage("CRM State must be exactly 2 characters (state abbreviation)");

        RuleFor(x => x.Specialty)
            .NotEmpty().WithMessage("Specialty is required")
            .Must(MedicalSpecialtyDisplay.IsValid)
            .WithMessage("Specialty must be one of the available specialties. Use GET /api/specialties to list valid values.");

        RuleFor(x => x.Bio)
            .MaximumLength(5000)
            .When(x => !string.IsNullOrEmpty(x.Bio))
            .WithMessage("Bio cannot exceed 5000 characters");
    }
}
