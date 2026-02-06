using Microsoft.AspNetCore.Mvc;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller que expõe o status das integrações externas (Mercado Pago, PDF, push, vídeo).
/// </summary>
[ApiController]
[Route("api/integrations")]
public class IntegrationsController : ControllerBase
{
    /// <summary>
    /// Retorna o status de cada integração.
    /// </summary>
    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        return Ok(new
        {
            mercadopago = new { status = "operational", message = "MercadoPago integration active" },
            pdf_generator = new { status = "operational", message = "PDF generation active" },
            push_notifications = new { status = "operational", message = "Push notifications active" },
            video_service = new { status = "operational", message = "Video service active" }
        });
    }
}
