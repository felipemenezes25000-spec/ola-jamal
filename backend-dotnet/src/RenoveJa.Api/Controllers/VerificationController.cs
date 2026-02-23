using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Http;
using RenoveJa.Application.DTOs.Verification;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller público (sem autenticação) para verificação de receitas digitais.
///
/// A verificação pública para farmacêuticos e pacientes é feita exclusivamente via:
///   - Frontend web: https://renovejasaude.com.br/verify/{id}
///   - Supabase Edge Function: POST /functions/v1/verify
///
/// Este controller mantém:
///   1. GET  /api/verify/{id} — protocolo ITI (validar.iti.gov.br) para validação de assinatura PAdES ICP-Brasil.
///      Responde SOMENTE quando _format=application/validador-iti+json está presente; caso contrário redireciona
///      para o frontend-web.
///   2. POST /api/verify/{id}/full — ponte de retrocompatibilidade para clientes legados com código de 4 dígitos.
///   3. GET  /api/verify/{id}/document?code=xxx — stream do PDF após validar código de 6 dígitos (uso pelo frontend web).
/// </summary>
[ApiController]
[Route("api/verify")]
[EnableRateLimiting("verify")]
public class VerificationController(
    IVerificationService verificationService,
    IPrescriptionVerifyRepository prescriptionVerifyRepository,
    IRequestRepository requestRepository,
    IHttpClientFactory httpClientFactory,
    ILogger<VerificationController> logger) : ControllerBase
{
    /// <summary>
    /// Endpoint exclusivo para o protocolo ITI (validar.iti.gov.br).
    /// Quando chamado sem o parâmetro _format, redireciona para o frontend-web de verificação.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetItiVerification(
        Guid id,
        [FromQuery] string? _format,
        [FromQuery] string? _secretCode,
        CancellationToken cancellationToken)
    {
        // Protocolo ITI: validar.iti.gov.br chama com _format=application/validador-iti+json e _secretCode
        if (string.Equals(_format, "application/validador-iti+json", StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrWhiteSpace(_secretCode))
        {
            logger.LogInformation("Verify ITI: requestId={RequestId}", id);
            try
            {
                var full = await verificationService.GetFullVerificationAsync(id, _secretCode.Trim(), cancellationToken);
                if (full == null)
                    return NotFound(new { error = "Receita não encontrada." });

                if (string.IsNullOrWhiteSpace(full.SignedDocumentUrl))
                    return NotFound(new { error = "Documento assinado não disponível para esta receita." });

                return Ok(new
                {
                    version = "1.0.0",
                    prescription = new
                    {
                        signatureFiles = new[] { new { url = full.SignedDocumentUrl } }
                    }
                });
            }
            catch (UnauthorizedAccessException)
            {
                return StatusCode(401, new { error = "Código de acesso inválido." });
            }
        }

        // Acesso regular (farmacêutico escaneando QR): redireciona para o frontend-web.
        // O frontend-web chama a Supabase Edge Function para verificação.
        logger.LogInformation("Verify redirect to frontend-web: requestId={RequestId}", id);
        return RedirectPermanent($"/verify/{id}");
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
