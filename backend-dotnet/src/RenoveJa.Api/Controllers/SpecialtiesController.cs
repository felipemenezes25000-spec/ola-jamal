using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller que expõe a lista de especialidades médicas.
/// </summary>
[ApiController]
[Route("api/specialties")]
public class SpecialtiesController(IMemoryCache cache, ILogger<SpecialtiesController> logger) : ControllerBase
{
    private const string CacheKey = "specialties_list";

    /// <summary>
    /// Retorna a lista de especialidades disponíveis (baseada no enum MedicalSpecialty).
    /// Resultado cacheado por 24 horas.
    /// </summary>
    [HttpGet]
    public IActionResult GetSpecialties()
    {
        logger.LogInformation("Specialties GetSpecialties");
        var specialties = cache.GetOrCreate(CacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24);
            return MedicalSpecialtyDisplay.GetAllDisplayNames();
        });
        return Ok(specialties);
    }
}
