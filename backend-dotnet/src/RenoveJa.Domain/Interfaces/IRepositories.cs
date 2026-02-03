using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

public interface IChatRepository
{
    Task<ChatMessage?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<ChatMessage>> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default);
    Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<ChatMessage> CreateAsync(ChatMessage message, CancellationToken cancellationToken = default);
    Task MarkAsReadAsync(Guid requestId, Guid userId, CancellationToken cancellationToken = default);
}

public interface INotificationRepository
{
    Task<Notification?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<Notification>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<Notification> CreateAsync(Notification notification, CancellationToken cancellationToken = default);
    Task<Notification> UpdateAsync(Notification notification, CancellationToken cancellationToken = default);
    Task MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default);
}

public interface IVideoRoomRepository
{
    Task<VideoRoom?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<VideoRoom?> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default);
    Task<VideoRoom> CreateAsync(VideoRoom videoRoom, CancellationToken cancellationToken = default);
    Task<VideoRoom> UpdateAsync(VideoRoom videoRoom, CancellationToken cancellationToken = default);
}

public interface IAuthTokenRepository
{
    Task<AuthToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default);
    Task<List<AuthToken>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<AuthToken> CreateAsync(AuthToken authToken, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    Task DeleteByTokenAsync(string token, CancellationToken cancellationToken = default);
    Task DeleteExpiredTokensAsync(CancellationToken cancellationToken = default);
}

public interface IPushTokenRepository
{
    Task<PushToken?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<PushToken>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<PushToken> CreateAsync(PushToken pushToken, CancellationToken cancellationToken = default);
    Task DeleteByTokenAsync(string token, Guid userId, CancellationToken cancellationToken = default);
}
