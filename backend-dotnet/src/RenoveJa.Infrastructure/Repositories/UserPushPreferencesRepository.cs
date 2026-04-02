using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de preferências de push via db.
/// </summary>
public class UserPushPreferencesRepository(PostgresClient db) : IUserPushPreferencesRepository
{
    private const string TableName = "user_push_preferences";

    public async Task<UserPushPreferences?> GetByUserIdAsync(Guid userId, CancellationToken ct = default)
    {
        var model = await db.GetSingleAsync<UserPushPreferencesModel>(
            TableName,
            filter: $"user_id=eq.{userId}",
            cancellationToken: ct);
        return model != null ? MapToDomain(model) : null;
    }

    public async Task<UserPushPreferences> GetOrCreateAsync(Guid userId, CancellationToken ct = default)
    {
        var existing = await GetByUserIdAsync(userId, ct);
        if (existing != null)
            return existing;

        var prefs = UserPushPreferences.CreateDefault(userId);
        var model = MapToModel(prefs);
        await db.InsertAsync<UserPushPreferencesModel>(TableName, model, ct);
        return prefs;
    }

    public async Task<UserPushPreferences> UpdateAsync(UserPushPreferences prefs, CancellationToken ct = default)
    {
        var model = MapToModel(prefs);
        model.UpdatedAt = DateTime.UtcNow;
        await db.UpdateAsync<UserPushPreferencesModel>(
            TableName,
            $"user_id=eq.{prefs.UserId}",
            new
            {
                model.RequestsEnabled,
                model.ConsultationsEnabled,
                model.RemindersEnabled,
                model.Timezone,
                model.UpdatedAt
            },
            ct);
        return prefs;
    }

    private static UserPushPreferences MapToDomain(UserPushPreferencesModel m) =>
        UserPushPreferences.Reconstitute(
            m.UserId,
            m.RequestsEnabled,
            m.ConsultationsEnabled,
            m.RemindersEnabled,
            m.Timezone);

    private static UserPushPreferencesModel MapToModel(UserPushPreferences p) => new()
    {
        UserId = p.UserId,
        RequestsEnabled = p.RequestsEnabled,
        ConsultationsEnabled = p.ConsultationsEnabled,
        RemindersEnabled = p.RemindersEnabled,
        Timezone = p.Timezone,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };
}
