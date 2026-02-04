namespace RenoveJa.Application.DTOs.Payments;

public record CreatePaymentRequestDto(
    Guid RequestId,
    decimal Amount
);

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
