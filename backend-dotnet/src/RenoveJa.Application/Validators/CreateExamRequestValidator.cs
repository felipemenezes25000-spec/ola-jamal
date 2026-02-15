using FluentValidation;
using RenoveJa.Application.DTOs.Requests;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para solicitação de exame (tipo, exames).
/// </summary>
public class CreateExamRequestValidator : AbstractValidator<CreateExamRequestDto>
{
    public CreateExamRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => (x.Exams != null && x.Exams.Count > 0) ||
                       (x.ExamImages != null && x.ExamImages.Count > 0) ||
                       !string.IsNullOrWhiteSpace(x.Symptoms))
            .WithMessage("Informe pelo menos um exame, imagens do pedido ou sintomas/indicação.");
    }
}
