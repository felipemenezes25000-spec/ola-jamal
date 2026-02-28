using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Certificates;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller para gerenciamento de certificados digitais de médicos.
/// </summary>
[ApiController]
[Route("api/certificates")]
[Authorize]
public class CertificatesController : ControllerBase
{
    private readonly IDigitalCertificateService _certificateService;
    private readonly ICurrentUserService _currentUserService;
    private readonly IUserRepository _userRepository;
    private readonly INotificationRepository _notificationRepository;
    private readonly IPushNotificationSender _pushNotificationSender;
    private readonly ILogger<CertificatesController> _logger;

    public CertificatesController(
        IDigitalCertificateService certificateService,
        ICurrentUserService currentUserService,
        IUserRepository userRepository,
        INotificationRepository notificationRepository,
        IPushNotificationSender pushNotificationSender,
        ILogger<CertificatesController> logger)
    {
        _certificateService = certificateService;
        _currentUserService = currentUserService;
        _userRepository = userRepository;
        _notificationRepository = notificationRepository;
        _pushNotificationSender = pushNotificationSender;
        _logger = logger;
    }

    /// <summary>
    /// Faz upload e valida um certificado digital PFX ICP-Brasil.
    /// </summary>
    [HttpPost("upload")]
    [RequestSizeLimit(10_000_000)] // 10MB max
    public async Task<IActionResult> UploadCertificate(
        [FromForm] UploadCertificateDto dto,
        CancellationToken cancellationToken = default)
    {
        var userId = _currentUserService.GetUserId();
        if (userId == null)
            return Unauthorized();

        // Verifica se é médico
        if (!_currentUserService.IsDoctor())
            return Forbid("Apenas médicos podem cadastrar certificados digitais.");

        var doctorProfileId = await _currentUserService.GetDoctorProfileIdAsync();
        if (doctorProfileId == null)
        {
            _logger.LogWarning("Certificates Upload 400: Perfil de médico não encontrado para UserId={UserId}", userId);
            return BadRequest("Perfil de médico não encontrado. Complete seu cadastro como médico.");
        }

        if (dto.PfxFile == null || dto.PfxFile.Length == 0)
        {
            _logger.LogWarning("Certificates Upload 400: Arquivo PFX ausente ou vazio.");
            return BadRequest("Arquivo PFX é obrigatório.");
        }

        using var stream = dto.PfxFile.OpenReadStream();
        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms, cancellationToken);
        var pfxBytes = ms.ToArray();

        _logger.LogInformation("Certificates Upload: doctorProfileId={DoctorProfileId}", doctorProfileId);
        var (certificateId, validation) = await _certificateService.UploadAndValidateAsync(
            doctorProfileId.Value,
            pfxBytes,
            dto.Password,
            dto.PfxFile.FileName,
            cancellationToken);

        if (!validation.IsValid)
        {
            _logger.LogWarning("Certificates Upload validation failed: {Error}", validation.ErrorMessage);
            return BadRequest(new UploadCertificateResponseDto(
                false,
                validation.ErrorMessage,
                null,
                validation));
        }

        // Marca perfil do médico como completo (certificado obrigatório no cadastro)
        var user = await _userRepository.GetByIdAsync(userId.Value, cancellationToken);
        if (user != null && !user.ProfileComplete)
        {
            user.MarkProfileComplete();
            await _userRepository.UpdateAsync(user, cancellationToken);
            _logger.LogInformation("Certificates Upload: User {UserId} profile marked complete after first certificate.", userId);
        }

        // Notifica o médico que o certificado foi cadastrado com sucesso
        try
        {
            var notification = Notification.Create(
                userId.Value,
                "Certificado Digital Cadastrado",
                $"Seu certificado digital foi cadastrado e validado com sucesso. Válido até {validation.NotAfter:dd/MM/yyyy}.",
                NotificationType.Info);
            await _notificationRepository.CreateAsync(notification, cancellationToken);
            await _pushNotificationSender.SendAsync(
                userId.Value,
                "Certificado Digital Cadastrado",
                "Seu certificado digital foi cadastrado e validado com sucesso.",
                ct: cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao enviar notificação de certificado para UserId={UserId}", userId);
        }

        return Ok(new UploadCertificateResponseDto(
            true,
            "Certificado cadastrado com sucesso.",
            certificateId,
            validation));
    }

    /// <summary>
    /// Valida um certificado PFX sem fazer upload (pré-validação).
    /// </summary>
    [HttpPost("validate")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> ValidateCertificate(
        [FromForm] ValidateCertificateDto dto,
        CancellationToken cancellationToken = default)
    {
        if (dto.PfxFile == null || dto.PfxFile.Length == 0)
            return BadRequest("Arquivo PFX é obrigatório.");

        using var stream = dto.PfxFile.OpenReadStream();
        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms, cancellationToken);
        var pfxBytes = ms.ToArray();

        var validation = await _certificateService.ValidatePfxAsync(
            pfxBytes,
            dto.Password,
            cancellationToken);

        return Ok(new ValidateCertificateResponseDto(
            validation.IsValid,
            validation.ErrorMessage,
            validation.SubjectName,
            validation.IssuerName,
            validation.SerialNumber,
            validation.NotBefore,
            validation.NotAfter,
            validation.Cpf,
            validation.CrmNumber,
            validation.IsExpired,
            validation.IsIcpBrasil));
    }

    /// <summary>
    /// Obtém informações do certificado ativo do médico logado.
    /// </summary>
    [HttpGet("active")]
    public async Task<IActionResult> GetActiveCertificate(CancellationToken cancellationToken = default)
    {
        var doctorProfileId = await _currentUserService.GetDoctorProfileIdAsync();
        if (doctorProfileId == null)
            return BadRequest("Perfil de médico não encontrado. Complete seu cadastro como médico.");

        var certificate = await _certificateService.GetActiveCertificateAsync(
            doctorProfileId.Value,
            cancellationToken);

        if (certificate == null)
            return NotFound(new { message = "Nenhum certificado ativo encontrado." });

        return Ok(new CertificateInfoDto(
            certificate.Id,
            certificate.SubjectName,
            certificate.IssuerName,
            certificate.NotBefore,
            certificate.NotAfter,
            certificate.IsValid,
            certificate.IsExpired,
            certificate.DaysUntilExpiry));
    }

    /// <summary>
    /// Verifica se o médico logado tem certificado válido para assinatura.
    /// </summary>
    [HttpGet("status")]
    public async Task<IActionResult> GetCertificateStatus(CancellationToken cancellationToken = default)
    {
        var doctorProfileId = await _currentUserService.GetDoctorProfileIdAsync();
        if (doctorProfileId == null)
            return BadRequest("Perfil de médico não encontrado. Complete seu cadastro como médico.");

        var hasValid = await _certificateService.HasValidCertificateAsync(
            doctorProfileId.Value,
            cancellationToken);

        return Ok(new { hasValidCertificate = hasValid });
    }

    /// <summary>
    /// Diagnóstico do fluxo de assinatura: testa perfil → certificado válido → certificado ativo.
    /// Retorna um checklist indicando em qual etapa está o problema (útil para debugar assinatura).
    /// </summary>
    [HttpPost("diagnose")]
    public async Task<IActionResult> Diagnose(CancellationToken cancellationToken = default)
    {
        var doctorProfileId = await _currentUserService.GetDoctorProfileIdAsync();
        if (doctorProfileId == null)
        {
            return Ok(new CertificateDiagnoseResponseDto(
                ProfileOk: false,
                ProfileMessage: "Perfil de médico não encontrado. Complete o cadastro como médico.",
                CertificateOk: false,
                CertificateMessage: null,
                HasActiveCertificate: false,
                ActiveCertificateMessage: null,
                FailedStep: "profile",
                Suggestion: "Complete seu cadastro como médico em Perfil / Configurações."));
        }

        var hasValid = await _certificateService.HasValidCertificateAsync(doctorProfileId.Value, cancellationToken);
        if (!hasValid)
        {
            return Ok(new CertificateDiagnoseResponseDto(
                ProfileOk: true,
                ProfileMessage: "OK",
                CertificateOk: false,
                CertificateMessage: "Nenhum certificado válido encontrado.",
                HasActiveCertificate: false,
                ActiveCertificateMessage: null,
                FailedStep: "certificate",
                Suggestion: "Cadastre um certificado digital (PFX) em Configurações > Certificado digital."));
        }

        var active = await _certificateService.GetActiveCertificateAsync(doctorProfileId.Value, cancellationToken);
        if (active == null)
        {
            return Ok(new CertificateDiagnoseResponseDto(
                ProfileOk: true,
                ProfileMessage: "OK",
                CertificateOk: true,
                CertificateMessage: "OK",
                HasActiveCertificate: false,
                ActiveCertificateMessage: "Certificado válido mas nenhum ativo para assinatura.",
                FailedStep: "active_certificate",
                Suggestion: "Revogue o certificado atual e faça upload novamente, ou contate o suporte."));
        }

        return Ok(new CertificateDiagnoseResponseDto(
            ProfileOk: true,
            ProfileMessage: "OK",
            CertificateOk: true,
            CertificateMessage: "OK",
            HasActiveCertificate: true,
            ActiveCertificateMessage: $"Certificado ativo: {active.SubjectName}, válido até {active.NotAfter:dd/MM/yyyy}.",
            FailedStep: null,
            Suggestion: "Se a assinatura falhar ao assinar um documento, verifique a senha do PFX. Use a mensagem de erro exata retornada pela API."));
    }

    /// <summary>
    /// Revoga um certificado.
    /// </summary>
    [HttpPost("{id}/revoke")]
    public async Task<IActionResult> RevokeCertificate(
        Guid id,
        [FromBody] RevokeCertificateDto dto,
        CancellationToken cancellationToken = default)
    {
        var result = await _certificateService.RevokeCertificateAsync(
            id,
            dto.Reason,
            cancellationToken);

        if (!result)
            return NotFound(new { message = "Certificado não encontrado." });

        return Ok(new { message = "Certificado revogado com sucesso." });
    }
}
