using FluentValidation;
using RenoveJa.Application.DTOs.Auth;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para conclusão de cadastro (phone, CPF; para médico também Crm, CrmState, Specialty).
/// </summary>
public class CompleteProfileRequestValidator : AbstractValidator<CompleteProfileRequestDto>
{
    public CompleteProfileRequestValidator()
    {
        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Phone is required")
            .Matches(@"^\d{10,11}$")
            .WithMessage("Phone must contain only numbers (10 or 11 digits)");

        RuleFor(x => x.Cpf)
            .NotEmpty().WithMessage("CPF is required")
            .Matches(@"^\d{11}$")
            .WithMessage("CPF must contain only numbers (11 digits)");

        RuleFor(x => x.Crm)
            .MaximumLength(20)
            .When(x => !string.IsNullOrEmpty(x.Crm))
            .WithMessage("CRM cannot exceed 20 characters");

        RuleFor(x => x.CrmState)
            .Length(2)
            .When(x => !string.IsNullOrEmpty(x.CrmState))
            .WithMessage("CrmState must be exactly 2 characters (state abbreviation)");

        RuleFor(x => x.Specialty)
            .MaximumLength(100)
            .When(x => !string.IsNullOrEmpty(x.Specialty))
            .WithMessage("Specialty cannot exceed 100 characters");
        RuleFor(x => x.Specialty)
            .Must(MedicalSpecialtyDisplay.IsValid)
            .When(x => !string.IsNullOrEmpty(x.Specialty))
            .WithMessage("Invalid specialty. Use GET /api/specialties for valid values.");

        RuleFor(x => x.Bio)
            .MaximumLength(5000)
            .When(x => !string.IsNullOrEmpty(x.Bio))
            .WithMessage("Bio cannot exceed 5000 characters");

        RuleFor(x => x.State)
            .Length(2)
            .When(x => !string.IsNullOrEmpty(x.State))
            .WithMessage("State (UF) must be exactly 2 characters");

        RuleFor(x => x.Number)
            .MaximumLength(20)
            .When(x => !string.IsNullOrEmpty(x.Number))
            .WithMessage("Number cannot exceed 20 characters");

        RuleFor(x => x.PostalCode)
            .MaximumLength(10)
            .When(x => !string.IsNullOrEmpty(x.PostalCode))
            .WithMessage("PostalCode cannot exceed 10 characters");

        // Endereço obrigatório para médico ao completar perfil (quando Crm/Specialty preenchidos)
        RuleFor(x => x.Street)
            .NotEmpty().WithMessage("Rua é obrigatória.")
            .When(x => !string.IsNullOrEmpty(x.Crm));
        RuleFor(x => x.Number)
            .NotEmpty().WithMessage("Número é obrigatório.")
            .When(x => !string.IsNullOrEmpty(x.Crm));
        RuleFor(x => x.Neighborhood)
            .NotEmpty().WithMessage("Bairro é obrigatório.")
            .When(x => !string.IsNullOrEmpty(x.Crm));
        RuleFor(x => x.City)
            .NotEmpty().WithMessage("Cidade é obrigatória.")
            .When(x => !string.IsNullOrEmpty(x.Crm));
        RuleFor(x => x.State)
            .NotEmpty().WithMessage("UF é obrigatória.")
            .Length(2).WithMessage("UF deve ter 2 caracteres.")
            .When(x => !string.IsNullOrEmpty(x.Crm));
    }
}
