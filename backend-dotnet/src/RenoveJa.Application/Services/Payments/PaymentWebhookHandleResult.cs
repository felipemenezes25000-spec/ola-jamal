namespace RenoveJa.Application.Services.Payments;

/// <summary>
/// Resultado do processamento de webhook do Mercado Pago.
/// </summary>
public enum PaymentWebhookResultKind
{
    Success,
    BadRequest,
    Unauthorized,
    Duplicate,
    Idempotent
}

/// <summary>
/// Resultado da orquestração do webhook (parse, validação HMAC, persistência, processamento).
/// </summary>
public record PaymentWebhookHandleResult(
    PaymentWebhookResultKind Kind,
    string? Error = null);
