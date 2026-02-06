namespace RenoveJa.Application.Configuration;

/// <summary>
/// Configuração para login com Google (Client ID do OAuth 2.0).
/// </summary>
public class GoogleAuthConfig
{
    /// <summary>Client ID do aplicativo Google (Console do Google Cloud → Credenciais → ID do cliente OAuth 2.0).</summary>
    public string ClientId { get; set; } = string.Empty;
}
