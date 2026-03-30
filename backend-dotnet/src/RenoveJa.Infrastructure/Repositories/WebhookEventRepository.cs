using Dapper;
using Microsoft.Extensions.Logging;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

public class WebhookEventRepository(PostgresClient db, ILogger<WebhookEventRepository> logger) : IWebhookEventRepository
{
    public async Task<WebhookEvent?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM public.webhook_events WHERE id = @Id";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var row = await conn.QueryFirstOrDefaultAsync<WebhookEventRow>(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken));
        return row?.ToDomain();
    }

    public async Task<WebhookEvent?> GetByMercadoPagoRequestIdAsync(string mercadoPagoRequestId, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM public.webhook_events WHERE mercado_pago_request_id = @MpReqId ORDER BY created_at DESC LIMIT 1";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var row = await conn.QueryFirstOrDefaultAsync<WebhookEventRow>(new CommandDefinition(sql, new { MpReqId = mercadoPagoRequestId }, cancellationToken: cancellationToken));
        return row?.ToDomain();
    }

    public async Task<List<WebhookEvent>> GetByPaymentIdAsync(string mercadoPagoPaymentId, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM public.webhook_events WHERE mercado_pago_payment_id = @MpPayId ORDER BY created_at DESC";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var rows = await conn.QueryAsync<WebhookEventRow>(new CommandDefinition(sql, new { MpPayId = mercadoPagoPaymentId }, cancellationToken: cancellationToken));
        return rows.Select(r => r.ToDomain()).ToList();
    }

    public async Task<WebhookEvent> CreateAsync(WebhookEvent evt, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            INSERT INTO public.webhook_events (id, correlation_id, mercado_pago_payment_id, mercado_pago_request_id,
                webhook_type, webhook_action, raw_payload, processed_payload, query_string, request_headers,
                content_type, content_length, source_ip, is_duplicate, is_processed, processing_error,
                payment_status, payment_status_detail, processed_at, created_at, updated_at)
            VALUES (@Id, @CorrelationId, @MercadoPagoPaymentId, @MercadoPagoRequestId,
                @WebhookType, @WebhookAction, @RawPayload, @ProcessedPayload, @QueryString, @RequestHeaders,
                @ContentType, @ContentLength, @SourceIp, @IsDuplicate, @IsProcessed, @ProcessingError,
                @PaymentStatus, @PaymentStatusDetail, @ProcessedAt, @CreatedAt, @UpdatedAt)";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        await conn.ExecuteAsync(new CommandDefinition(sql, ToParams(evt), cancellationToken: cancellationToken));
        return evt;
    }

    public async Task<WebhookEvent> UpdateAsync(WebhookEvent evt, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            UPDATE public.webhook_events SET processed_payload = @ProcessedPayload, is_duplicate = @IsDuplicate,
            is_processed = @IsProcessed, processing_error = @ProcessingError, payment_status = @PaymentStatus,
            payment_status_detail = @PaymentStatusDetail, processed_at = @ProcessedAt, updated_at = @UpdatedAt WHERE id = @Id";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        await conn.ExecuteAsync(new CommandDefinition(sql, ToParams(evt), cancellationToken: cancellationToken));
        return evt;
    }

    private static object ToParams(WebhookEvent e) => new
    {
        e.Id, e.CorrelationId, e.MercadoPagoPaymentId, e.MercadoPagoRequestId,
        e.WebhookType, e.WebhookAction, e.RawPayload, e.ProcessedPayload, e.QueryString, e.RequestHeaders,
        e.ContentType, e.ContentLength, e.SourceIp, e.IsDuplicate, e.IsProcessed, e.ProcessingError,
        e.PaymentStatus, e.PaymentStatusDetail, e.ProcessedAt, e.CreatedAt, e.UpdatedAt
    };

    private class WebhookEventRow
    {
        public Guid Id { get; set; }
        public string? CorrelationId { get; set; }
        public string? MercadoPagoPaymentId { get; set; }
        public string? MercadoPagoRequestId { get; set; }
        public string? WebhookType { get; set; }
        public string? WebhookAction { get; set; }
        public string? RawPayload { get; set; }
        public string? ProcessedPayload { get; set; }
        public string? QueryString { get; set; }
        public string? RequestHeaders { get; set; }
        public string? ContentType { get; set; }
        public int? ContentLength { get; set; }
        public string? SourceIp { get; set; }
        public bool IsDuplicate { get; set; }
        public bool IsProcessed { get; set; }
        public string? ProcessingError { get; set; }
        public string? PaymentStatus { get; set; }
        public string? PaymentStatusDetail { get; set; }
        public DateTime? ProcessedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public WebhookEvent ToDomain() => WebhookEvent.Reconstitute(Id, CorrelationId, MercadoPagoPaymentId, MercadoPagoRequestId,
            WebhookType, WebhookAction, RawPayload, ProcessedPayload, QueryString, RequestHeaders,
            ContentType, ContentLength, SourceIp, IsDuplicate, IsProcessed, ProcessingError,
            PaymentStatus, PaymentStatusDetail, ProcessedAt, CreatedAt, UpdatedAt);
    }
}
