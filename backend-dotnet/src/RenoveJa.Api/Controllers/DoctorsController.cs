using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Doctors;
using RenoveJa.Application.Services.Doctors;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por listagem e gestão de médicos.
/// </summary>
[ApiController]
[Route("api/doctors")]
public class DoctorsController(IDoctorService doctorService) : ControllerBase
{
    /// <summary>
    /// Lista médicos, opcionalmente por especialidade e disponibilidade.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetDoctors(
        [FromQuery] string? specialty,
        [FromQuery] bool? available,
        CancellationToken cancellationToken)
    {
        var doctors = await doctorService.GetDoctorsAsync(specialty, available, cancellationToken);
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
}
