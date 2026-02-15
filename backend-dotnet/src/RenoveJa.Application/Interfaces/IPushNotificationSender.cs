namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Envia notificações push reais (Expo Push) para o dispositivo do usuário.
/// </summary>
public interface IPushNotificationSender
{
    Task SendAsync(Guid userId, string title, string body, Dictionary<string, object?>? data = null, CancellationToken ct = default);
}
