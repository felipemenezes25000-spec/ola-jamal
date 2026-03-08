using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Endpoint público para formulário de contato institucional (landing).
/// </summary>
[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
[EnableRateLimiting("fixed")]
public class ContactController : ControllerBase
{
    private readonly IEmailService _emailService;
    private readonly ILogger<ContactController> _logger;

    public ContactController(IEmailService emailService, ILogger<ContactController> logger)
    {
        _emailService = emailService;
        _logger = logger;
    }

    /// <summary>
    /// Recebe dados do formulário de contato e envia e-mail HTML personalizado.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Post([FromBody] ContactRequest request, CancellationToken ct)
    {
        if (request == null)
            return BadRequest(new { error = "Corpo da requisição inválido." });

        var name = (request.Name ?? "").Trim();
        var email = (request.Email ?? "").Trim();
        var message = (request.Message ?? "").Trim();

        if (string.IsNullOrEmpty(name))
            return BadRequest(new { error = "Nome é obrigatório." });
        if (string.IsNullOrEmpty(email))
            return BadRequest(new { error = "E-mail é obrigatório." });
        if (string.IsNullOrEmpty(message))
            return BadRequest(new { error = "Mensagem é obrigatória." });

        try
        {
            await _emailService.SendContactFormEmailAsync(
                name,
                string.IsNullOrWhiteSpace(request.Cpf) ? null : request.Cpf.Trim(),
                string.IsNullOrWhiteSpace(request.Cnpj) ? null : request.Cnpj.Trim(),
                email,
                string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
                message,
                ct);

            _logger.LogInformation("Contato enviado: {Name} ({Email})", name, email);
            return Ok(new { ok = true, message = "Mensagem enviada com sucesso." });
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("Smtp"))
        {
            _logger.LogWarning(ex, "SMTP não configurado para contato");
            return StatusCode(503, new { error = "Serviço de e-mail indisponível. Tente o WhatsApp." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar contato");
            return StatusCode(500, new { error = "Falha ao enviar. Tente novamente ou use o WhatsApp." });
        }
    }

    public sealed class ContactRequest
    {
        public string? Name { get; set; }
        public string? Cpf { get; set; }
        public string? Cnpj { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? Message { get; set; }
    }
}
