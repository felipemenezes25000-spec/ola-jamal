namespace RenoveJa.Api.Controllers;

/// <summary>Request para registro de token de push (token e tipo de dispositivo).</summary>
public record RegisterPushTokenRequest(string Token, string? DeviceType = null);

/// <summary>Request para remoção de token de push.</summary>
public record UnregisterPushTokenRequest(string Token);

/// <summary>Request para preferência de notificações push (ativar/desativar).</summary>
public record PushPreferenceRequest(bool PushEnabled);

/// <summary>Preferências por categoria e timezone (quiet hours).</summary>
public record UserPushPreferencesRequest(
    bool? RequestsEnabled = null,
    bool? ConsultationsEnabled = null,
    bool? RemindersEnabled = null,
    string? Timezone = null
);
