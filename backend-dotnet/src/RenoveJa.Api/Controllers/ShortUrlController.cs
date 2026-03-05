using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.Services;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Encurtador de URL para receitas — estilo Docway (re.mevosaude.com.br/XXX).
/// GET /r/{shortCode} redireciona para /api/verify/{id}?type=prescricao.
/// O shortCode é o GUID codificado em Base64Url (22 caracteres).
/// </summary>
[ApiController]
[Route("r")]
public class ShortUrlController : ControllerBase
{
    /// <summary>
    /// Redireciona /r/{shortCode} para /api/verify/{id}?type=prescricao.
    /// O validador ITI e browsers seguem o redirect normalmente.
    /// </summary>
    [HttpGet("{shortCode}")]
    public IActionResult RedirectToVerify(
        [FromRoute] string shortCode,
        [FromQuery] string? type)
    {
        if (string.IsNullOrWhiteSpace(shortCode))
            return BadRequest();

        var id = ShortUrlEncoder.Decode(shortCode.Trim());
        if (id == null)
            return NotFound(new { error = "Link inválido ou expirado." });

        var typeParam = !string.IsNullOrWhiteSpace(type) ? type : "prescricao";
        var verifyPath = $"/api/verify/{id}?type={Uri.EscapeDataString(typeParam)}";
        return Redirect(verifyPath);
    }
}
