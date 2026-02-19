using System.Text.RegularExpressions;
using FluentValidation;
using RenoveJa.Application.DTOs.Auth;
using RenoveJa.Application.Helpers;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para registro de paciente (nome, e-mail, senha, confirmação, telefone, CPF).
/// </summary>
public class RegisterRequestValidator : AbstractValidator<RegisterRequestDto>
{
    private static readonly Regex EmailRegex = new(
        @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase
    );

    // Senha segura: min 8 caracteres, pelo menos 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial
    private static readonly Regex PasswordSecureRegex = new(
        @"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$",
        RegexOptions.Compiled
    );

    public RegisterRequestValidator()
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
    }
}
