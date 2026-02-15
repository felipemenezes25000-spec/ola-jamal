using System.Security.Claims;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço para obter informações do usuário atualmente autenticado.
/// </summary>
public interface ICurrentUserService
{
    /// <summary>
    /// Obtém o ID do usuário logado.
    /// </summary>
    Guid? GetUserId();

    /// <summary>
    /// Obtém o email do usuário logado.
    /// </summary>
    string? GetEmail();

    /// <summary>
    /// Verifica se o usuário é médico.
    /// </summary>
    bool IsDoctor();

    /// <summary>
    /// Verifica se o usuário é paciente.
    /// </summary>
    bool IsPatient();

    /// <summary>
    /// Obtém o ID do perfil de médico (se for médico).
    /// </summary>
    Guid? GetDoctorProfileId();

    /// <summary>
    /// Obtém todas as claims do usuário.
    /// </summary>
    IEnumerable<Claim> GetClaims();
}
