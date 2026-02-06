using Microsoft.AspNetCore.Mvc;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller de health check da API.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    /// <summary>
    /// Retorna o status de saúde do serviço.
    /// </summary>
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            status = "healthy",
            timestamp = DateTime.UtcNow,
            service = "RenoveJa API",
            version = "1.0.0"
        });
    }
}
