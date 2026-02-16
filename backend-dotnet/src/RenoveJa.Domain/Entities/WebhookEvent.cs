namespace RenoveJa.Domain.Entities;

/// <summary>
/// Registra cada evento de webhook recebido do Mercado Pago.
/// Permite rastrear payload bruto, processamento, idempotência e comparar teste vs produção.
/// </summary>
public class WebhookEvent : Entity
{
    public string? CorrelationId { get; private set; }
    public string? MercadoPagoPaymentId { get; private set; }
    public string? MercadoPagoRequestId { get; private set; }
    public string? WebhookType { get; private set; }
    public string? WebhookAction { get; private set; }
    public string? RawPayload { get; private set; }
    public string? ProcessedPayload { get; private set; }
    public string? QueryString { get; private set; }
    public string? RequestHeaders { get; private set; }
    public string? ContentType { get; private set; }
    public int? ContentLength { get; private set; }
    public string? SourceIp { get; private set; }
    public bool IsDuplicate { get; private set; }
    public bool IsProcessed { get; private set; }
    public string? ProcessingError { get; private set; }
    public string? PaymentStatus { get; private set; }
    public string? PaymentStatusDetail { get; private set; }
    public DateTime? ProcessedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private WebhookEvent() : base() { }

    public WebhookEvent(
        string? correlationId,
        string? mercadoPagoPaymentId,
        string? mercadoPagoRequestId,
        string? webhookType,
        string? webhookAction,
        string? rawPayload,
        string? queryString,
        string? requestHeaders,
        string? contentType,
        int? contentLength,
        string? sourceIp)
        : base()
    {
        CorrelationId = correlationId;
        MercadoPagoPaymentId = mercadoPagoPaymentId;
        MercadoPagoRequestId = mercadoPagoRequestId;
        WebhookType = webhookType;
        WebhookAction = webhookAction;
        RawPayload = rawPayload;
        QueryString = queryString;
        RequestHeaders = requestHeaders;
        ContentType = contentType;
        ContentLength = contentLength;
        SourceIp = sourceIp;
        IsDuplicate = false;
        IsProcessed = false;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkAsDuplicate()
    {
        IsDuplicate = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkAsProcessed(
        string? processedPayload,
        string? paymentStatus,
        string? paymentStatusDetail)
    {
        IsProcessed = true;
        ProcessedPayload = processedPayload;
        PaymentStatus = paymentStatus;
        PaymentStatusDetail = paymentStatusDetail;
        ProcessedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkAsFailed(string errorMessage)
    {
        IsProcessed = false;
        ProcessingError = errorMessage;
        UpdatedAt = DateTime.UtcNow;
    }

    public static WebhookEvent Reconstitute(
        Guid id,
        string? correlationId,
        string? mercadoPagoPaymentId,
        string? mercadoPagoRequestId,
        string? webhookType,
        string? webhookAction,
        string? rawPayload,
        string? processedPayload,
        string? queryString,
        string? requestHeaders,
        string? contentType,
        int? contentLength,
        string? sourceIp,
        bool isDuplicate,
        bool isProcessed,
        string? processingError,
        string? paymentStatus,
        string? paymentStatusDetail,
        DateTime? processedAt,
        DateTime createdAt,
        DateTime updatedAt)
    {
        var webhook = new WebhookEvent(
            correlationId,
            mercadoPagoPaymentId,
            mercadoPagoRequestId,
            webhookType,
            webhookAction,
            rawPayload,
            queryString,
            requestHeaders,
            contentType,
            contentLength,
            sourceIp);
        
        webhook.Id = id;
        webhook.CreatedAt = createdAt;
        webhook.ProcessedPayload = processedPayload;
        webhook.IsDuplicate = isDuplicate;
        webhook.IsProcessed = isProcessed;
        webhook.ProcessingError = processingError;
        webhook.PaymentStatus = paymentStatus;
        webhook.PaymentStatusDetail = paymentStatusDetail;
        webhook.ProcessedAt = processedAt;
        webhook.UpdatedAt = updatedAt;
        
        return webhook;
    }
}
