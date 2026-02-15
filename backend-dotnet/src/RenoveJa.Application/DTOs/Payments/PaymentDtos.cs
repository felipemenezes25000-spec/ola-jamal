namespace RenoveJa.Application.DTOs.Payments;

/// <summary>
/// Requisição para criar pagamento. O valor é obtido da solicitação aprovada (não vem do cliente).
/// PIX: envie apenas RequestId (ou PaymentMethod = "pix").
/// Cartão: envie PaymentMethod = "credit_card" ou "debit_card", Token (do SDK do MP) e PaymentMethodId (ex: "visa", "master").
/// </summary>
public record CreatePaymentRequestDto(
    Guid RequestId,
    string? PaymentMethod = "pix",
    string? Token = null,
    int? Installments = 1,
    string? PaymentMethodId = null,
    long? IssuerId = null);

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

public record MercadoPagoWebhookDto(
    string Action,
    string? Id,
    Dictionary<string, object>? Data
);
