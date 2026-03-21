using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller da integração RNDS (Rede Nacional de Dados em Saúde).
/// Padrão FHIR R4 — https://rnds-fhir.saude.gov.br
/// Base: /api/rnds
/// </summary>
[ApiController]
[Route("api/rnds")]
[Authorize]
public class RndsController(
    IRndsService rndsService,
    IAuditService auditService,
    ILogger<RndsController> logger) : ControllerBase
{
    /// <summary>
    /// Health check da RNDS — verifica se o barramento está acessível.
    /// GET /api/rnds/health
    /// </summary>
    [HttpGet("health")]
    [AllowAnonymous]
    public async Task<IActionResult> HealthCheck(CancellationToken ct)
    {
        var ok = await rndsService.HealthCheckAsync(ct);
        return Ok(new { rnds = ok ? "online" : "offline", timestamp = DateTime.UtcNow });
    }

    /// <summary>
    /// Testa autenticação com a RNDS via certificado digital.
    /// POST /api/rnds/auth/test
    /// </summary>
    [HttpPost("auth/test")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> TestAuth(CancellationToken ct)
    {
        logger.LogInformation("RNDS: Auth test requested by {User}", User.Identity?.Name);
        var result = await rndsService.AuthenticateAsync(ct);

        return Ok(new
        {
            success = result.Success,
            tokenLength = result.AccessToken?.Length ?? 0,
            expiresAt = result.ExpiresAt,
            error = result.ErrorMessage,
        });
    }

    /// <summary>
    /// Consulta paciente na RNDS por CNS ou CPF.
    /// GET /api/rnds/patient/{cnsOrCpf}
    /// </summary>
    [HttpGet("patient/{cnsOrCpf}")]
    public async Task<IActionResult> GetPatient(string cnsOrCpf, CancellationToken ct)
    {
        logger.LogInformation("RNDS: Patient lookup for {Id}", cnsOrCpf);
        var result = await rndsService.GetPatientAsync(cnsOrCpf, ct);

        await auditService.LogAccessAsync(
            userId: null,
            entityType: "RndsPatient",
            entityId: null,
            cancellationToken: ct);

        if (!result.Success)
            return StatusCode(502, new { error = result.ErrorMessage });

        return Ok(new
        {
            success = result.Success,
            patientId = result.PatientId,
            data = result.PatientJson != null ? System.Text.Json.JsonDocument.Parse(result.PatientJson).RootElement : default,
        });
    }

    /// <summary>
    /// Consulta timeline (registros clínicos) de um paciente na RNDS.
    /// GET /api/rnds/timeline/{cnsPaciente}
    /// </summary>
    [HttpGet("timeline/{cnsPaciente}")]
    public async Task<IActionResult> GetTimeline(string cnsPaciente, CancellationToken ct)
    {
        logger.LogInformation("RNDS: Timeline for {Cns}", cnsPaciente);
        var result = await rndsService.GetTimelineAsync(cnsPaciente, ct);

        if (!result.Success)
            return StatusCode(502, new { error = result.ErrorMessage });

        return Ok(new
        {
            success = result.Success,
            totalRecords = result.TotalRecords,
            data = result.BundleJson != null ? System.Text.Json.JsonDocument.Parse(result.BundleJson).RootElement : default,
        });
    }

    /// <summary>
    /// Envia um atendimento para a RNDS como Bundle FHIR R4.
    /// POST /api/rnds/send/{atendimentoId}
    /// </summary>
    [HttpPost("send/{atendimentoId:guid}")]
    public IActionResult SendAtendimento(Guid atendimentoId)
    {
        // TODO: buscar atendimento + cidadão + profissional, usar RndsFhirMapper, enviar
        return Ok(new
        {
            message = $"Envio do atendimento {atendimentoId} à RNDS — requer ISusRepository implementado.",
            howItWorks = new
            {
                step1 = "Buscar AtendimentoAps + Cidadao + ProfissionalSus + UnidadeSaude",
                step2 = "RndsFhirMapper.MapAtendimentoToBundle() → gera Bundle FHIR R4",
                step3 = "RndsService.SendBundleAsync() → POST /fhir/r4/Bundle",
                step4 = "Salvar RNDS ID no atendimento para rastreabilidade",
            }
        });
    }
}
