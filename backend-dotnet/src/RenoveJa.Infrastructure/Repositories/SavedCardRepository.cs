using Dapper;
using Microsoft.Extensions.Logging;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

public class SavedCardRepository(PostgresClient db, ILogger<SavedCardRepository> logger) : ISavedCardRepository
{
    public async Task<SavedCard?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM public.saved_cards WHERE id = @Id";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var row = await conn.QueryFirstOrDefaultAsync<SavedCardRow>(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken));
        return row?.ToDomain();
    }

    public async Task<List<SavedCard>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM public.saved_cards WHERE user_id = @UserId ORDER BY created_at DESC";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var rows = await conn.QueryAsync<SavedCardRow>(new CommandDefinition(sql, new { UserId = userId }, cancellationToken: cancellationToken));
        return rows.Select(r => r.ToDomain()).ToList();
    }

    public async Task<SavedCard> CreateAsync(SavedCard card, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            INSERT INTO public.saved_cards (id, user_id, mp_customer_id, mp_card_id, last_four, brand, created_at)
            VALUES (@Id, @UserId, @MpCustomerId, @MpCardId, @LastFour, @Brand, @CreatedAt)";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        await conn.ExecuteAsync(new CommandDefinition(sql, new { card.Id, card.UserId, card.MpCustomerId, card.MpCardId, card.LastFour, card.Brand, card.CreatedAt }, cancellationToken: cancellationToken));
        return card;
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        const string sql = "DELETE FROM public.saved_cards WHERE id = @Id";
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        await conn.ExecuteAsync(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken));
    }

    private class SavedCardRow
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string MpCustomerId { get; set; } = "";
        public string MpCardId { get; set; } = "";
        public string LastFour { get; set; } = "";
        public string Brand { get; set; } = "";
        public DateTime CreatedAt { get; set; }

        public SavedCard ToDomain() => SavedCard.Reconstitute(Id, CreatedAt, UserId, MpCustomerId, MpCardId, LastFour, Brand);
    }
}
