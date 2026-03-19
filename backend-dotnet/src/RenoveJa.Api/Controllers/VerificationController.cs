using Microsoft.AspNetCore.Cors;
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
///   4. POST /api/verify/{id}/dispense     — marca receita como dispensada (controle especial).
/// </summary>
[ApiController]
[Route("api/verify")]
[EnableRateLimiting("verify")]
[EnableCors("VerifyCors")]
public class VerificationController(
    IVerificationService verificationService,
    IPrescriptionVerifyRepository prescriptionVerifyRepository,
    IPrescriptionVerificationLogRepository verificationLogRepository,
    IRequestRepository requestRepository,
    IHttpClientFactory httpClientFactory,
    IStorageService storageService,
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
        // Guia ITI Cap. IV: _format deve ser "application/validador-iti+json" (literal).
        // Em query strings, + é decodificado como espaço, então aceitar ambas as formas.
        var formatMatch = string.Equals(_format, "application/validador-iti+json", StringComparison.Ordinal)
            || string.Equals(_format, "application/validador-iti json", StringComparison.Ordinal);
        if (formatMatch && !string.IsNullOrWhiteSpace(_secretCode))
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
                if (string.IsNullOrEmpty(apiBase))
                    apiBase = $"{Request.Scheme}://{Request.Host}";
                var pdfUrl = $"{apiBase}/api/verify/{id}/document?code={Uri.EscapeDataString(code)}";

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
    /// Clientes novos devem usar POST /api/prescriptions/verify com codigo de 6 dígitos.
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
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = HttpContext.Request.Headers.UserAgent.ToString();

        if (trimmed.Length != 4 && trimmed.Length != 6)
        {
            await verificationLogRepository.LogAsync(id, "download", "invalid_code_format", ip, userAgent, cancellationToken);
            return BadRequest(new { error = "Código de verificação inválido. Informe o código de 4 ou 6 dígitos do documento." });
        }

        var valid = await prescriptionVerifyRepository.ValidateVerifyCodeAsync(id, trimmed, cancellationToken);
        if (!valid)
        {
            await verificationLogRepository.LogAsync(id, "download", "invalid_code", ip, userAgent, cancellationToken);
            return Unauthorized(new { error = "Código inválido ou expirado." });
        }

        if (await prescriptionVerifyRepository.IsDispensedAsync(id, cancellationToken))
        {
            await verificationLogRepository.LogAsync(id, "download", "blocked_dispensed", ip, userAgent, cancellationToken);
            return StatusCode(403, new { error = "Download bloqueado. Esta receita já foi dispensada na farmácia." });
        }

        var maxDownloads = verificationConfig.Value?.MaxDownloadsPerPrescription ?? 10;
        var downloadCount = await verificationLogRepository.GetDownloadCountAsync(id, cancellationToken);
        if (downloadCount >= maxDownloads)
        {
            await verificationLogRepository.LogAsync(id, "download", "blocked_limit", ip, userAgent, cancellationToken);
            return StatusCode(403, new { error = $"Limite de downloads atingido ({maxDownloads} por receita). Contate o suporte se precisar de outra via." });
        }

        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null || string.IsNullOrWhiteSpace(request.SignedDocumentUrl))
            return NotFound(new { error = "Documento assinado não disponível." });

        try
        {
            var refOrUrl = request.SignedDocumentUrl.Trim();

            byte[]? bytes = null;

            // Caso novo (recomendado): salvamos PATH, ex.: "signed/abc.pdf"
            if (!refOrUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            {
                bytes = await storageService.DownloadAsync(refOrUrl, cancellationToken);
            }
            else
            {
                // Caso legado: URL publica de storage (pode falhar se bucket for privado)
                bytes = await storageService.DownloadFromStorageUrlAsync(refOrUrl, cancellationToken);

                // Fallback final: se não for URL do nosso storage, tenta HTTP normal
                if (bytes == null)
                {
                    using var client = httpClientFactory.CreateClient();
                    bytes = await client.GetByteArrayAsync(refOrUrl, cancellationToken);
                }
            }

            if (bytes == null || bytes.Length == 0)
                return NotFound(new { error = "Documento não encontrado." });

            await verificationLogRepository.LogAsync(id, "download", "success", ip, userAgent, cancellationToken);

            // inline para compatibilidade com validar.iti.gov.br (evita problemas ao processar via URL)
            Response.Headers.ContentDisposition = $"inline; filename=\"receita-{id}.pdf\"";
            return File(bytes, "application/pdf");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falha ao buscar PDF para verificação requestId={RequestId}", id);
            return StatusCode(500, new { error = "Erro ao obter o documento. Tente novamente." });
        }
    }

    public sealed class DispenseRequest
    {
        public string? AccessCode { get; set; }
        public string? PharmacyName { get; set; }
        public string? PharmacistName { get; set; }
    }

    /// <summary>
    /// Marca uma prescrição como dispensada (uso único para controlados).
    /// </summary>
    [HttpPost("{id:guid}/dispense")]
    public async Task<IActionResult> MarkDispensed(
        Guid id,
        [FromBody] DispenseRequest request,
        CancellationToken cancellationToken)
    {
        var code = request.AccessCode?.Trim() ?? string.Empty;
        if (code.Length != 4 && code.Length != 6)
            return BadRequest(new { error = "Código de verificação inválido." });

        var valid = await prescriptionVerifyRepository.ValidateVerifyCodeAsync(id, code, cancellationToken);
        if (!valid)
            return Unauthorized(new { error = "Código inválido ou expirado." });

        if (await prescriptionVerifyRepository.IsDispensedAsync(id, cancellationToken))
            return Conflict(new { error = "Prescrição já dispensada." });

        var pharmacy = (request.PharmacyName ?? string.Empty).Trim();
        var pharmacist = (request.PharmacistName ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(pharmacy) || string.IsNullOrWhiteSpace(pharmacist))
            return BadRequest(new { error = "Informe nome da farmácia e farmacêutico(a)." });

        var ok = await prescriptionVerifyRepository.MarkAsDispensedAsync(id, pharmacy, pharmacist, cancellationToken);
        if (!ok)
            return Conflict(new { error = "Prescrição já dispensada." });

        return Ok(new { success = true, dispensedAt = DateTime.UtcNow, pharmacy, pharmacist });
    }
}
