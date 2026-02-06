namespace RenoveJa.Api.Controllers;

/// <summary>Request para registro de token de push (token e tipo de dispositivo).</summary>
public record RegisterPushTokenRequest(string Token, string? DeviceType = null);

/// <summary>Request para remoção de token de push.</summary>
public record UnregisterPushTokenRequest(string Token);
