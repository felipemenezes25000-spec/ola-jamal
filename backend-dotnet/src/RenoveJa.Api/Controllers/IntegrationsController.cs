using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller que expõe o status das integrações externas (Mercado Pago, PDF, push, vídeo).
/// </summary>
[ApiController]
[Route("api/integrations")]
public class IntegrationsController(IOptions<MercadoPagoConfig> mpConfig, IHttpClientFactory httpFactory, IMemoryCache cache, ILogger<IntegrationsController> logger) : ControllerBase
{
    /// <summary>
    /// Retorna a chave pública do Mercado Pago para uso no frontend (Card Payment Brick, tokenização).
    /// </summary>
    [HttpGet("mercadopago-public-key")]
    [AllowAnonymous]
    public IActionResult GetMercadoPagoPublicKey()
    {
        logger.LogInformation("Integrations GetMercadoPagoPublicKey");
        var key = mpConfig.Value.PublicKey;
        if (string.IsNullOrWhiteSpace(key))
            return Ok(new { publicKey = (string?)null, message = "MercadoPago:PublicKey não configurada em appsettings." });
        return Ok(new { publicKey = key });
    }

    /// <summary>
    /// Retorna o status de cada integração. Mercado Pago: valida o token em tempo real.
    /// Resultado cacheado por 5 minutos.
    /// </summary>
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus(CancellationToken ct = default)
    {
        logger.LogInformation("Integrations GetStatus");
        const string cacheKey = "integrations_status";
        if (!cache.TryGetValue(cacheKey, out object? cachedResult))
        {
            var mpStatus = await GetMercadoPagoStatusAsync(ct);
            cachedResult = new
            {
                mercadopago = mpStatus,
                pdf_generator = new { status = "operational", message = "PDF generation active" },
                push_notifications = new { status = "operational", message = "Push notifications active" },
                video_service = new { status = "operational", message = "Video service active" }
            };
            cache.Set(cacheKey, cachedResult, TimeSpan.FromMinutes(5));
        }
        return Ok(cachedResult);
    }

    private async Task<object> GetMercadoPagoStatusAsync(CancellationToken ct)
    {
        var token = mpConfig.Value.AccessToken;
        if (string.IsNullOrWhiteSpace(token) || token.Contains("YOUR_") || token.Contains("_HERE"))
            return new { status = "not_configured", message = "MercadoPago:AccessToken não configurado em appsettings." };

        try
        {
            var client = httpFactory.CreateClient();
            client.DefaultRequestHeaders.Add("Authorization", "Bearer " + token);
            var res = await client.GetAsync("https://api.mercadopago.com/v1/payment_methods", ct);
            if (res.IsSuccessStatusCode)
                return new { status = "operational", message = "Token válido. PIX disponível." };
            if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                return new { status = "token_invalid", message = "Access Token inválido ou expirado. Veja docs/OBTER_TOKEN_MERCADOPAGO.md" };
            return new { status = "error", message = $"Mercado Pago retornou {(int)res.StatusCode}" };
        }
        catch (Exception ex)
        {
            return new { status = "error", message = ex.Message };
        }
    }
}
