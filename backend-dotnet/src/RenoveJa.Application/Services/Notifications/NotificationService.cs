using RenoveJa.Application.DTOs;
using RenoveJa.Application.DTOs.Notifications;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Notifications;

/// <summary>
/// Serviço de notificações do usuário.
/// </summary>
public interface INotificationService
{
    Task<List<NotificationResponseDto>> GetUserNotificationsAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<PagedResponse<NotificationResponseDto>> GetUserNotificationsPagedAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<NotificationResponseDto> MarkAsReadAsync(Guid id, CancellationToken cancellationToken = default);
    Task MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Implementação do serviço de notificações (listar, marcar lida, marcar todas).
/// </summary>
public class NotificationService(INotificationRepository notificationRepository) : INotificationService
{
    /// <summary>
    /// Lista notificações do usuário.
    /// </summary>
    public async Task<List<NotificationResponseDto>> GetUserNotificationsAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var notifications = await notificationRepository.GetByUserIdAsync(userId, cancellationToken);
        return notifications.Select(MapToDto).ToList();
    }

    /// <summary>
    /// Lista notificações do usuário com paginação.
    /// </summary>
    public async Task<PagedResponse<NotificationResponseDto>> GetUserNotificationsPagedAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var allNotifications = await notificationRepository.GetByUserIdAsync(userId, cancellationToken);
        var totalCount = allNotifications.Count;
        var offset = (page - 1) * pageSize;
        var items = allNotifications.Skip(offset).Take(pageSize).Select(MapToDto).ToList();

        return new PagedResponse<NotificationResponseDto>(items, totalCount, page, pageSize);
    }

    /// <summary>
    /// Marca uma notificação como lida.
    /// </summary>
    public async Task<NotificationResponseDto> MarkAsReadAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var notification = await notificationRepository.GetByIdAsync(id, cancellationToken);
        if (notification == null)
            throw new KeyNotFoundException("Notification not found");

        notification.MarkAsRead();
        notification = await notificationRepository.UpdateAsync(notification, cancellationToken);

        return MapToDto(notification);
    }

    /// <summary>
    /// Marca todas as notificações do usuário como lidas.
    /// </summary>
    public async Task MarkAllAsReadAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        await notificationRepository.MarkAllAsReadAsync(userId, cancellationToken);
    }

    private static NotificationResponseDto MapToDto(Notification notification)
    {
        return new NotificationResponseDto(
            notification.Id,
            notification.UserId,
            notification.Title,
            notification.Message,
            notification.NotificationType.ToString().ToLowerInvariant(),
            notification.Read,
            notification.Data,
            notification.CreatedAt);
    }
}
