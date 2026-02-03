using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

public class ChatRepository : IChatRepository
{
    private readonly SupabaseClient _supabase;
    private const string TableName = "chat_messages";

    public ChatRepository(SupabaseClient supabase)
    {
        _supabase = supabase;
    }

    public async Task<ChatMessage?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await _supabase.GetSingleAsync<ChatMessageModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<ChatMessage>> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        var models = await _supabase.GetAllAsync<ChatMessageModel>(
            TableName,
            filter: $"request_id=eq.{requestId}&order=created_at.asc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        // This is a simplified version - in real implementation, would need to join with requests
        var messages = await _supabase.GetAllAsync<ChatMessageModel>(
            TableName,
            filter: $"read=eq.false",
            cancellationToken: cancellationToken);

        return messages.Count;
    }

    public async Task<ChatMessage> CreateAsync(ChatMessage message, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(message);
        var created = await _supabase.InsertAsync<ChatMessageModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task MarkAsReadAsync(Guid requestId, Guid userId, CancellationToken cancellationToken = default)
    {
        await _supabase.UpdateAsync<ChatMessageModel>(
            TableName,
            $"request_id=eq.{requestId}",
            new { read = true },
            cancellationToken);
    }

    private static ChatMessage MapToDomain(ChatMessageModel model)
    {
        return ChatMessage.Reconstitute(
            model.Id,
            model.RequestId,
            model.SenderId,
            model.SenderName,
            model.SenderType,
            model.Message,
            model.Read,
            model.CreatedAt);
    }

    private static ChatMessageModel MapToModel(ChatMessage message)
    {
        return new ChatMessageModel
        {
            Id = message.Id,
            RequestId = message.RequestId,
            SenderId = message.SenderId,
            SenderName = message.SenderName,
            SenderType = message.SenderType.ToString().ToLowerInvariant(),
            Message = message.Message,
            Read = message.Read,
            CreatedAt = message.CreatedAt
        };
    }
}

public class NotificationRepository : INotificationRepository
{
    private readonly SupabaseClient _supabase;
    private const string TableName = "notifications";

    public NotificationRepository(SupabaseClient supabase)
    {
        _supabase = supabase;
    }

    public async Task<Notification?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await _supabase.GetSingleAsync<NotificationModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<Notification>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var models = await _supabase.GetAllAsync<NotificationModel>(
            TableName,
            filter: $"user_id=eq.{userId}&order=created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<Notification> CreateAsync(Notification notification, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(notification);
        var created = await _supabase.InsertAsync<NotificationModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<Notification> UpdateAsync(Notification notification, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(notification);
        var updated = await _supabase.UpdateAsync<NotificationModel>(
            TableName,
            $"id=eq.{notification.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    public async Task MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await _supabase.UpdateAsync<NotificationModel>(
            TableName,
            $"user_id=eq.{userId}",
            new { read = true },
            cancellationToken);
    }

    private static Notification MapToDomain(NotificationModel model)
    {
        return Notification.Reconstitute(
            model.Id,
            model.UserId,
            model.Title,
            model.Message,
            model.NotificationType,
            model.Read,
            model.Data,
            model.CreatedAt);
    }

    private static NotificationModel MapToModel(Notification notification)
    {
        return new NotificationModel
        {
            Id = notification.Id,
            UserId = notification.UserId,
            Title = notification.Title,
            Message = notification.Message,
            NotificationType = notification.NotificationType.ToString().ToLowerInvariant(),
            Read = notification.Read,
            Data = notification.Data,
            CreatedAt = notification.CreatedAt
        };
    }
}

public class VideoRoomRepository : IVideoRoomRepository
{
    private readonly SupabaseClient _supabase;
    private const string TableName = "video_rooms";

    public VideoRoomRepository(SupabaseClient supabase)
    {
        _supabase = supabase;
    }

    public async Task<VideoRoom?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await _supabase.GetSingleAsync<VideoRoomModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<VideoRoom?> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        var model = await _supabase.GetSingleAsync<VideoRoomModel>(
            TableName,
            filter: $"request_id=eq.{requestId}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<VideoRoom> CreateAsync(VideoRoom videoRoom, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(videoRoom);
        var created = await _supabase.InsertAsync<VideoRoomModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<VideoRoom> UpdateAsync(VideoRoom videoRoom, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(videoRoom);
        var updated = await _supabase.UpdateAsync<VideoRoomModel>(
            TableName,
            $"id=eq.{videoRoom.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    private static VideoRoom MapToDomain(VideoRoomModel model)
    {
        return VideoRoom.Reconstitute(
            model.Id,
            model.RequestId,
            model.RoomName,
            model.RoomUrl,
            model.Status,
            model.StartedAt,
            model.EndedAt,
            model.DurationSeconds,
            model.CreatedAt);
    }

    private static VideoRoomModel MapToModel(VideoRoom room)
    {
        return new VideoRoomModel
        {
            Id = room.Id,
            RequestId = room.RequestId,
            RoomName = room.RoomName,
            RoomUrl = room.RoomUrl,
            Status = room.Status.ToString().ToLowerInvariant(),
            StartedAt = room.StartedAt,
            EndedAt = room.EndedAt,
            DurationSeconds = room.DurationSeconds,
            CreatedAt = room.CreatedAt
        };
    }
}

public class PushTokenRepository : IPushTokenRepository
{
    private readonly SupabaseClient _supabase;
    private const string TableName = "push_tokens";

    public PushTokenRepository(SupabaseClient supabase)
    {
        _supabase = supabase;
    }

    public async Task<PushToken?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await _supabase.GetSingleAsync<PushTokenModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<PushToken>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var models = await _supabase.GetAllAsync<PushTokenModel>(
            TableName,
            filter: $"user_id=eq.{userId}&active=eq.true",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<PushToken> CreateAsync(PushToken pushToken, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(pushToken);
        var created = await _supabase.InsertAsync<PushTokenModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task DeleteByTokenAsync(string token, Guid userId, CancellationToken cancellationToken = default)
    {
        // Instead of deleting, mark as inactive
        await _supabase.UpdateAsync<PushTokenModel>(
            TableName,
            $"token=eq.{token}&user_id=eq.{userId}",
            new { active = false },
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
