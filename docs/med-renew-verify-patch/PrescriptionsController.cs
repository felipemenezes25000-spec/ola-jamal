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
    IRequestRepository requestRepository,
    IDoctorRepository doctorRepository,
    IOptions<ApiConfig> apiConfig,
    ILogger<PrescriptionsController> logger) : ControllerBase
{
    [HttpPost("verify")]
    public async Task<ActionResult<PrescriptionVerifyResponse>> Verify(
        [FromBody] PrescriptionVerifyRequest body,
        CancellationToken cancellationToken)
    {
        var id = body.PrescriptionId;
        var code = (body.VerificationCode ?? "").Trim();

        if (code.Length != 4 && code.Length != 6)
        {
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false, Status: "invalid", Reason: PrescriptionVerifyReason.InvalidCode,
                IssuedAt: null, SignedAt: null, PatientName: null, DoctorName: null, DoctorCrm: null, DownloadUrl: null));
        }

        var codeValid = await prescriptionVerifyRepository.ValidateVerifyCodeAsync(id, code, cancellationToken);
        if (!codeValid)
        {
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false, Status: "invalid", Reason: PrescriptionVerifyReason.InvalidCode,
                IssuedAt: null, SignedAt: null, PatientName: null, DoctorName: null, DoctorCrm: null, DownloadUrl: null));
        }

        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
        {
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false, Status: "invalid", Reason: PrescriptionVerifyReason.NotFound,
                IssuedAt: null, SignedAt: null, PatientName: null, DoctorName: null, DoctorCrm: null, DownloadUrl: null));
        }

        if (request.SignedAt == null)
        {
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false, Status: "invalid", Reason: PrescriptionVerifyReason.NotSigned,
                IssuedAt: null, SignedAt: null, PatientName: null, DoctorName: null, DoctorCrm: null, DownloadUrl: null));
        }

        if (request.Status == RequestStatus.Cancelled)
        {
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false, Status: "invalid", Reason: PrescriptionVerifyReason.Revoked,
                IssuedAt: null, SignedAt: null, PatientName: null, DoctorName: null, DoctorCrm: null, DownloadUrl: null));
        }

        string? doctorCrmFull = null;
        if (request.DoctorId.HasValue)
        {
            var doctor = await doctorRepository.GetByUserIdAsync(request.DoctorId.Value, cancellationToken);
            if (doctor != null)
                doctorCrmFull = string.IsNullOrWhiteSpace(doctor.CrmState) ? doctor.Crm : $"{doctor.Crm} / {doctor.CrmState}";
        }

        var baseUrl = (apiConfig?.Value?.BaseUrl ?? "").TrimEnd('/');
        var downloadUrl = string.IsNullOrEmpty(baseUrl) ? null
            : $"{baseUrl}/api/verify/{id}/document?code={Uri.EscapeDataString(code)}";

        return Ok(new PrescriptionVerifyResponse(
            IsValid: true, Status: "valid", Reason: null,
            IssuedAt: request.CreatedAt, SignedAt: request.SignedAt,
            PatientName: request.PatientName, DoctorName: request.DoctorName, DoctorCrm: doctorCrmFull,
            DownloadUrl: downloadUrl));
    }
}
