namespace RenoveJa.Domain.Entities;

/// <summary>
/// Registra cada tentativa de criação de pagamento no Mercado Pago.
/// Permite rastrear payload enviado, resposta recebida e comparar teste vs produção.
/// </summary>
public class PaymentAttempt : Entity
{
    public Guid PaymentId { get; private set; }
    public Guid RequestId { get; private set; }
    public Guid UserId { get; private set; }
    public string CorrelationId { get; private set; }
    public string PaymentMethod { get; private set; }
    public decimal Amount { get; private set; }
    public string? MercadoPagoPaymentId { get; private set; }
    public string? MercadoPagoPreferenceId { get; private set; }
    public string? RequestUrl { get; private set; }
    public string? RequestPayload { get; private set; }
    public string? ResponsePayload { get; private set; }
    public int? ResponseStatusCode { get; private set; }
    public string? ResponseStatusDetail { get; private set; }
    public string? ResponseHeaders { get; private set; }
    public string? ErrorMessage { get; private set; }
    public bool IsSuccess { get; private set; }
    public DateTime UpdatedAt { get; private set; }

<<<<<<< HEAD
    private PaymentAttempt() : base()
    {
        CorrelationId = null!;
        PaymentMethod = null!;
    }
=======
    private PaymentAttempt() : base() { }
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55

    public PaymentAttempt(
        Guid paymentId,
        Guid requestId,
        Guid userId,
        string correlationId,
        string paymentMethod,
        decimal amount,
        string? requestUrl = null,
        string? requestPayload = null)
        : base()
    {
        PaymentId = paymentId;
        RequestId = requestId;
        UserId = userId;
        CorrelationId = correlationId;
        PaymentMethod = paymentMethod;
        Amount = amount;
        RequestUrl = requestUrl;
        RequestPayload = requestPayload;
        IsSuccess = false;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RecordSuccess(
        string? mercadoPagoPaymentId,
        string? mercadoPagoPreferenceId,
        string? responsePayload,
        int? responseStatusCode,
        string? responseStatusDetail,
        string? responseHeaders)
    {
        MercadoPagoPaymentId = mercadoPagoPaymentId;
        MercadoPagoPreferenceId = mercadoPagoPreferenceId;
        ResponsePayload = responsePayload;
        ResponseStatusCode = responseStatusCode;
        ResponseStatusDetail = responseStatusDetail;
        ResponseHeaders = responseHeaders;
        IsSuccess = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RecordFailure(
        string? responsePayload,
        int? responseStatusCode,
        string? errorMessage,
        string? responseHeaders)
    {
        ResponsePayload = responsePayload;
        ResponseStatusCode = responseStatusCode;
        ErrorMessage = errorMessage;
        ResponseHeaders = responseHeaders;
        IsSuccess = false;
        UpdatedAt = DateTime.UtcNow;
    }

    public static PaymentAttempt Reconstitute(
        Guid id,
        Guid paymentId,
        Guid requestId,
        Guid userId,
        string correlationId,
        string paymentMethod,
        decimal amount,
        string? mercadoPagoPaymentId,
        string? mercadoPagoPreferenceId,
        string? requestUrl,
        string? requestPayload,
        string? responsePayload,
        int? responseStatusCode,
        string? responseStatusDetail,
        string? responseHeaders,
        string? errorMessage,
        bool isSuccess,
        DateTime createdAt,
        DateTime updatedAt)
    {
        var attempt = new PaymentAttempt(
            paymentId,
            requestId,
            userId,
            correlationId,
            paymentMethod,
            amount,
            requestUrl,
            requestPayload);
<<<<<<< HEAD

=======
        
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
        attempt.Id = id;
        attempt.CreatedAt = createdAt;
        attempt.MercadoPagoPaymentId = mercadoPagoPaymentId;
        attempt.MercadoPagoPreferenceId = mercadoPagoPreferenceId;
        attempt.ResponsePayload = responsePayload;
        attempt.ResponseStatusCode = responseStatusCode;
        attempt.ResponseStatusDetail = responseStatusDetail;
        attempt.ResponseHeaders = responseHeaders;
        attempt.ErrorMessage = errorMessage;
        attempt.IsSuccess = isSuccess;
        attempt.UpdatedAt = updatedAt;
<<<<<<< HEAD

=======
        
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
        return attempt;
    }
}
