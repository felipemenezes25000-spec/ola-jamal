using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de pagamentos via Supabase.
/// </summary>
public class PaymentRepository(SupabaseClient supabase) : IPaymentRepository
{
    private const string TableName = "payments";

    /// <summary>
    /// Obtém um pagamento pelo ID.
    /// </summary>
    public async Task<Payment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<PaymentModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<Payment?> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<PaymentModel>(
            TableName,
            filter: $"request_id=eq.{requestId}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<Payment?> GetByExternalIdAsync(string externalId, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<PaymentModel>(
            TableName,
            filter: $"external_id=eq.{externalId}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<Payment>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<PaymentModel>(
            TableName,
            filter: $"user_id=eq.{userId}",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<Payment> CreateAsync(Payment payment, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(payment);
        var created = await supabase.InsertAsync<PaymentModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<Payment> UpdateAsync(Payment payment, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(payment);
        var updated = await supabase.UpdateAsync<PaymentModel>(
            TableName,
            $"id=eq.{payment.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await supabase.DeleteAsync(
            TableName,
            $"id=eq.{id}",
            cancellationToken);
    }

    private static Payment MapToDomain(PaymentModel model)
    {
        return Payment.Reconstitute(
            model.Id,
            model.RequestId,
            model.UserId,
            model.Amount,
            model.Status,
            model.PaymentMethod,
            model.ExternalId,
            model.PixQrCode,
            model.PixQrCodeBase64,
            model.PixCopyPaste,
            model.PaidAt,
            model.CreatedAt,
            model.UpdatedAt);
    }

    private static PaymentModel MapToModel(Payment payment)
    {
        return new PaymentModel
        {
            Id = payment.Id,
            RequestId = payment.RequestId,
            UserId = payment.UserId,
            Amount = payment.Amount.Amount,
            Status = payment.Status.ToString().ToLowerInvariant(),
            PaymentMethod = payment.PaymentMethod,
            ExternalId = payment.ExternalId,
            PixQrCode = payment.PixQrCode,
            PixQrCodeBase64 = payment.PixQrCodeBase64,
            PixCopyPaste = payment.PixCopyPaste,
            PaidAt = payment.PaidAt,
            CreatedAt = payment.CreatedAt,
            UpdatedAt = payment.UpdatedAt
        };
    }
}
