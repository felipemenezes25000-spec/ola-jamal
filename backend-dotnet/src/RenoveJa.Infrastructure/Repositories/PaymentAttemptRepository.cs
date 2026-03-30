using Dapper;
using Microsoft.Extensions.Logging;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

public class PaymentAttemptRepository(PostgresClient db, ILogger<PaymentAttemptRepository> logger) : IPaymentAttemptRepository
{
    public async Task<PaymentAttempt?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM public.payment_attempts WHERE id = @Id";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var row = await conn.QueryFirstOrDefaultAsync<PaymentAttemptRow>(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken));
        return row?.ToDomain();
    }

    public async Task<PaymentAttempt?> GetByCorrelationIdAsync(string correlationId, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM public.payment_attempts WHERE correlation_id = @CorrelationId ORDER BY created_at DESC LIMIT 1";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var row = await conn.QueryFirstOrDefaultAsync<PaymentAttemptRow>(new CommandDefinition(sql, new { CorrelationId = correlationId }, cancellationToken: cancellationToken));
        return row?.ToDomain();
    }

    public async Task<List<PaymentAttempt>> GetByPaymentIdAsync(Guid paymentId, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM public.payment_attempts WHERE payment_id = @PaymentId ORDER BY created_at DESC";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var rows = await conn.QueryAsync<PaymentAttemptRow>(new CommandDefinition(sql, new { PaymentId = paymentId }, cancellationToken: cancellationToken));
        return rows.Select(r => r.ToDomain()).ToList();
    }

    public async Task<List<PaymentAttempt>> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM public.payment_attempts WHERE request_id = @RequestId ORDER BY created_at DESC";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var rows = await conn.QueryAsync<PaymentAttemptRow>(new CommandDefinition(sql, new { RequestId = requestId }, cancellationToken: cancellationToken));
        return rows.Select(r => r.ToDomain()).ToList();
    }

    public async Task<PaymentAttempt> CreateAsync(PaymentAttempt attempt, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            INSERT INTO public.payment_attempts (id, payment_id, request_id, user_id, correlation_id, payment_method, amount,
                mercado_pago_payment_id, mercado_pago_preference_id, request_url, request_payload, response_payload,
                response_status_code, response_status_detail, response_headers, error_message, is_success, created_at, updated_at)
            VALUES (@Id, @PaymentId, @RequestId, @UserId, @CorrelationId, @PaymentMethod, @Amount,
                @MercadoPagoPaymentId, @MercadoPagoPreferenceId, @RequestUrl, @RequestPayload, @ResponsePayload,
                @ResponseStatusCode, @ResponseStatusDetail, @ResponseHeaders, @ErrorMessage, @IsSuccess, @CreatedAt, @UpdatedAt)";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        await conn.ExecuteAsync(new CommandDefinition(sql, ToParams(attempt), cancellationToken: cancellationToken));
        return attempt;
    }

    public async Task<PaymentAttempt> UpdateAsync(PaymentAttempt attempt, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            UPDATE public.payment_attempts SET mercado_pago_payment_id = @MercadoPagoPaymentId, mercado_pago_preference_id = @MercadoPagoPreferenceId,
            response_payload = @ResponsePayload, response_status_code = @ResponseStatusCode, response_status_detail = @ResponseStatusDetail,
            response_headers = @ResponseHeaders, error_message = @ErrorMessage, is_success = @IsSuccess, updated_at = @UpdatedAt WHERE id = @Id";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        await conn.ExecuteAsync(new CommandDefinition(sql, ToParams(attempt), cancellationToken: cancellationToken));
        return attempt;
    }

    private static object ToParams(PaymentAttempt a) => new
    {
        a.Id, a.PaymentId, a.RequestId, a.UserId, a.CorrelationId, a.PaymentMethod, a.Amount,
        a.MercadoPagoPaymentId, a.MercadoPagoPreferenceId, a.RequestUrl, a.RequestPayload, a.ResponsePayload,
        a.ResponseStatusCode, a.ResponseStatusDetail, a.ResponseHeaders, a.ErrorMessage, a.IsSuccess, a.CreatedAt, a.UpdatedAt
    };

    private class PaymentAttemptRow
    {
        public Guid Id { get; set; }
        public Guid PaymentId { get; set; }
        public Guid RequestId { get; set; }
        public Guid UserId { get; set; }
        public string CorrelationId { get; set; } = "";
        public string PaymentMethod { get; set; } = "";
        public decimal Amount { get; set; }
        public string? MercadoPagoPaymentId { get; set; }
        public string? MercadoPagoPreferenceId { get; set; }
        public string? RequestUrl { get; set; }
        public string? RequestPayload { get; set; }
        public string? ResponsePayload { get; set; }
        public int? ResponseStatusCode { get; set; }
        public string? ResponseStatusDetail { get; set; }
        public string? ResponseHeaders { get; set; }
        public string? ErrorMessage { get; set; }
        public bool IsSuccess { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public PaymentAttempt ToDomain() => PaymentAttempt.Reconstitute(Id, PaymentId, RequestId, UserId, CorrelationId, PaymentMethod, Amount,
            MercadoPagoPaymentId, MercadoPagoPreferenceId, RequestUrl, RequestPayload, ResponsePayload,
            ResponseStatusCode, ResponseStatusDetail, ResponseHeaders, ErrorMessage, IsSuccess, CreatedAt, UpdatedAt);
    }
}
