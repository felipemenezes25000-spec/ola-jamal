using RenoveJa.Domain.Enums;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Controle antifraude e segurança de documentos médicos.
/// </summary>
public interface IDocumentSecurityService
{
    DateTime CalculateExpiresAt(DocumentType docType, string? prescriptionKind, DateTime issuedAt);
    int CalculateMaxDispenses(DocumentType docType, string? prescriptionKind);
    (string code, string hash) GenerateVerifyCode();
    bool ValidateVerifyCode(string code, string storedHash);
    Task<(bool success, string? error)> RecordDispensationAsync(Guid documentId, string dispensedBy, string? pharmacistName, string? ip, CancellationToken ct);
    Task LogAccessAsync(Guid? documentId, Guid? requestId, Guid? userId, string action, string actorType, string? ip, string? userAgent, CancellationToken ct);
}
