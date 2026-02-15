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
            .NotEmpty().WithMessage("Tipo da receita é obrigatório (simples, controlado ou azul).")
            .Must(x => new[] { "simples", "controlado", "azul", "simple", "controlled", "blue" }.Contains(x?.Trim().ToLowerInvariant()))
            .WithMessage("Tipo inválido. Use: simples, controlado ou azul.");

        // Medications é opcional (pode ser null ou lista vazia).
    }
}
