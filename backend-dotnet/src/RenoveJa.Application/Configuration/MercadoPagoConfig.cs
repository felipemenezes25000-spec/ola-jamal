namespace RenoveJa.Application.Configuration;

public class MercadoPagoConfig
{
    public const string SectionName = "MercadoPago";
    public string AccessToken { get; set; } = "";
    public string? NotificationUrl { get; set; }
    public string? PublicKey { get; set; }
    public string? WebhookSecret { get; set; }
    public string? RedirectBaseUrl { get; set; }
}
