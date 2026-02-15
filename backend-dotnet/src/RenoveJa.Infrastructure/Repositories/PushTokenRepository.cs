using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de tokens de push via Supabase.
/// </summary>
public class PushTokenRepository(SupabaseClient supabase) : IPushTokenRepository
{
    private const string TableName = "push_tokens";

    /// <summary>
    /// Obtém um token de push pelo ID.
    /// </summary>
    public async Task<PushToken?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<PushTokenModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<PushToken>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<PushTokenModel>(
            TableName,
            filter: $"user_id=eq.{userId}&active=eq.true",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<PushToken>> GetAllByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<PushTokenModel>(
            TableName,
            filter: $"user_id=eq.{userId}",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<PushToken> CreateAsync(PushToken pushToken, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(pushToken);
        var created = await supabase.InsertAsync<PushTokenModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task DeleteByTokenAsync(string token, Guid userId, CancellationToken cancellationToken = default)
    {
        await supabase.UpdateAsync<PushTokenModel>(
            TableName,
            $"token=eq.{token}&user_id=eq.{userId}",
            new { active = false },
            cancellationToken);
    }

    public async Task<bool> UpdateActiveAsync(Guid id, Guid userId, bool active, CancellationToken cancellationToken = default)
    {
        var token = await GetByIdAsync(id, cancellationToken);
        if (token == null || token.UserId != userId)
            return false;

        await supabase.UpdateAsync<PushTokenModel>(
            TableName,
            $"id=eq.{id}&user_id=eq.{userId}",
            new { active },
            cancellationToken);
        return true;
    }

    public async Task SetAllActiveForUserAsync(Guid userId, bool active, CancellationToken cancellationToken = default)
    {
        await supabase.UpdateAsync<PushTokenModel>(
            TableName,
            $"user_id=eq.{userId}",
            new { active },
            cancellationToken);
    }

    private static PushToken MapToDomain(PushTokenModel model)
    {
        return PushToken.Reconstitute(
            model.Id,
            model.UserId,
            model.Token,
            model.DeviceType,
            model.Active,
            model.CreatedAt);
    }

    private static PushTokenModel MapToModel(PushToken token)
    {
        return new PushTokenModel
        {
            Id = token.Id,
            UserId = token.UserId,
            Token = token.Token,
            DeviceType = token.DeviceType,
            Active = token.Active,
            CreatedAt = token.CreatedAt
        };
    }
}
