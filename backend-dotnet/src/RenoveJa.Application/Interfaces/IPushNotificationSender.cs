using RenoveJa.Application.DTOs.Notifications;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Envia notificações push reais (Expo Push) para o dispositivo do usuário.
/// </summary>
public interface IPushNotificationSender
{
    /// <summary>
    /// Envia push simples (legado). Usar SendAsync(PushNotificationRequest) quando possível.
    /// </summary>
    Task SendAsync(Guid userId, string title, string body, Dictionary<string, object?>? data = null, CancellationToken ct = default);

    /// <summary>
    /// Envia push com payload completo da spec (collapseKey, canal, prioridade, deepLink).
    /// </summary>
    Task SendAsync(PushNotificationRequest request, CancellationToken ct = default);
}
