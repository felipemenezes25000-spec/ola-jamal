using FluentValidation;
using RenoveJa.Application.DTOs.Payments;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para criação de pagamento (requestId, valor).
/// </summary>
public class CreatePaymentRequestValidator : AbstractValidator<CreatePaymentRequestDto>
{
    public CreatePaymentRequestValidator()
    {
        RuleFor(x => x.RequestId)
            .NotEmpty().WithMessage("Request ID is required");

        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Amount must be greater than zero");
    }
}
