using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de cartões salvos via Supabase.
/// </summary>
public class SavedCardRepository(SupabaseClient supabase) : ISavedCardRepository
{
    private const string TableName = "saved_cards";

    public async Task<SavedCard?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<SavedCardModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<SavedCard>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<SavedCardModel>(
            TableName,
            filter: $"user_id=eq.{userId}",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<SavedCard> CreateAsync(SavedCard savedCard, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(savedCard);
        var created = await supabase.InsertAsync<SavedCardModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await supabase.DeleteAsync(
            TableName,
            $"id=eq.{id}",
            cancellationToken);
    }

    private static SavedCard MapToDomain(SavedCardModel model)
    {
        return SavedCard.Reconstitute(
            model.Id,
            model.CreatedAt,
            model.UserId,
            model.MpCustomerId,
            model.MpCardId,
            model.LastFour,
            model.Brand);
    }

    private static SavedCardModel MapToModel(SavedCard savedCard)
    {
        return new SavedCardModel
        {
            Id = savedCard.Id,
            UserId = savedCard.UserId,
            MpCustomerId = savedCard.MpCustomerId,
            MpCardId = savedCard.MpCardId,
            LastFour = savedCard.LastFour,
            Brand = savedCard.Brand,
            CreatedAt = savedCard.CreatedAt
        };
    }
}
