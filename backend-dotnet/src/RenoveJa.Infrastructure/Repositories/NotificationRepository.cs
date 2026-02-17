using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de notificações via Supabase.
/// </summary>
public class NotificationRepository(SupabaseClient supabase) : INotificationRepository
{
    private const string TableName = "notifications";

    /// <summary>
    /// Obtém uma notificação pelo ID.
    /// </summary>
    public async Task<Notification?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<NotificationModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<Notification>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<NotificationModel>(
            TableName,
            filter: $"user_id=eq.{userId}&order=created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<Notification> CreateAsync(Notification notification, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(notification);
        var created = await supabase.InsertAsync<NotificationModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<Notification> UpdateAsync(Notification notification, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(notification);
        var updated = await supabase.UpdateAsync<NotificationModel>(
            TableName,
            $"id=eq.{notification.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    public async Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await supabase.CountAsync(
            TableName,
            $"user_id=eq.{userId}&read=eq.false",
            cancellationToken);
    }

    public async Task MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await supabase.UpdateAsync<NotificationModel>(
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
