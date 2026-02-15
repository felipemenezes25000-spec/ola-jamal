namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Resultado da validação do CRM via API externa.
/// </summary>
public record CrmValidationResult(
    bool IsValid,
    string? DoctorName,
    string? Crm,
    string? Uf,
    string? Specialty,
    string? Situation,
    string? ErrorMessage);

/// <summary>
/// Serviço para validação de CRM via API InfoSimples (CFM).
/// </summary>
public interface ICrmValidationService
{
    /// <summary>
    /// Valida um CRM consultando a API do CFM via InfoSimples.
    /// </summary>
    Task<CrmValidationResult> ValidateCrmAsync(
        string crm,
        string uf,
        CancellationToken cancellationToken = default);
}
