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
    /// Cria um customer no Mercado Pago (para salvar cartões).
    /// </summary>
    Task<string> CreateCustomerAsync(
        string email,
        string firstName,
        string lastName,
        string? phoneAreaCode = null,
        string? phoneNumber = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Busca customer por email (quando CreateCustomer retorna 101 - já existe).
    /// </summary>
    Task<string?> SearchCustomerByEmailAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>
    /// Adiciona um cartão a um customer. Token deve ser obtido no frontend via Brick.
    /// </summary>
    Task<(string CardId, string LastFour, string Brand)> AddCardToCustomerAsync(
        string customerId,
        string token,
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
    /// Cria um pagamento com cartão salvo (payer type=customer). Token deve ser criado no frontend com mp.fields.createCardToken({ cardId }).
    /// </summary>
    Task<MercadoPagoCardResult> CreateCardPaymentWithCustomerAsync(
        decimal amount,
        string description,
        string mpCustomerId,
        string token,
        string paymentMethodId,
        int installments,
        string externalReference,
        string? correlationId = null,
        CancellationToken cancellationToken = default);

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
