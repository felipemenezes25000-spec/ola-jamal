using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RenoveJa.Application.DTOs.Doctors;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Doctors;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por listagem e gestão de médicos.
/// </summary>
[ApiController]
[Route("api/doctors")]
public class DoctorsController(IDoctorService doctorService, ICrmValidationService crmValidationService, ILogger<DoctorsController> logger) : ControllerBase
{
    /// <summary>
    /// Lista médicos com paginação, opcionalmente por especialidade e disponibilidade.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetDoctors(
        [FromQuery] string? specialty,
        [FromQuery] bool? available,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        if (page < 1) page = 1;
        logger.LogInformation("Doctors GetDoctors: specialty={Specialty}, available={Available}, page={Page}", specialty, available, page);
        var doctors = await doctorService.GetDoctorsPagedAsync(specialty, available, page, pageSize, cancellationToken);
        return Ok(doctors);
    }

    /// <summary>
    /// Obtém um médico pelo ID.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetDoctor(
        Guid id,
        CancellationToken cancellationToken)
    {
        var doctor = await doctorService.GetDoctorByIdAsync(id, cancellationToken);
        return Ok(doctor);
    }

    /// <summary>
    /// Retorna a fila de médicos disponíveis (para role doctor).
    /// </summary>
    [HttpGet("queue")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> GetQueue(
        [FromQuery] string? specialty,
        CancellationToken cancellationToken)
    {
        var doctors = await doctorService.GetQueueAsync(specialty, cancellationToken);
        return Ok(doctors);
    }

    /// <summary>
    /// Atualiza a disponibilidade de um médico.
    /// </summary>
    [HttpPut("{id}/availability")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> UpdateAvailability(
        Guid id,
        [FromBody] UpdateDoctorAvailabilityDto dto,
        CancellationToken cancellationToken)
    {
        var profile = await doctorService.UpdateAvailabilityAsync(id, dto, cancellationToken);
        return Ok(profile);
    }

    /// <summary>
    /// Valida um CRM consultando o CFM via InfoSimples API.
    /// Body: { "crm": "123456", "uf": "SP" }
    /// </summary>
    [HttpPost("validate-crm")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ValidateCrm(
        [FromBody] ValidateCrmRequestDto dto,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.Crm) || string.IsNullOrWhiteSpace(dto.Uf))
            return BadRequest(new { error = "CRM e UF são obrigatórios." });

        var result = await crmValidationService.ValidateCrmAsync(dto.Crm, dto.Uf, cancellationToken);

        return Ok(new
        {
            valid = result.IsValid,
            doctorName = result.DoctorName,
            crm = result.Crm,
            uf = result.Uf,
            specialty = result.Specialty,
            situation = result.Situation,
            error = result.ErrorMessage
        });
    }
}

/// <summary>
/// DTO para validação de CRM.
/// </summary>
public record ValidateCrmRequestDto(string Crm, string Uf);
