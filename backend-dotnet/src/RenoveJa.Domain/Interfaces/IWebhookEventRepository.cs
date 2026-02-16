using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

public interface IWebhookEventRepository
{
    Task<WebhookEvent?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<WebhookEvent?> GetByMercadoPagoRequestIdAsync(string mercadoPagoRequestId, CancellationToken cancellationToken = default);
    Task<List<WebhookEvent>> GetByPaymentIdAsync(string mercadoPagoPaymentId, CancellationToken cancellationToken = default);
    Task<List<WebhookEvent>> GetByCorrelationIdAsync(string correlationId, CancellationToken cancellationToken = default);
    Task<WebhookEvent> CreateAsync(WebhookEvent webhookEvent, CancellationToken cancellationToken = default);
    Task<WebhookEvent> UpdateAsync(WebhookEvent webhookEvent, CancellationToken cancellationToken = default);
}
