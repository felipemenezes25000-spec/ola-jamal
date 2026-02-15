using RenoveJa.Application.DTOs.Verification;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de verificação pública de receitas.
/// Permite que farmacêuticos e pacientes verifiquem a autenticidade de uma receita digital.
/// </summary>
public interface IVerificationService
{
    /// <summary>Obtém dados públicos da receita (sem dados sensíveis).</summary>
    Task<VerificationPublicDto?> GetPublicVerificationAsync(Guid requestId, CancellationToken cancellationToken = default);

    /// <summary>Obtém dados completos da receita após validação do código de acesso.</summary>
    Task<VerificationFullDto?> GetFullVerificationAsync(Guid requestId, string accessCode, CancellationToken cancellationToken = default);

    /// <summary>Valida se o código de acesso é válido para a receita.</summary>
    bool ValidateAccessCode(Guid requestId, string accessCode);
}
