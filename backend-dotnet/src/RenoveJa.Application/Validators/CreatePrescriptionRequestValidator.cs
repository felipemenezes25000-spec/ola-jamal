using FluentValidation;
using RenoveJa.Application.DTOs.Requests;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para solicitação de receita (tipo, medicamentos).
/// </summary>
public class CreatePrescriptionRequestValidator : AbstractValidator<CreatePrescriptionRequestDto>
{
    public CreatePrescriptionRequestValidator()
    {
        RuleFor(x => x.PrescriptionType)
            .NotEmpty().WithMessage("Tipo da receita é obrigatório (simples ou controlado).")
            .Must(x => new[] { "simples", "controlado", "simple", "controlled" }.Contains(x?.Trim().ToLowerInvariant()))
            .WithMessage("Tipo inválido. Use: simples ou controlado. Receita azul ainda não está liberada.");

        // Medications é opcional (pode ser null ou lista vazia).
    }
}
