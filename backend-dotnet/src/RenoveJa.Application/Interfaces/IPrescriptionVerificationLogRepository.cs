namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Log de verificações e downloads de receitas (anti-fraude, auditoria LGPD).
/// </summary>
public interface IPrescriptionVerificationLogRepository
{
    /// <summary>Registra uma tentativa de verificação ou download.</summary>
    Task LogAsync(Guid prescriptionId, string action, string outcome, string? ipAddress, string? userAgent, CancellationToken ct = default);

    /// <summary>Conta quantos downloads bem-sucedidos já houve para esta receita.</summary>
    Task<int> GetDownloadCountAsync(Guid prescriptionId, CancellationToken ct = default);
}
