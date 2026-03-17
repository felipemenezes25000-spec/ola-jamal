using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Verification;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Endpoint público para verificação de receitas por código (6 dígitos).
/// Validação server-side; resposta contém apenas dados reais persistidos (sem mock).
/// </summary>
[ApiController]
[Route("api/prescriptions")]
[EnableRateLimiting("verify")]
public class PrescriptionsController(
    IPrescriptionVerifyRepository prescriptionVerifyRepository,
    IPrescriptionVerificationLogRepository verificationLogRepository,
    IRequestRepository requestRepository,
    IDoctorRepository doctorRepository,
    IOptions<ApiConfig> apiConfig,
    ILogger<PrescriptionsController> logger) : ControllerBase
{
    /// <summary>
    /// Valida o código de verificação e retorna dados reais da receita (emitida em, assinada em, CRM completo).
    /// Código inválido ou receita não assinada retorna is_valid = false e reason.
    /// </summary>
    [HttpPost("verify")]
    public async Task<ActionResult<PrescriptionVerifyResponse>> Verify(
        [FromBody] PrescriptionVerifyRequest? body,
        CancellationToken cancellationToken)
    {
        if (body == null)
        {
            return BadRequest(new { error = "Corpo da requisição inválido. Envie { prescriptionId, verificationCode }." });
        }

        var id = body.PrescriptionId;
        var code = (body.VerificationCode ?? "").Trim();

        if (id == Guid.Empty)
        {
            return BadRequest(new { error = "prescriptionId inválido ou ausente." });
        }

        if (code.Length != 4 && code.Length != 6)
        {
            logger.LogDebug("Verificação de receita com código de tamanho inválido: {PrescriptionId}", id);
            await verificationLogRepository.LogAsync(id, "verify", "invalid_code_format", HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.Request.Headers.UserAgent.ToString(), cancellationToken);
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false,
                Status: "invalid",
                Reason: PrescriptionVerifyReason.InvalidCode,
                IssuedAt: null,
                SignedAt: null,
                PatientName: null,
                DoctorName: null,
                DoctorCrm: null,
                DownloadUrl: null));
        }

        var codeValid = await prescriptionVerifyRepository.ValidateVerifyCodeAsync(id, code, cancellationToken);
        if (!codeValid)
        {
            logger.LogDebug("Código de verificação inválido para receita {PrescriptionId}", id);
            await verificationLogRepository.LogAsync(id, "verify", "invalid_code", HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.Request.Headers.UserAgent.ToString(), cancellationToken);
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false,
                Status: "invalid",
                Reason: PrescriptionVerifyReason.InvalidCode,
                IssuedAt: null,
                SignedAt: null,
                PatientName: null,
                DoctorName: null,
                DoctorCrm: null,
                DownloadUrl: null));
        }

        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
        {
            await verificationLogRepository.LogAsync(id, "verify", "not_found", HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.Request.Headers.UserAgent.ToString(), cancellationToken);
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false,
                Status: "invalid",
                Reason: PrescriptionVerifyReason.NotFound,
                IssuedAt: null,
                SignedAt: null,
                PatientName: null,
                DoctorName: null,
                DoctorCrm: null,
                DownloadUrl: null));
        }

        if (request.SignedAt == null)
        {
            await verificationLogRepository.LogAsync(id, "verify", "not_signed", HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.Request.Headers.UserAgent.ToString(), cancellationToken);
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false,
                Status: "invalid",
                Reason: PrescriptionVerifyReason.NotSigned,
                IssuedAt: null,
                SignedAt: null,
                PatientName: null,
                DoctorName: null,
                DoctorCrm: null,
                DownloadUrl: null));
        }

        if (request.Status == RequestStatus.Cancelled)
        {
            await verificationLogRepository.LogAsync(id, "verify", "revoked", HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.Request.Headers.UserAgent.ToString(), cancellationToken);
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false,
                Status: "invalid",
                Reason: PrescriptionVerifyReason.Revoked,
                IssuedAt: null,
                SignedAt: null,
                PatientName: null,
                DoctorName: null,
                DoctorCrm: null,
                DownloadUrl: null));
        }

        string? doctorCrmFull = null;
        if (request.DoctorId.HasValue)
        {
            var doctor = await doctorRepository.GetByUserIdAsync(request.DoctorId.Value, cancellationToken);
            if (doctor != null)
            {
                doctorCrmFull = string.IsNullOrWhiteSpace(doctor.CrmState)
                    ? doctor.Crm
                    : $"{doctor.Crm} / {doctor.CrmState}";
            }
        }

        var baseUrl = (apiConfig?.Value?.BaseUrl ?? "").TrimEnd('/');
        var downloadUrl = string.IsNullOrEmpty(baseUrl)
            ? null
            : $"{baseUrl}/api/verify/{id}/document?code={Uri.EscapeDataString(code)}";

        await verificationLogRepository.LogAsync(id, "verify", "success", HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.Request.Headers.UserAgent.ToString(), cancellationToken);

        var wasDispensed = await prescriptionVerifyRepository.IsDispensedAsync(id, cancellationToken);

        return Ok(new PrescriptionVerifyResponse(
            IsValid: true,
            Status: "valid",
            Reason: null,
            IssuedAt: request.CreatedAt,
            SignedAt: request.SignedAt,
            PatientName: request.PatientName,
            DoctorName: request.DoctorName,
            DoctorCrm: doctorCrmFull,
            DownloadUrl: downloadUrl,
            WasDispensed: wasDispensed));
    }
}
