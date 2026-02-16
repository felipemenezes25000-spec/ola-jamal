namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de integração com Mercado Pago para pagamentos PIX e cartão.
/// </summary>
public interface IMercadoPagoService
{
    /// <summary>
    /// Cria um pagamento PIX no Mercado Pago e retorna os dados para o pagador.
    /// </summary>
    Task<MercadoPagoPixResult> CreatePixPaymentAsync(
        decimal amount,
        string description,
        string payerEmail,
        string externalReference,
        string? correlationId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Cria um pagamento com cartão (crédito ou débito). Token deve ser obtido no frontend via SDK do MP.
    /// </summary>
    Task<MercadoPagoCardResult> CreateCardPaymentAsync(
        decimal amount,
        string description,
        string payerEmail,
        string? payerCpf,
        string externalReference,
        string token,
        int installments,
        string paymentMethodId,
        long? issuerId,
        string? paymentTypeId = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Verifica o status real de um pagamento na API do Mercado Pago (GET /v1/payments/{id}).
    /// </summary>
    Task<string?> GetPaymentStatusAsync(string paymentId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtém status e external_reference de um pagamento (para webhook Checkout Pro).
    /// </summary>
    Task<MercadoPagoPaymentDetails?> GetPaymentDetailsAsync(string paymentId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Cria uma preferência do Checkout Pro e retorna a URL init_point.
    /// </summary>
    Task<string> CreateCheckoutProPreferenceAsync(
        decimal amount,
        string title,
        string externalReference,
        string payerEmail,
        string? redirectBaseUrl,
        string? correlationId = null,
        CancellationToken cancellationToken = default);
}

public record MercadoPagoPaymentDetails(string Status, string? ExternalReference);

public record MercadoPagoPixResult(
    string ExternalId,
    string QrCodeBase64,
    string QrCode,
    string CopyPaste,
    string? CorrelationId = null,
    string? RequestUrl = null,
    string? RequestPayload = null,
    string? ResponsePayload = null,
    int? ResponseStatusCode = null,
    string? ResponseStatusDetail = null,
    string? ResponseHeaders = null);

public record MercadoPagoCardResult(
    string ExternalId,
    string Status,
    string? CorrelationId = null,
    string? RequestUrl = null,
    string? RequestPayload = null,
    string? ResponsePayload = null,
    int? ResponseStatusCode = null,
    string? ResponseStatusDetail = null,
    string? ResponseHeaders = null);
