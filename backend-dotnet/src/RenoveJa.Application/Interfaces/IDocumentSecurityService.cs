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
    Task<(bool success, string? error)> RecordDispensationAsync(Guid documentId, string dispensedBy, string? ip, CancellationToken ct);
    Task LogAccessAsync(Guid? documentId, Guid? requestId, Guid? userId, string action, string actorType, string? ip, string? userAgent, CancellationToken ct);
}

/// <summary>Entrada de log de acesso a documento.</summary>
public class DocumentAccessEntry
{
    public Guid? DocumentId { get; set; }
    public Guid? RequestId { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = "";
    public string ActorType { get; set; } = "patient";
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? Metadata { get; set; }
}
