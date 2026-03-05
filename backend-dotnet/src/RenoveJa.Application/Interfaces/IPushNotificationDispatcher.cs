using RenoveJa.Application.DTOs.Notifications;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Dispatcher centralizado de push: deduplicação, persistência in-app e envio conforme spec.
/// </summary>
public interface IPushNotificationDispatcher
{
    Task SendAsync(PushNotificationRequest request, CancellationToken ct = default);
    Task PersistInAppOnlyAsync(PushNotificationRequest request, CancellationToken ct = default);
}
