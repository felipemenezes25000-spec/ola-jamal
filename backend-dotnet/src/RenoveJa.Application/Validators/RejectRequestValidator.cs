using FluentValidation;
using RenoveJa.Application.DTOs.Requests;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para rejeição de solicitação (motivo).
/// </summary>
public class RejectRequestValidator : AbstractValidator<RejectRequestDto>
{
    public RejectRequestValidator()
    {
        RuleFor(x => x.RejectionReason)
            .NotEmpty().WithMessage("Rejection reason is required")
            .MinimumLength(10).WithMessage("Please provide a detailed rejection reason");
    }
}
