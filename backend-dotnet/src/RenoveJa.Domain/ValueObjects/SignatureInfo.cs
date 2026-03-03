using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.ValueObjects;

/// <summary>
/// Metadados mínimos de assinatura digital de documento clínico.
/// Conteúdo detalhado do certificado e cadeia é tratado pela infraestrutura.
/// </summary>
public sealed class SignatureInfo : IEquatable<SignatureInfo>
{
    public string DocumentHash { get; }
    public string HashAlgorithm { get; }
    public string CertificateIdentifier { get; }
    public DateTime SignedAt { get; }
    public bool IsValid { get; }
    public string? ValidationResult { get; }
    public string? PolicyOid { get; }

    private SignatureInfo(
        string documentHash,
        string hashAlgorithm,
        string certificateIdentifier,
        DateTime signedAt,
        bool isValid,
        string? validationResult,
        string? policyOid)
    {
        DocumentHash = documentHash;
        HashAlgorithm = hashAlgorithm;
        CertificateIdentifier = certificateIdentifier;
        SignedAt = signedAt;
        IsValid = isValid;
        ValidationResult = validationResult;
        PolicyOid = policyOid;
    }

    public static SignatureInfo Create(
        string documentHash,
        string hashAlgorithm,
        string certificateIdentifier,
        DateTime signedAt,
        bool isValid,
        string? validationResult = null,
        string? policyOid = null)
    {
        if (string.IsNullOrWhiteSpace(documentHash))
            throw new DomainException("Document hash is required");
        if (string.IsNullOrWhiteSpace(hashAlgorithm))
            throw new DomainException("Hash algorithm is required");
        if (string.IsNullOrWhiteSpace(certificateIdentifier))
            throw new DomainException("Certificate identifier is required");

        return new SignatureInfo(
            documentHash.Trim(),
            hashAlgorithm.Trim(),
            certificateIdentifier.Trim(),
            signedAt,
            isValid,
            string.IsNullOrWhiteSpace(validationResult) ? null : validationResult.Trim(),
            string.IsNullOrWhiteSpace(policyOid) ? null : policyOid.Trim());
    }

    public bool Equals(SignatureInfo? other)
    {
        if (other is null) return false;
        return DocumentHash == other.DocumentHash &&
               HashAlgorithm == other.HashAlgorithm &&
               CertificateIdentifier == other.CertificateIdentifier &&
               SignedAt == other.SignedAt &&
               IsValid == other.IsValid &&
               ValidationResult == other.ValidationResult &&
               PolicyOid == other.PolicyOid;
    }

    public override bool Equals(object? obj) => Equals(obj as SignatureInfo);
    public override int GetHashCode() =>
        HashCode.Combine(DocumentHash, HashAlgorithm, CertificateIdentifier, SignedAt, IsValid, ValidationResult, PolicyOid);
}

