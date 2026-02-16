using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

public class PaymentAttemptRepository(SupabaseClient supabase) : IPaymentAttemptRepository
{
    private const string TableName = "payment_attempts";

    public async Task<PaymentAttempt?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<PaymentAttemptModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<PaymentAttempt?> GetByCorrelationIdAsync(string correlationId, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<PaymentAttemptModel>(
            TableName,
            filter: $"correlation_id=eq.{correlationId}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<PaymentAttempt>> GetByPaymentIdAsync(Guid paymentId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<PaymentAttemptModel>(
            TableName,
            filter: $"payment_id=eq.{paymentId}",
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<PaymentAttempt>> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<PaymentAttemptModel>(
            TableName,
            filter: $"request_id=eq.{requestId}",
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<PaymentAttempt> CreateAsync(PaymentAttempt attempt, CancellationToken cancellationToken = default)
    {
        var model = PaymentAttemptModel.FromDomain(attempt);
        var created = await supabase.InsertAsync<PaymentAttemptModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<PaymentAttempt> UpdateAsync(PaymentAttempt attempt, CancellationToken cancellationToken = default)
    {
        var model = PaymentAttemptModel.FromDomain(attempt);
        var updated = await supabase.UpdateAsync<PaymentAttemptModel>(
            TableName,
            $"id=eq.{attempt.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    private static PaymentAttempt MapToDomain(PaymentAttemptModel model)
    {
        return PaymentAttempt.Reconstitute(
            model.Id,
            model.PaymentId,
            model.RequestId,
            model.UserId,
            model.CorrelationId,
            model.PaymentMethod,
            model.Amount,
            model.MercadoPagoPaymentId,
            model.MercadoPagoPreferenceId,
            model.RequestUrl,
            model.RequestPayload,
            model.ResponsePayload,
            model.ResponseStatusCode,
            model.ResponseStatusDetail,
            model.ResponseHeaders,
            model.ErrorMessage,
            model.IsSuccess,
            model.CreatedAt,
            model.UpdatedAt);
    }
}
