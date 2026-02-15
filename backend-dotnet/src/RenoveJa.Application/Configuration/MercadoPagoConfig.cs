namespace RenoveJa.Application.Configuration;

public class MercadoPagoConfig
{
    public const string SectionName = "MercadoPago";

    public string AccessToken { get; set; } = string.Empty;
    public string? NotificationUrl { get; set; }
    /// <summary>Chave pública para uso no frontend (tokenização de cartão, etc.).</summary>
    public string? PublicKey { get; set; }
    /// <summary>Assinatura secreta do webhook (painel MP → Webhooks). Usada para validar que a notificação veio do Mercado Pago.</summary>
    public string? WebhookSecret { get; set; }
    /// <summary>URL base para redirecionamento após pagamento no Checkout Pro (ex: https://seusite.com.br). Usado em success/pending/failure.</summary>
    public string? RedirectBaseUrl { get; set; }
}
