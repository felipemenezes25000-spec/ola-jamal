using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Application.Exceptions;

public class PaymentDomainException : DomainException
{
    public string Code { get; }
    public string UserMessagePtBr { get; }

    public PaymentDomainException(string code, string userMessagePtBr, string? technicalMessage = null)
        : base(technicalMessage ?? userMessagePtBr)
    {
        Code = code;
        UserMessagePtBr = userMessagePtBr;
    }
}

