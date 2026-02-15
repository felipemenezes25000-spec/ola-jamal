using System.Text.Json;

namespace RenoveJa.Application.DTOs.Payments;

/// <summary>
/// Requisição para criar pagamento. O valor é obtido da solicitação aprovada (não vem do cliente).
/// PIX: envie apenas RequestId (ou PaymentMethod = "pix").
/// Cartão: envie PaymentMethod, Token, PaymentMethodId. PayerEmail e PayerCpf vêm do formulário do Brick (qualquer pessoa pode pagar).
/// </summary>
public record CreatePaymentRequestDto(
    Guid RequestId,
    string? PaymentMethod = "pix",
    string? Token = null,
    int? Installments = 1,
    string? PaymentMethodId = null,
    long? IssuerId = null,
    string? PayerEmail = null,
    string? PayerCpf = null,
    bool SaveCard = false);

public record PaymentResponseDto(
    Guid Id,
    Guid RequestId,
    Guid UserId,
    decimal Amount,
    string Status,
    string PaymentMethod,
    string? ExternalId,
    string? PixQrCode,
    string? PixQrCodeBase64,
    string? PixCopyPaste,
    DateTime? PaidAt,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

/// <summary>
/// Resposta do endpoint de Checkout Pro: URL para abrir no navegador e ID do pagamento para a tela.
/// </summary>
public record CheckoutProResponseDto(string InitPoint, Guid PaymentId);

/// <summary>
/// Payload do webhook do Mercado Pago. Aceita camelCase (action, id, data).
/// MP pode enviar "action" (ex: "payment.created") ou "type" em algumas versões.
/// </summary>
public record MercadoPagoWebhookDto(
    string? Action,
    string? Id,
    Dictionary<string, JsonElement>? Data
);
