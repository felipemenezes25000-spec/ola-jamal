using FluentValidation;
using RenoveJa.Application.DTOs.Chat;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Validador para envio de mensagem de chat (texto).
/// </summary>
public class SendMessageRequestValidator : AbstractValidator<SendMessageRequestDto>
{
    public SendMessageRequestValidator()
    {
        RuleFor(x => x.Message)
            .NotEmpty().WithMessage("Message cannot be empty")
            .MaximumLength(1000).WithMessage("Message cannot exceed 1000 characters");
    }
}
