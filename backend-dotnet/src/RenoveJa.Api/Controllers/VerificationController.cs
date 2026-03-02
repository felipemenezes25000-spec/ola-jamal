using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Http;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Verification;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller público (sem autenticação) para verificação de receitas digitais.
///
/// O QR Code da receita aponta para <c>GET /api/verify/{id}</c>.
/// O Validador ITI (validar.iti.gov.br) chama com <c>_format=application/validador-iti+json</c>
/// e <c>_secretCode</c>; browsers normais são redirecionados para o frontend-web.
///
/// Endpoints:
///   1. GET  /api/verify/{id}              — protocolo ITI + redirect para frontend.
///   2. POST /api/verify/{id}/full         — retrocompatibilidade (código de 4 dígitos).
///   3. GET  /api/verify/{id}/document     — stream do PDF após validar código.
/// </summary>
[ApiController]
[Route("api/verify")]
[EnableRateLimiting("verify")]
public class VerificationController(
    IVerificationService verificationService,
    IPrescriptionVerifyRepository prescriptionVerifyRepository,
    IRequestRepository requestRepository,
    IHttpClientFactory httpClientFactory,
    IOptions<VerificationConfig> verificationConfig,
    IOptions<ApiConfig> apiConfig,
    ILogger<VerificationController> logger) : ControllerBase
{
    /// <summary>
    /// Endpoint unificado: protocolo ITI + redirect para frontend.
    /// <para>
    /// Com <c>_format=application/validador-iti+json</c> e <c>_secretCode</c>: responde JSON do ITI.
    /// Sem esses parâmetros: redireciona para o frontend de verificação.
    /// </para>
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetItiVerification(
        Guid id,
        [FromQuery] string? _format,
        [FromQuery] string? _secretCode,
        CancellationToken cancellationToken)
    {
        if (string.Equals(_format, "application/validador-iti+json", StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrWhiteSpace(_secretCode))
        {
            logger.LogInformation("Verify ITI: requestId={RequestId}", id);
            try
            {
                var code = _secretCode.Trim();
                var full = await verificationService.GetFullVerificationAsync(id, code, cancellationToken);
                if (full == null)
                    return NotFound(new { error = "Receita não encontrada." });

                if (string.IsNullOrWhiteSpace(full.SignedDocumentUrl))
                    return NotFound(new { error = "Documento assinado não disponível para esta receita." });

                var apiBase = (apiConfig.Value?.BaseUrl ?? "").TrimEnd('/');
                var pdfUrl = !string.IsNullOrEmpty(apiBase)
                    ? $"{apiBase}/api/verify/{id}/document?code={Uri.EscapeDataString(code)}"
                    : full.SignedDocumentUrl;

                return Ok(new
                {
                    version = "1.0.0",
                    prescription = new
                    {
                        signatureFiles = new[] { new { url = pdfUrl } }
                    }
                });
            }
            catch (UnauthorizedAccessException)
            {
                return StatusCode(401, new { error = "Código de acesso inválido." });
            }
        }

        var frontendUrl = verificationConfig.Value?.FrontendUrl?.TrimEnd('/');
        if (!string.IsNullOrWhiteSpace(frontendUrl))
        {
            logger.LogInformation("Verify redirect to frontend: requestId={RequestId}", id);
            return Redirect($"{frontendUrl}/{id}");
        }

        logger.LogInformation("Verify redirect (relative): requestId={RequestId}", id);
        return Redirect($"/verify/{id}");
    }

    /// <summary>
    /// Retrocompatibilidade: valida o código de 4 dígitos e retorna dados completos da receita.
    /// Clientes novos devem usar a Supabase Edge Function (POST /functions/v1/verify) com código de 6 dígitos.
    /// </summary>
    [HttpPost("{id:guid}/full")]
    public async Task<IActionResult> GetFullVerification(
        Guid id,
        [FromBody] VerifyAccessCodeRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.AccessCode))
            return BadRequest(new { error = "Código de acesso é obrigatório." });

        try
        {
            var result = await verificationService.GetFullVerificationAsync(id, request.AccessCode, cancellationToken);
            if (result == null)
                return NotFound(new { error = "Receita não encontrada." });

            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(403, new { error = "Código de acesso inválido." });
        }
    }

    /// <summary>
    /// Stream do PDF assinado após validar código de 6 dígitos.
    /// Usado pelo frontend web quando o usuário clica em "Baixar PDF (2ª via)" após verificação.
    /// A Edge Function verify retorna downloadUrl apontando para este endpoint com domínio próprio.
    /// </summary>
    [HttpGet("{id:guid}/document")]
    public async Task<IActionResult> GetDocument(
        Guid id,
        [FromQuery] string? code,
        CancellationToken cancellationToken)
    {
        var trimmed = code?.Trim() ?? "";
        if (trimmed.Length != 4 && trimmed.Length != 6)
            return BadRequest(new { error = "Código de verificação inválido. Informe o código de 4 ou 6 dígitos do documento." });

        var valid = await prescriptionVerifyRepository.ValidateVerifyCodeAsync(id, trimmed, cancellationToken);
        if (!valid)
            return Unauthorized(new { error = "Código inválido ou expirado." });

        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null || string.IsNullOrWhiteSpace(request.SignedDocumentUrl))
            return NotFound(new { error = "Documento assinado não disponível." });

        try
        {
            using var client = httpClientFactory.CreateClient();
            var bytes = await client.GetByteArrayAsync(request.SignedDocumentUrl, cancellationToken);
            if (bytes == null || bytes.Length == 0)
                return NotFound(new { error = "Documento não encontrado." });
            return File(bytes, "application/pdf", $"receita-{id}.pdf");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falha ao buscar PDF para verificação requestId={RequestId}", id);
            return StatusCode(500, new { error = "Erro ao obter o documento. Tente novamente." });
        }
    }
}
