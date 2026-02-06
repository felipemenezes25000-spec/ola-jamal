using Microsoft.AspNetCore.Mvc;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller que expõe a lista de especialidades médicas.
/// </summary>
[ApiController]
[Route("api/specialties")]
public class SpecialtiesController : ControllerBase
{
    /// <summary>
    /// Retorna a lista de especialidades disponíveis (baseada no enum MedicalSpecialty).
    /// </summary>
    [HttpGet]
    public IActionResult GetSpecialties()
    {
        var specialties = MedicalSpecialtyDisplay.GetAllDisplayNames();
        return Ok(specialties);
    }
}
