using System.Text.RegularExpressions;
using FluentValidation;
using RenoveJa.Application.DTOs.Auth;
using RenoveJa.Application.Helpers;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para registro de médico (nome, e-mail, senha, confirmação, telefone, CPF, CRM).
/// </summary>
public class RegisterDoctorRequestValidator : AbstractValidator<RegisterDoctorRequestDto>
{
    private static readonly Regex EmailRegex = new(
        @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase
    );

    private static readonly Regex PasswordSecureRegex = new(
        @"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$",
        RegexOptions.Compiled
    );

    // CRM: geralmente 4-7 dígitos numéricos
    private static readonly Regex CrmRegex = new(
        @"^\d{4,7}$",
        RegexOptions.Compiled
    );

    public RegisterDoctorRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Nome é obrigatório.")
            .MaximumLength(200).WithMessage("Nome não pode exceder 200 caracteres.")
            .Must(name => name != null && !Regex.IsMatch(name, @"\d"))
            .WithMessage("Nome não deve conter números.")
            .Must(name => name != null && name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).Length >= 2)
            .WithMessage("Nome deve ter pelo menos duas palavras (ex.: nome e sobrenome).");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("E-mail é obrigatório.")
            .Matches(EmailRegex)
            .WithMessage("Informe um e-mail válido.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Senha é obrigatória.")
            .MinimumLength(8).WithMessage("Senha deve ter no mínimo 8 caracteres.")
            .Matches(PasswordSecureRegex)
            .WithMessage("Senha deve conter pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial.");

        RuleFor(x => x.ConfirmPassword)
            .NotEmpty().WithMessage("Confirmação de senha é obrigatória.")
            .Equal(x => x.Password)
            .WithMessage("As senhas não coincidem.");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Telefone é obrigatório.")
            .Matches(@"^\d{10,11}$")
            .WithMessage("Telefone deve ter 10 ou 11 dígitos numéricos.");

        RuleFor(x => x.Cpf)
            .NotEmpty().WithMessage("CPF é obrigatório.")
            .Must(c => c != null && c.Length >= 11 && CpfHelper.IsValid(c))
            .WithMessage("CPF inválido. Verifique os dígitos informados.");

        RuleFor(x => x.Crm)
            .NotEmpty().WithMessage("CRM é obrigatório.")
            .Matches(CrmRegex)
            .WithMessage("CRM deve conter de 4 a 7 dígitos numéricos.");

        RuleFor(x => x.CrmState)
            .NotEmpty().WithMessage("Estado do CRM é obrigatório.")
            .Length(2).WithMessage("Informe a sigla do estado com 2 letras (ex.: SP).");

        RuleFor(x => x.Specialty)
            .NotEmpty().WithMessage("Especialidade é obrigatória.")
            .Must(MedicalSpecialtyDisplay.IsValid)
            .WithMessage("Especialidade inválida. Use GET /api/specialties para ver os valores aceitos.");

        RuleFor(x => x.BirthDate)
            .NotNull().WithMessage("Data de nascimento é obrigatória.")
            .Must(d => d.HasValue && d.Value.Date < DateTime.UtcNow.Date)
            .WithMessage("Data de nascimento deve ser uma data válida no passado.");

        RuleFor(x => x.Bio)
            .MaximumLength(5000)
            .When(x => !string.IsNullOrEmpty(x.Bio))
            .WithMessage("Bio não pode exceder 5000 caracteres.");

        // Endereço obrigatório para médico (mesmo que paciente)
        RuleFor(x => x.Street)
            .NotEmpty().WithMessage("Rua é obrigatória.");
        RuleFor(x => x.Number)
            .NotEmpty().WithMessage("Número é obrigatório.");
        RuleFor(x => x.Neighborhood)
            .NotEmpty().WithMessage("Bairro é obrigatório.");
        RuleFor(x => x.City)
            .NotEmpty().WithMessage("Cidade é obrigatória.");
        RuleFor(x => x.State)
            .NotEmpty().WithMessage("UF é obrigatória.")
            .Length(2).WithMessage("Informe a sigla com 2 letras (ex.: SP).");
        RuleFor(x => x.PostalCode)
            .MaximumLength(10)
            .When(x => !string.IsNullOrEmpty(x.PostalCode))
            .WithMessage("CEP não pode exceder 10 caracteres.");
    }
}
