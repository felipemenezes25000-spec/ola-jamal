using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Api.Controllers;

[ApiController]
[Route("api/documents")]
[EnableRateLimiting("verify")]
[Microsoft.AspNetCore.Cors.EnableCors("VerifyCors")]
[Microsoft.AspNetCore.Authorization.AllowAnonymous]
public class DocumentVerifyController(
    IMedicalDocumentRepository documentRepository,
    IDocumentAccessLogRepository accessLogRepository,
    IDocumentSecurityService securityService,
    IRequestRepository requestRepository,
    IPushNotificationDispatcher pushDispatcher,
    IHttpClientFactory httpClientFactory,
    IStorageService storageService,
    IOptions<ApiConfig> apiConfig,
    IOptions<VerificationConfig> verificationConfig,
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
            if (doc.Status == Domain.Enums.DocumentStatus.Cancelled)
                return Ok(new { status = "invalid", reason = "CANCELLED", message = "Documento cancelado." });
            if (doc.Status == Domain.Enums.DocumentStatus.Superseded)
                return Ok(new { status = "invalid", reason = "SUPERSEDED", message = "Documento substituído por versão mais recente." });

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

            // Tipo do documento para label (MedicalReport sem leaveDays = encaminhamento)
            var typeLabel = doc switch
            {
                MedicalReport mr when !mr.LeaveDays.HasValue || mr.LeaveDays == 0 => "Encaminhamento",
                _ when doc.DocumentType == Domain.Enums.DocumentType.Prescription => "Receita médica",
                _ when doc.DocumentType == Domain.Enums.DocumentType.ExamOrder => "Pedido de exame",
                _ when doc.DocumentType == Domain.Enums.DocumentType.MedicalCertificate => "Atestado médico",
                _ when doc.DocumentType == Domain.Enums.DocumentType.MedicalReport => "Atestado médico",
                _ => "Documento médico"
            };

            // URL para download do PDF (público, valida código)
            var apiBase = (apiConfig?.Value?.BaseUrl ?? "").TrimEnd('/');
            if (string.IsNullOrEmpty(apiBase))
                apiBase = $"{Request.Scheme}://{Request.Host}";
            var downloadUrl = $"{apiBase}/api/documents/{docId}/document?code={Uri.EscapeDataString(request.Code)}";

            // Notificar paciente (fire-and-forget com CancellationToken.None para não cancelar ao enviar response)
            // Passa docId para que o collapseKey agrupe por documento+paciente (evita spam em múltiplas verificações)
            _ = pushDispatcher.SendAsync(
                    PushNotificationRules.DocumentVerified(doc.PatientId, docId, typeLabel), CancellationToken.None)
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
                downloadUrl,
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
    /// Stream do PDF assinado após validar código de verificação.
    /// Público — usado pelo frontend após verificação bem-sucedida (receitas, exames, atestados).
    /// Bloqueia download se documento já foi dispensado ou limite de downloads atingido (anti-fraude).
    /// </summary>
    [HttpGet("{documentId}/document")]
    public async Task<IActionResult> GetDocument(
        Guid documentId,
        [FromQuery] string? code,
        CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = HttpContext.Request.Headers.UserAgent.ToString();

        var trimmed = (code ?? "").Trim();
        if (trimmed.Length != 4 && trimmed.Length != 6)
            return BadRequest(new { error = "Código de verificação inválido. Informe o código de 4 ou 6 dígitos." });

        var doc = await documentRepository.GetByIdAsync(documentId, ct);
        if (doc == null) return NotFound(new { error = "Documento não encontrado." });
        if (doc.SignedAt == null) return NotFound(new { error = "Documento ainda não assinado." });

        var security = await documentRepository.GetSecurityFieldsAsync(documentId, ct);
        var codeValid = false;
        if (security.HasValue && !string.IsNullOrEmpty(security.Value.verifyCodeHash))
            codeValid = securityService.ValidateVerifyCode(trimmed, security.Value.verifyCodeHash);
        else if (security.HasValue && !string.IsNullOrEmpty(security.Value.accessCode))
            codeValid = trimmed == security.Value.accessCode.Trim();

        if (!codeValid)
            return Unauthorized(new { error = "Código inválido ou expirado." });

        // Bloquear download se documento já foi dispensado (igual às receitas)
        var dispenseCount = await accessLogRepository.GetDispenseCountAsync(documentId, ct);
        if (dispenseCount > 0)
        {
            await securityService.LogAccessAsync(documentId, null, null, "download_blocked_dispensed", "verifier", ip, userAgent, ct);
            return StatusCode(403, new { error = "Download bloqueado. Este documento já foi dispensado/utilizado." });
        }

        // Limitar número de downloads (anti-fraude)
        var maxDownloads = verificationConfig.Value?.MaxDownloadsPerDocument ?? 10;
        var downloadCount = await accessLogRepository.GetDownloadCountAsync(documentId, ct);
        if (downloadCount >= maxDownloads)
        {
            await securityService.LogAccessAsync(documentId, null, null, "download_blocked_limit", "verifier", ip, userAgent, ct);
            return StatusCode(403, new { error = $"Limite de downloads atingido ({maxDownloads} por documento). Contate o suporte se precisar de outra via." });
        }

        var refOrUrl = await documentRepository.GetSignedDocumentUrlAsync(documentId, ct);
        if (string.IsNullOrEmpty(refOrUrl))
            return NotFound(new { error = "PDF ainda não disponível. O documento pode estar em processamento." });

        try
        {
            byte[]? pdfBytes = null;
            var pathOrUrl = refOrUrl.Trim();

            if (!pathOrUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                pdfBytes = await storageService.DownloadAsync(pathOrUrl, ct);
            else
            {
                pdfBytes = await storageService.DownloadFromStorageUrlAsync(pathOrUrl, ct);
                if (pdfBytes == null)
                {
                    var httpClient = httpClientFactory.CreateClient();
                    httpClient.Timeout = TimeSpan.FromSeconds(30);
                    pdfBytes = await httpClient.GetByteArrayAsync(pathOrUrl, ct);
                }
            }

            if (pdfBytes == null || pdfBytes.Length == 0)
                return NotFound(new { error = "Documento não encontrado." });

            await securityService.LogAccessAsync(documentId, null, null, "download", "verifier", ip, userAgent, ct);

            Response.Headers.ContentDisposition = $"inline; filename=\"documento-{documentId}.pdf\"";
            return File(pdfBytes, "application/pdf");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to fetch PDF for document {DocumentId}", documentId);
            return StatusCode(500, new { error = "Erro ao obter o documento. Tente novamente." });
        }
    }

    /// <summary>
    /// Marca documento como dispensado/utilizado (público — valida código de verificação).
    /// Para receitas, exames e atestados. Todos assinados ICP-Brasil.
    /// </summary>
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    [HttpPost("{documentId}/dispense-by-code")]
    public async Task<IActionResult> DispenseDocumentByCode(
        Guid documentId,
        [FromBody] DispenseByCodeRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(new { error = "Código de verificação é obrigatório." });
        if (string.IsNullOrWhiteSpace(request.PharmacyName) || string.IsNullOrWhiteSpace(request.PharmacistName))
            return BadRequest(new { error = "Informe nome da farmácia e farmacêutico(a) ou responsável." });

        try
        {
            var doc = await documentRepository.GetByIdAsync(documentId, ct);
            if (doc == null) return NotFound(new { error = "Documento não encontrado." });
            if (doc.SignedAt == null) return BadRequest(new { error = "Documento não assinado." });

            var security = await documentRepository.GetSecurityFieldsAsync(documentId, ct);
            var codeValid = false;
            if (security.HasValue && !string.IsNullOrEmpty(security.Value.verifyCodeHash))
                codeValid = securityService.ValidateVerifyCode(request.Code.Trim(), security.Value.verifyCodeHash);
            else if (security.HasValue && !string.IsNullOrEmpty(security.Value.accessCode))
                codeValid = request.Code.Trim() == security.Value.accessCode.Trim();

            if (!codeValid)
                return Unauthorized(new { error = "Código inválido ou expirado." });

            var dispenseCount = await accessLogRepository.GetDispenseCountAsync(documentId, ct);
            if (dispenseCount >= 1 && doc.DocumentType == Domain.Enums.DocumentType.Prescription)
                return Conflict(new { error = "Receita já dispensada. Não é permitido dispensar novamente.", alreadyDispensed = true });

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            await securityService.RecordDispensationAsync(
                documentId, request.PharmacyName.Trim(), request.PharmacistName.Trim(), ip, ct);

            var isControlled = false;
            if (doc.DocumentType == Domain.Enums.DocumentType.Prescription)
            {
                var sourceRequestId = await documentRepository.GetSourceRequestIdAsync(documentId, ct);
                if (sourceRequestId.HasValue)
                {
                    var sourceRequest = await requestRepository.GetByIdAsync(sourceRequestId.Value, ct);
                    if (sourceRequest?.PrescriptionKind is Domain.Enums.PrescriptionKind.ControlledSpecial
                        or Domain.Enums.PrescriptionKind.Antimicrobial)
                        isControlled = true;
                }
            }

            var notification = isControlled
                ? PushNotificationRules.ControlledSubstanceDispensed(doc.PatientId, documentId)
                : PushNotificationRules.DocumentDispensed(doc.PatientId, documentId);
            _ = pushDispatcher.SendAsync(notification, CancellationToken.None)
                .ContinueWith(t =>
                {
                    if (t.IsFaulted)
                        logger.LogDebug(t.Exception?.InnerException, "Failed to notify patient about dispensation");
                }, TaskScheduler.Default);

            return Ok(new { success = true, message = "Documento marcado como dispensado/utilizado.", dispenseCount = dispenseCount + 1 });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Dispense-by-code failed for document {DocumentId}", documentId);
            return BadRequest(new { error = "Erro ao registrar dispensação. Tente novamente." });
        }
    }

    /// <summary>
    /// Marca documento como dispensado (requer autenticação — portal médico/farmácia).
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
            await securityService.RecordDispensationAsync(documentId, request.PharmacyName ?? "Não informado", null, ip, ct);

            // Check if the prescription is controlled via the source request
            var isControlled = false;
            if (doc.DocumentType == Domain.Enums.DocumentType.Prescription)
            {
                var sourceRequestId = await documentRepository.GetSourceRequestIdAsync(documentId, ct);
                if (sourceRequestId.HasValue)
                {
                    var sourceRequest = await requestRepository.GetByIdAsync(sourceRequestId.Value, ct);
                    if (sourceRequest?.PrescriptionKind is Domain.Enums.PrescriptionKind.ControlledSpecial
                        or Domain.Enums.PrescriptionKind.Antimicrobial)
                    {
                        isControlled = true;
                    }
                }
            }

            // Notificar paciente sobre dispensação (fire-and-forget)
            // Para receitas controladas, envia notificação específica em vez da genérica
            var notification = isControlled
                ? PushNotificationRules.ControlledSubstanceDispensed(doc.PatientId, documentId)
                : PushNotificationRules.DocumentDispensed(doc.PatientId, documentId);
            _ = pushDispatcher.SendAsync(notification, CancellationToken.None)
                .ContinueWith(t =>
                {
                    if (t.IsFaulted)
                        logger.LogDebug(t.Exception?.InnerException, "Failed to notify patient about dispensation");
                }, TaskScheduler.Default);

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
public record DispenseByCodeRequest(string Code, string PharmacyName, string PharmacistName);
