using Dapper;
using Microsoft.Extensions.Logging;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

public class PaymentRepository(PostgresClient db, ILogger<PaymentRepository> logger) : IPaymentRepository
{
    public async Task<Payment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM public.payments WHERE id = @Id";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var model = await conn.QueryFirstOrDefaultAsync<PaymentRow>(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken));
        return model?.ToDomain();
    }

    public async Task<Payment?> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM public.payments WHERE request_id = @RequestId ORDER BY created_at DESC LIMIT 1";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var model = await conn.QueryFirstOrDefaultAsync<PaymentRow>(new CommandDefinition(sql, new { RequestId = requestId }, cancellationToken: cancellationToken));
        return model?.ToDomain();
    }

    public async Task<Payment?> GetByExternalIdAsync(string externalId, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM public.payments WHERE external_id = @ExternalId ORDER BY created_at DESC LIMIT 1";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var model = await conn.QueryFirstOrDefaultAsync<PaymentRow>(new CommandDefinition(sql, new { ExternalId = externalId }, cancellationToken: cancellationToken));
        return model?.ToDomain();
    }

    public async Task<List<Payment>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM public.payments WHERE user_id = @UserId ORDER BY created_at DESC";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var rows = await conn.QueryAsync<PaymentRow>(new CommandDefinition(sql, new { UserId = userId }, cancellationToken: cancellationToken));
        return rows.Select(r => r.ToDomain()).ToList();
    }

    public async Task<Payment> CreateAsync(Payment payment, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            INSERT INTO public.payments (id, request_id, user_id, amount, status, payment_method, external_id, pix_qr_code, pix_qr_code_base64, pix_copy_paste, paid_at, created_at, updated_at)
            VALUES (@Id, @RequestId, @UserId, @Amount, @Status, @PaymentMethod, @ExternalId, @PixQrCode, @PixQrCodeBase64, @PixCopyPaste, @PaidAt, @CreatedAt, @UpdatedAt)";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        await conn.ExecuteAsync(new CommandDefinition(sql, ToParams(payment), cancellationToken: cancellationToken));
        return payment;
    }

    public async Task<Payment> UpdateAsync(Payment payment, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            UPDATE public.payments SET status = @Status, external_id = @ExternalId, pix_qr_code = @PixQrCode, pix_qr_code_base64 = @PixQrCodeBase64,
            pix_copy_paste = @PixCopyPaste, paid_at = @PaidAt, updated_at = @UpdatedAt WHERE id = @Id";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        await conn.ExecuteAsync(new CommandDefinition(sql, ToParams(payment), cancellationToken: cancellationToken));
        return payment;
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        const string sql = "DELETE FROM public.payments WHERE id = @Id";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        await conn.ExecuteAsync(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken));
    }

    private static object ToParams(Payment p) => new
    {
        p.Id, p.RequestId, p.UserId,
        Amount = p.Amount.Amount,
        Status = p.Status.ToString().ToLowerInvariant(),
        p.PaymentMethod, p.ExternalId, p.PixQrCode, p.PixQrCodeBase64, p.PixCopyPaste, p.PaidAt, p.CreatedAt, p.UpdatedAt
    };

    private class PaymentRow
    {
        public Guid Id { get; set; }
        public Guid RequestId { get; set; }
        public Guid UserId { get; set; }
        public decimal Amount { get; set; }
        public string Status { get; set; } = "";
        public string PaymentMethod { get; set; } = "";
        public string? ExternalId { get; set; }
        public string? PixQrCode { get; set; }
        public string? PixQrCodeBase64 { get; set; }
        public string? PixCopyPaste { get; set; }
        public DateTime? PaidAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public Payment ToDomain() => Payment.Reconstitute(Id, RequestId, UserId, Amount, Status, PaymentMethod,
            ExternalId, PixQrCode, PixQrCodeBase64, PixCopyPaste, PaidAt, CreatedAt, UpdatedAt);
    }
}
