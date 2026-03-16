using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller que expõe o status das integrações externas (Mercado Pago, PDF, push, vídeo).
/// </summary>
[ApiController]
[Route("api/integrations")]
public class IntegrationsController(IHttpClientFactory httpFactory, IMemoryCache cache, ILogger<IntegrationsController> logger) : ControllerBase
{
    /// <summary>
    /// Retorna a chave pública do Mercado Pago para uso no frontend (Card Payment Brick, tokenização).
    /// </summary>
    [HttpGet("mercadopago-public-key")]
    [AllowAnonymous]
    public IActionResult GetMercadoPagoPublicKey()
    {
        return Ok(new { publicKey = (string?)null, message = "Fluxo de pagamento desativado." });
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

    private Task<object> GetMercadoPagoStatusAsync(CancellationToken ct)
    {
        return Task.FromResult<object>(new { status = "disabled", message = "Fluxo de pagamento desativado." });
    }
}
