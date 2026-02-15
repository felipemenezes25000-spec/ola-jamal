using FluentValidation;
using RenoveJa.Application.DTOs.Requests;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para aprovação de solicitação. O preço vem da tabela product_prices, não do body.
/// </summary>
public class ApproveRequestValidator : AbstractValidator<ApproveRequestDto>
{
    public ApproveRequestValidator()
    {
        // Notes é opcional. Não há mais Price no DTO.
    }
}
