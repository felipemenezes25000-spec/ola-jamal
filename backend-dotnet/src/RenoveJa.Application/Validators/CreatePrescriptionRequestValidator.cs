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
            .NotEmpty().WithMessage("Prescription type is required")
            .Must(x => new[] { "simple", "controlled", "blue" }.Contains(x?.ToLower()))
            .WithMessage("Invalid prescription type");

        RuleFor(x => x.Medications)
            .NotEmpty().WithMessage("At least one medication is required")
            .Must(x => x != null && x.Count > 0).WithMessage("Medications list cannot be empty");
    }
}
