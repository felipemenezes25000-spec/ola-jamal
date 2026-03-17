using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Api.Controllers;

[ApiController]
[Route("api/documents")]
public class DocumentVerifyController(
    IMedicalDocumentRepository documentRepository,
    IDocumentAccessLogRepository accessLogRepository,
    IDocumentSecurityService securityService,
    IPushNotificationDispatcher pushDispatcher,
    ILogger<DocumentVerifyController> logger) : ControllerBase
{
    /// <summary>
    /// Verifica autenticidade de qualquer documento médico (receita, atestado, exame).
    /// Público — não requer autenticação.
    /// </summary>
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    [HttpPost("verify")]
    public async Task<IActionResult> VerifyDocument(
        [FromBody] VerifyDocumentRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.DocumentId) || string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(new { status = "error", reason = "MISSING_FIELDS", message = "ID e código são obrigatórios." });

        if (!Guid.TryParse(request.DocumentId, out var docId))
            return BadRequest(new { status = "error", reason = "INVALID_ID", message = "ID inválido." });

        try
        {
            var doc = await documentRepository.GetByIdAsync(docId, ct);
            if (doc == null)
                return Ok(new { status = "invalid", reason = "NOT_FOUND", message = "Documento não encontrado." });

            // Validar código de verificação
            var security = await documentRepository.GetSecurityFieldsAsync(docId, ct);
            if (security.HasValue && !string.IsNullOrEmpty(security.Value.verifyCodeHash))
            {
                if (!securityService.ValidateVerifyCode(request.Code, security.Value.verifyCodeHash))
                    return Ok(new { status = "invalid", reason = "INVALID_CODE", message = "Código inválido." });
            }
            else if (security.HasValue && !string.IsNullOrEmpty(security.Value.accessCode))
            {
                // Fallback: comparar access_code direto (legado)
                if (request.Code.Trim() != security.Value.accessCode.Trim())
                    return Ok(new { status = "invalid", reason = "INVALID_CODE", message = "Código inválido." });
            }
            else
            {
                // Neither verifyCodeHash nor accessCode is set — cannot verify authenticity
                return Ok(new { status = "error", reason = "NO_CODE_CONFIGURED", message = "Documento sem código de verificação configurado. Não é possível validar." });
            }

            // Verificar status
            if (doc.Status == Domain.Enums.DocumentStatus.Revoked)
                return Ok(new { status = "invalid", reason = "REVOKED", message = "Documento revogado." });

            if (doc.SignedAt == null)
                return Ok(new { status = "invalid", reason = "NOT_SIGNED", message = "Documento ainda não assinado." });

            // Verificar validade
            var isExpired = security?.expiresAt.HasValue == true && security.Value.expiresAt < DateTime.UtcNow;
            if (isExpired)
                return Ok(new { status = "invalid", reason = "EXPIRED", message = "Documento expirado." });

            // Verificar dispensação prévia
            var dispenseCount = await accessLogRepository.GetDispenseCountAsync(docId, ct);
            var wasDispensed = dispenseCount > 0;

            // Log de acesso (verificação)
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            await securityService.LogAccessAsync(
                docId, null, null, "verified", "verifier", ip,
                HttpContext.Request.Headers.UserAgent.ToString(), ct);

            // Tipo do documento para label
            var typeLabel = doc.DocumentType switch
            {
                Domain.Enums.DocumentType.Prescription => "Receita médica",
                Domain.Enums.DocumentType.ExamOrder => "Pedido de exame",
                Domain.Enums.DocumentType.MedicalCertificate => "Atestado médico",
                Domain.Enums.DocumentType.MedicalReport => "Relatório médico",
                _ => "Documento médico"
            };

            // Notificar paciente (fire-and-forget com CancellationToken.None para não cancelar ao enviar response)
            _ = pushDispatcher.SendAsync(
                    PushNotificationRules.DocumentVerified(doc.PatientId, typeLabel), CancellationToken.None)
                .ContinueWith(t =>
                {
                    if (t.IsFaulted)
                        logger.LogDebug(t.Exception?.InnerException, "Failed to notify patient about verification");
                }, TaskScheduler.Default);

            return Ok(new
            {
                status = "valid",
                documentType = typeLabel,
                documentTypeCode = doc.DocumentType.ToString().ToLowerInvariant(),
                signedAt = doc.SignedAt?.ToString("o"),
                issuedAt = doc.CreatedAt.ToString("o"),
                expiresAt = security?.expiresAt?.ToString("o"),
                wasDispensed,
                dispenseCount,
                dispensedWarning = wasDispensed
                    ? $"⚠️ Documento já verificado/dispensado {dispenseCount} vez(es)."
                    : null,
                verificationUrl = "https://validar.iti.gov.br",
                message = wasDispensed
                    ? $"Documento válido, porém já dispensado anteriormente ({dispenseCount}x)."
                    : "Documento válido — assinado digitalmente com certificado ICP-Brasil."
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Verify failed for document {DocumentId}", request.DocumentId);
            return Ok(new { status = "error", message = "Erro ao verificar documento." });
        }
    }

    /// <summary>
    /// Marca documento como dispensado (farmacêutico confirma dispensação).
    /// </summary>
    [Microsoft.AspNetCore.Authorization.Authorize]
    [HttpPost("{documentId}/dispense")]
    public async Task<IActionResult> DispenseDocument(
        Guid documentId,
        [FromBody] DispenseRequest request,
        CancellationToken ct)
    {
        try
        {
            var doc = await documentRepository.GetByIdAsync(documentId, ct);
            if (doc == null) return NotFound(new { error = "Documento não encontrado." });
            if (doc.SignedAt == null) return BadRequest(new { error = "Documento não assinado." });

            var dispenseCount = await accessLogRepository.GetDispenseCountAsync(documentId, ct);
            // Controladas: máximo 1 dispensação
            if (dispenseCount >= 1 && doc.DocumentType == Domain.Enums.DocumentType.Prescription)
                return BadRequest(new { error = "Receita já dispensada. Não é permitido dispensar novamente.", alreadyDispensed = true });

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            await securityService.RecordDispensationAsync(documentId, request.PharmacyName ?? "Não informado", ip, ct);

            return Ok(new { success = true, message = "Documento marcado como dispensado.", dispenseCount = dispenseCount + 1 });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Dispense failed for document {DocumentId}", documentId);
            return BadRequest(new { error = "Erro ao registrar dispensação. Tente novamente." });
        }
    }
}

public record VerifyDocumentRequest(string DocumentId, string Code);
public record DispenseRequest(string? PharmacyName);
