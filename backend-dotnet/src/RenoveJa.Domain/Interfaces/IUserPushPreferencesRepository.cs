using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

public interface IUserPushPreferencesRepository
{
    Task<UserPushPreferences?> GetByUserIdAsync(Guid userId, CancellationToken ct = default);
    Task<UserPushPreferences> GetOrCreateAsync(Guid userId, CancellationToken ct = default);
    Task<UserPushPreferences> UpdateAsync(UserPushPreferences prefs, CancellationToken ct = default);
}
