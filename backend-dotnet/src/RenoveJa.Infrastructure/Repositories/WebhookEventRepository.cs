using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

public class WebhookEventRepository(SupabaseClient supabase) : IWebhookEventRepository
{
    private const string TableName = "webhook_events";

    public async Task<WebhookEvent?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<WebhookEventModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<WebhookEvent?> GetByMercadoPagoRequestIdAsync(string mercadoPagoRequestId, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<WebhookEventModel>(
            TableName,
            filter: $"mercado_pago_request_id=eq.{mercadoPagoRequestId}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<WebhookEvent>> GetByPaymentIdAsync(string mercadoPagoPaymentId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<WebhookEventModel>(
            TableName,
            filter: $"mercado_pago_payment_id=eq.{mercadoPagoPaymentId}",
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<WebhookEvent>> GetByCorrelationIdAsync(string correlationId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<WebhookEventModel>(
            TableName,
            filter: $"correlation_id=eq.{correlationId}",
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<WebhookEvent> CreateAsync(WebhookEvent webhookEvent, CancellationToken cancellationToken = default)
    {
        try
        {
            var model = WebhookEventModel.FromDomain(webhookEvent);
            var created = await supabase.InsertAsync<WebhookEventModel>(
                TableName,
                model,
                cancellationToken);

            return MapToDomain(created);
        }
        catch (Exception ex)
        {
            // Log detalhado do erro para diagnóstico
            var modelJson = System.Text.Json.JsonSerializer.Serialize(WebhookEventModel.FromDomain(webhookEvent));
            throw new InvalidOperationException(
                $"Falha ao criar WebhookEvent na tabela {TableName}. " +
                $"Payload: {modelJson.Substring(0, Math.Min(500, modelJson.Length))}. " +
                $"Erro: {ex.Message}", ex);
        }
    }

    public async Task<WebhookEvent> UpdateAsync(WebhookEvent webhookEvent, CancellationToken cancellationToken = default)
    {
        var model = WebhookEventModel.FromDomain(webhookEvent);
        var updated = await supabase.UpdateAsync<WebhookEventModel>(
            TableName,
            $"id=eq.{webhookEvent.Id}",
            model,
            cancellationToken);

        // Se o update não retornou nada (registro não encontrado ou resposta vazia), retornar o objeto original
        if (updated == null)
        {
            return webhookEvent;
        }

        return MapToDomain(updated);
    }

    private static WebhookEvent MapToDomain(WebhookEventModel? model)
    {
        if (model == null)
            throw new ArgumentNullException(nameof(model), "WebhookEventModel não pode ser null");

        return WebhookEvent.Reconstitute(
            model.Id,
            model.CorrelationId,
            model.MercadoPagoPaymentId,
            model.MercadoPagoRequestId,
            model.WebhookType,
            model.WebhookAction,
            model.RawPayload,
            model.ProcessedPayload,
            model.QueryString,
            model.RequestHeaders,
            model.ContentType,
            model.ContentLength,
            model.SourceIp,
            model.IsDuplicate,
            model.IsProcessed,
            model.ProcessingError,
            model.PaymentStatus,
            model.PaymentStatusDetail,
            model.ProcessedAt,
            model.CreatedAt,
            model.UpdatedAt);
    }
}
