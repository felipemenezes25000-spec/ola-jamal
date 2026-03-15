using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

public class PushTokenRepository(PostgresClient supabase) : IPushTokenRepository
{
    private const string TableName = "push_tokens";

    public async Task<PushToken?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<PushTokenModel>(
            TableName, filter: $"id=eq.{id}", cancellationToken: cancellationToken);
        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<PushToken>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<PushTokenModel>(
            TableName, filter: $"user_id=eq.{userId}&active=eq.true", cancellationToken: cancellationToken);
        return models.Select(MapToDomain).ToList();
    }

    public async Task<List<PushToken>> GetAllByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<PushTokenModel>(
            TableName, filter: $"user_id=eq.{userId}", cancellationToken: cancellationToken);
        return models.Select(MapToDomain).ToList();
    }

    public async Task<PushToken> CreateAsync(PushToken pushToken, CancellationToken cancellationToken = default)
    {
        // Use upsert to avoid duplicate key violation on idx_push_tokens_unique
        var model = MapToModel(pushToken);
        await supabase.UpsertAsync(TableName, model, cancellationToken);
        return pushToken;
    }

    public async Task<PushToken> RegisterOrUpdateAsync(PushToken pushToken, CancellationToken cancellationToken = default)
    {
        // No URL encoding needed with Npgsql/Dapper (SQL parameters handle special chars)
        var filter = $"user_id=eq.{pushToken.UserId}&token=eq.{pushToken.Token}";
        var existing = await supabase.GetSingleAsync<PushTokenModel>(
            TableName, filter: filter, cancellationToken: cancellationToken);

        PushToken result;
        if (existing != null)
        {
            var updated = await supabase.UpdateAsync<PushTokenModel>(
                TableName, filter, new { active = true }, cancellationToken);
            result = MapToDomain(updated);
        }
        else
        {
            var model = MapToModel(pushToken);
            try
            {
                var created = await supabase.InsertAsync<PushTokenModel>(TableName, model, cancellationToken);
                result = MapToDomain(created);
            }
            catch
            {
                // Duplicate key â€” token already exists, just activate it
                await supabase.UpdateAsync<PushTokenModel>(
                    TableName, filter, new { active = true }, cancellationToken);
                result = pushToken;
            }
        }

        // Deactivate same token for OTHER users (device can only push to active user)
        try
        {
            var deactivateFilter = $"token=eq.{pushToken.Token}&user_id=neq.{pushToken.UserId}&active=eq.true";
            await supabase.UpdateAsync<PushTokenModel>(
                TableName, deactivateFilter, new { active = false }, cancellationToken);
        }
        catch { /* Don't fail registration because of cleanup */ }

        return result;
    }

    public async Task DeleteByTokenAsync(string token, Guid userId, CancellationToken cancellationToken = default)
    {
        await supabase.UpdateAsync<PushTokenModel>(
            TableName, $"token=eq.{token}&user_id=eq.{userId}", new { active = false }, cancellationToken);
    }

    public async Task<bool> UpdateActiveAsync(Guid id, Guid userId, bool active, CancellationToken cancellationToken = default)
    {
        var token = await GetByIdAsync(id, cancellationToken);
        if (token == null || token.UserId != userId) return false;
        await supabase.UpdateAsync<PushTokenModel>(
            TableName, $"id=eq.{id}&user_id=eq.{userId}", new { active }, cancellationToken);
        return true;
    }

    public async Task SetAllActiveForUserAsync(Guid userId, bool active, CancellationToken cancellationToken = default)
    {
        await supabase.UpdateAsync<PushTokenModel>(
            TableName, $"user_id=eq.{userId}", new { active }, cancellationToken);
    }

    public async Task DeactivateByTokenAsync(string token, Guid userId, CancellationToken ct = default)
    {
        await supabase.UpdateAsync<PushTokenModel>(
            TableName, $"token=eq.{token}&user_id=eq.{userId}", new { active = false }, ct);
    }

    private static PushToken MapToDomain(PushTokenModel model)
    {
        return PushToken.Reconstitute(model.Id, model.UserId, model.Token, model.DeviceType, model.Active, model.CreatedAt);
    }

    private static PushTokenModel MapToModel(PushToken token)
    {
        return new PushTokenModel
        {
            Id = token.Id, UserId = token.UserId, Token = token.Token,
            DeviceType = token.DeviceType, Active = token.Active, CreatedAt = token.CreatedAt
        };
    }
}
