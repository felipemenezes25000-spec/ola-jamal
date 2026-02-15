using FluentValidation;
using RenoveJa.Application.DTOs.Requests;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para solicitação de consulta (sintomas).
/// </summary>
public class CreateConsultationRequestValidator : AbstractValidator<CreateConsultationRequestDto>
{
    public CreateConsultationRequestValidator()
    {
        RuleFor(x => x.Symptoms)
            .NotEmpty().WithMessage("Symptoms are required for consultation")
            .MinimumLength(10).WithMessage("Please provide more details about your symptoms");
    }
}
