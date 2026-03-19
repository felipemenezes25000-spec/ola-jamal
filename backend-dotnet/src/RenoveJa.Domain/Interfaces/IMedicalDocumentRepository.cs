using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Domain.Interfaces;

public interface IMedicalDocumentRepository
{
    Task<MedicalDocument?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<MedicalDocument>> GetByPatientIdAsync(Guid patientId, CancellationToken cancellationToken = default);
    Task<List<MedicalDocument>> GetByEncounterIdAsync(Guid encounterId, CancellationToken cancellationToken = default);
    Task<List<MedicalDocument>> GetByPatientAndTypeAsync(Guid patientId, DocumentType documentType, CancellationToken cancellationToken = default);
    Task<MedicalDocument?> GetBySourceRequestIdAsync(Guid sourceRequestId, DocumentType documentType, CancellationToken cancellationToken = default);
    Task<MedicalDocument> CreateAsync(MedicalDocument document, CancellationToken cancellationToken = default, Guid? sourceRequestId = null, string? signedDocumentUrl = null, string? signatureId = null);
    Task<MedicalDocument> UpdateAsync(MedicalDocument document, CancellationToken cancellationToken = default);
    /// <summary>Retorna a URL do PDF assinado (S3) para download direto.</summary>
    Task<string?> GetSignedDocumentUrlAsync(Guid documentId, CancellationToken cancellationToken = default);
    /// <summary>Atualiza campos de segurança (expires_at, access_code, max_dispenses, verify_code_hash).</summary>
    Task SetSecurityFieldsAsync(Guid documentId, DateTime? expiresAt, int maxDispenses, string? accessCode, string? verifyCodeHash, CancellationToken cancellationToken = default);

    /// <summary>Atualiza URL do PDF assinado e metadados de assinatura digital.</summary>
    Task SetSignedDocumentAsync(
        Guid documentId,
        string signedDocumentUrl,
        string? signatureId,
        string documentHash,
        string hashAlgorithm,
        string certificateIdentifier,
        DateTime signedAt,
        bool isValid,
        string? validationResult,
        string? policyOid,
        CancellationToken cancellationToken = default);
    /// <summary>Retorna access_code e verify_code_hash de um documento.</summary>
    Task<(string? accessCode, string? verifyCodeHash, DateTime? expiresAt, int dispensedCount)?> GetSecurityFieldsAsync(Guid documentId, CancellationToken cancellationToken = default);

    /// <summary>Retorna o source_request_id vinculado ao documento (se houver).</summary>
    Task<Guid?> GetSourceRequestIdAsync(Guid documentId, CancellationToken cancellationToken = default);
}

