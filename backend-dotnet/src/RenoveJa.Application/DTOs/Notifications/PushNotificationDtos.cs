namespace RenoveJa.Application.DTOs.Notifications;

/// <summary>
/// Canal Android: default = heads-up (MAX), quiet = sem heads-up (DEFAULT).
/// </summary>
public enum PushChannel
{
    Default, // Ação imediata: pagar, entrar na consulta, documento pronto
    Quiet    // Informativo: em análise, lembretes não urgentes
}

/// <summary>
/// Categoria para roteamento e preferências do usuário.
/// </summary>
public enum PushCategory
{
    Requests,
    Payments,
    Consultations,
    Reminders,
    System
}

/// <summary>
/// Payload padrão para push conforme spec — sempre incluir para deep link + roteamento.
/// </summary>
public record PushNotificationPayload(
    string Type,
    string DeepLink,
    PushCategory Category,
    string CollapseKey,
    long Ts,
    string? RequestId = null,
    string? RequestType = null,
    string? Status = null,
    IReadOnlyDictionary<string, object?>? Extra = null
);

/// <summary>
/// Request completa para envio de push com todos os parâmetros da spec.
/// </summary>
public record PushNotificationRequest(
    Guid UserId,
    string Title,
    string Body,
    PushNotificationPayload Payload,
    PushChannel Channel = PushChannel.Default,
    bool HighPriority = true,
    /// <summary>Se true, ignora quiet hours (ex.: pagamento confirmado, documento assinado).</summary>
    bool BypassQuietHours = false
);
