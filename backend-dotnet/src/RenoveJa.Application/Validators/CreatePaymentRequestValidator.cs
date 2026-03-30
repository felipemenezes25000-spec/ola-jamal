using FluentValidation;
using RenoveJa.Application.DTOs.Payments;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para criação de pagamento. Apenas requestId é obrigatório; valor vem da solicitação.
/// </summary>
public class CreatePaymentRequestValidator : AbstractValidator<CreatePaymentRequestDto>
{
    private static readonly string[] CardMethods = ["credit_card", "debit_card"];

    public CreatePaymentRequestValidator()
    {
        RuleFor(x => x.RequestId)
            .NotEmpty().WithMessage("RequestId é obrigatório");

        RuleFor(x => x.PaymentMethod)
            .Must(m => string.IsNullOrEmpty(m) || m == "pix" || m == "credit_card" || m == "debit_card")
            .WithMessage("PaymentMethod deve ser 'pix', 'credit_card' ou 'debit_card'");

        When(x => CardMethods.Contains(x.PaymentMethod ?? ""), () =>
        {
            RuleFor(x => x.Token)
                .NotEmpty().WithMessage("Token do cartão é obrigatório para pagamento com cartão (obtido via SDK do Mercado Pago).");
            RuleFor(x => x.PaymentMethodId)
                .NotEmpty().WithMessage("PaymentMethodId é obrigatório para cartão (ex: 'visa', 'master').");
            RuleFor(x => x.Installments)
                .GreaterThanOrEqualTo(1).When(x => x.Installments.HasValue)
                .WithMessage("Installments deve ser pelo menos 1.");
        });
    }
}
