using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller que expõe o status das integrações externas (PDF, push, vídeo).
/// </summary>
[ApiController]
[Route("api/integrations")]
[Authorize]
public class IntegrationsController(IMemoryCache cache, ILogger<IntegrationsController> logger) : ControllerBase
{
    /// <summary>
    /// Retorna o status de cada integração.
    /// Resultado cacheado por 5 minutos.
    /// </summary>
    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        logger.LogInformation("Integrations GetStatus");
        const string cacheKey = "integrations_status";
        if (!cache.TryGetValue(cacheKey, out object? cachedResult))
        {
            cachedResult = new
            {
                pdf_generator = new { status = "operational", message = "PDF generation active" },
                push_notifications = new { status = "operational", message = "Push notifications active" },
                video_service = new { status = "operational", message = "Video service active" }
            };
            cache.Set(cacheKey, cachedResult, TimeSpan.FromMinutes(5));
        }
        return Ok(cachedResult);
    }
}
