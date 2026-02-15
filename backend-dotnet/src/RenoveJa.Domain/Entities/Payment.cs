using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;
using RenoveJa.Domain.ValueObjects;

namespace RenoveJa.Domain.Entities;

public class Payment : Entity
{
    public Guid RequestId { get; private set; }
    public Guid UserId { get; private set; }
    public Money Amount { get; private set; }
    public PaymentStatus Status { get; private set; }
    public string PaymentMethod { get; private set; }
    public string? ExternalId { get; private set; }
    public string? PixQrCode { get; private set; }
    public string? PixQrCodeBase64 { get; private set; }
    public string? PixCopyPaste { get; private set; }
    public DateTime? PaidAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private Payment() : base() { }

    private Payment(
        Guid id,
        Guid requestId,
        Guid userId,
        Money amount,
        PaymentStatus status,
        string paymentMethod,
        DateTime? createdAt = null,
        DateTime? updatedAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        RequestId = requestId;
        UserId = userId;
        Amount = amount;
        Status = status;
        PaymentMethod = paymentMethod;
        UpdatedAt = updatedAt ?? DateTime.UtcNow;
    }

    public static Payment CreatePixPayment(
        Guid requestId,
        Guid userId,
        decimal amount)
    {
        return CreateWithMethod(requestId, userId, amount, "pix");
    }

    /// <summary>
    /// Cria um pagamento com cartão (crédito ou débito). ExternalId é definido depois via SetExternalId.
    /// </summary>
    public static Payment CreateCardPayment(
        Guid requestId,
        Guid userId,
        decimal amount,
        string cardPaymentMethod)
    {
        if (cardPaymentMethod != "credit_card" && cardPaymentMethod != "debit_card")
            throw new DomainException("Método de cartão deve ser 'credit_card' ou 'debit_card'");
        return CreateWithMethod(requestId, userId, amount, cardPaymentMethod);
    }

    private static Payment CreateWithMethod(
        Guid requestId,
        Guid userId,
        decimal amount,
        string paymentMethod)
    {
        if (requestId == Guid.Empty)
            throw new DomainException("Request ID is required");
        if (userId == Guid.Empty)
            throw new DomainException("User ID is required");
        var money = Money.Create(amount);
        return new Payment(
            Guid.NewGuid(),
            requestId,
            userId,
            money,
            PaymentStatus.Pending,
            paymentMethod);
    }

    public static Payment Reconstitute(
        Guid id,
        Guid requestId,
        Guid userId,
        decimal amount,
        string status,
        string paymentMethod,
        string? externalId,
        string? pixQrCode,
        string? pixQrCodeBase64,
        string? pixCopyPaste,
        DateTime? paidAt,
        DateTime createdAt,
        DateTime updatedAt)
    {
        var payment = new Payment(
            id,
            requestId,
            userId,
            Money.Create(amount),
            Enum.Parse<PaymentStatus>(status, true),
            paymentMethod,
            createdAt,
            updatedAt);

        payment.ExternalId = externalId;
        payment.PixQrCode = pixQrCode;
        payment.PixQrCodeBase64 = pixQrCodeBase64;
        payment.PixCopyPaste = pixCopyPaste;
        payment.PaidAt = paidAt;

        return payment;
    }

    public void SetPixData(
        string externalId,
        string qrCode,
        string qrCodeBase64,
        string copyPaste)
    {
        ExternalId = externalId;
        PixQrCode = qrCode;
        PixQrCodeBase64 = qrCodeBase64;
        PixCopyPaste = copyPaste;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Define o ID externo (ex.: Mercado Pago) para pagamentos com cartão (sem dados PIX).
    /// </summary>
    public void SetExternalId(string externalId)
    {
        ExternalId = externalId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Approve()
    {
        if (Status != PaymentStatus.Pending)
            throw new DomainException("Only pending payments can be approved");

        Status = PaymentStatus.Approved;
        PaidAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reject()
    {
        if (Status != PaymentStatus.Pending)
            throw new DomainException("Only pending payments can be rejected");

        Status = PaymentStatus.Rejected;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Refund()
    {
        if (Status != PaymentStatus.Approved)
            throw new DomainException("Only approved payments can be refunded");

        Status = PaymentStatus.Refunded;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool IsPending() => Status == PaymentStatus.Pending;
    public bool IsApproved() => Status == PaymentStatus.Approved;
}
