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
        RuleFor(x => x.ExamType)
            .NotEmpty().WithMessage("Exam type is required");

        RuleFor(x => x.Exams)
            .NotEmpty().WithMessage("At least one exam is required")
            .Must(x => x != null && x.Count > 0).WithMessage("Exams list cannot be empty");
    }
}
