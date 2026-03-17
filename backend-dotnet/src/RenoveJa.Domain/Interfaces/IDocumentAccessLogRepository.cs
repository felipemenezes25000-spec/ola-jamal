using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

/// <summary>
/// Repositório para log de acesso a documentos (auditoria LGPD).
/// Tabela: document_access_log
/// </summary>
public interface IDocumentAccessLogRepository
{
    Task LogAccessAsync(DocumentAccessEntry entry, CancellationToken ct = default);
    Task<List<DocumentAccessEntry>> GetByDocumentIdAsync(Guid documentId, int limit = 50, CancellationToken ct = default);
    Task<List<DocumentAccessEntry>> GetByRequestIdAsync(Guid requestId, int limit = 50, CancellationToken ct = default);
    Task<int> GetDispenseCountAsync(Guid documentId, CancellationToken ct = default);
    /// <summary>Conta quantos downloads foram feitos do documento (action = "download").</summary>
    Task<int> GetDownloadCountAsync(Guid documentId, CancellationToken ct = default);
}
