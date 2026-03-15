using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

public class OutboxEventRepository(PostgresClient supabase) : IOutboxEventRepository
{
    private const string TableName = "outbox_events";

    public async Task<bool> ExistsByIdempotencyKeyAsync(string idempotencyKey, CancellationToken cancellationToken = default)
    {
        var item = await supabase.GetSingleAsync<OutboxEventModel>(
            TableName,
            filter: $"idempotency_key=eq.{idempotencyKey}",
            cancellationToken: cancellationToken);
        return item != null;
    }

    public async Task<Guid> CreatePendingAsync(
        string aggregateType,
        Guid aggregateId,
        string eventType,
        string payloadJson,
        string idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        var created = await supabase.InsertAsync<OutboxEventModel>(
            TableName,
            new OutboxEventModel
            {
                Id = Guid.NewGuid(),
                AggregateType = aggregateType,
                AggregateId = aggregateId,
                EventType = eventType,
                PayloadJson = payloadJson,
                IdempotencyKey = idempotencyKey,
                Status = "pending",
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);
        return created.Id;
    }

    public async Task MarkProcessedAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await supabase.UpdateAsync<OutboxEventModel>(
            TableName,
            $"id=eq.{id}",
            new { status = "processed", processed_at = DateTime.UtcNow },
            cancellationToken);
    }
}
