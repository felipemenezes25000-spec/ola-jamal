using FluentValidation;
using RenoveJa.Application.DTOs.Requests;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para aprovação de solicitação (preço).
/// </summary>
public class ApproveRequestValidator : AbstractValidator<ApproveRequestDto>
{
    public ApproveRequestValidator()
    {
        RuleFor(x => x.Price)
            .GreaterThan(0).WithMessage("Price must be greater than zero");
    }
}
