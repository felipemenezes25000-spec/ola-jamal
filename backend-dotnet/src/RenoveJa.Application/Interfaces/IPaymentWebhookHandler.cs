using RenoveJa.Application.Services.Payments;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Orquestra o processamento de webhooks do Mercado Pago: parse, validação HMAC, persistência e processamento.
/// </summary>
public interface IPaymentWebhookHandler
{
    /// <summary>
    /// Processa o webhook recebido (body, query, headers).
    /// </summary>
    Task<PaymentWebhookHandleResult> HandleAsync(
        string? rawBody,
        string queryString,
        IReadOnlyDictionary<string, string> headers,
        string? contentType,
        long? contentLength,
        string? sourceIp,
        CancellationToken cancellationToken = default);
}
