using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

/// <summary>
/// Representa o certificado digital ICP-Brasil de um médico.
/// Armazena metadados do certificado (não a chave privada em texto plano).
/// </summary>
public class DoctorCertificate : Entity
{
    public Guid DoctorProfileId { get; private set; }

    // Dados do certificado
    public string SubjectName { get; private set; } // CN=MEDICO NOME, OU=CRM, O=ICP-Brasil...
    public string? Cpf { get; private set; }
    public string? CrmNumber { get; private set; }
    public string IssuerName { get; private set; }
    public string SerialNumber { get; private set; }
    public DateTime NotBefore { get; private set; }
    public DateTime NotAfter { get; private set; }

    // Referência ao arquivo PFX criptografado
    public string PfxStoragePath { get; private set; } // Caminho no storage (ex: Supabase)
    public string PfxFileName { get; private set; }

    // Status
    public bool IsValid { get; private set; }
    public bool IsExpired => DateTime.UtcNow > NotAfter;
    public bool IsRevoked { get; private set; }
    public DateTime? RevokedAt { get; private set; }
    public string? RevocationReason { get; private set; }

    // Validação
    public bool ValidatedAtRegistration { get; private set; }
    public DateTime? LastValidationDate { get; private set; }
    public string? LastValidationResult { get; private set; }

    // Auditoria
    public DateTime UploadedAt { get; private set; }
    public string? UploadedByIp { get; private set; }

    private DoctorCertificate() : base()
    {
        SubjectName = null!;
        IssuerName = null!;
        SerialNumber = null!;
        PfxStoragePath = null!;
        PfxFileName = null!;
    }

    private DoctorCertificate(
        Guid id,
        Guid doctorProfileId,
        string subjectName,
        string issuerName,
        string serialNumber,
        DateTime notBefore,
        DateTime notAfter,
        string pfxStoragePath,
        string pfxFileName,
        string? cpf,
        string? crmNumber,
        DateTime? createdAt = null) : base(id, createdAt ?? DateTime.UtcNow)
    {
        DoctorProfileId = doctorProfileId;
        SubjectName = subjectName;
        IssuerName = issuerName;
        SerialNumber = serialNumber;
        NotBefore = notBefore;
        NotAfter = notAfter;
        PfxStoragePath = pfxStoragePath;
        PfxFileName = pfxFileName;
        Cpf = cpf;
        CrmNumber = crmNumber;
        IsValid = true;
        IsRevoked = false;
        UploadedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Cria um novo certificado após validação bem-sucedida.
    /// </summary>
    public static DoctorCertificate Create(
        Guid doctorProfileId,
        string subjectName,
        string issuerName,
        string serialNumber,
        DateTime notBefore,
        DateTime notAfter,
        string pfxStoragePath,
        string pfxFileName,
        string? cpf = null,
        string? crmNumber = null)
    {
        if (doctorProfileId == Guid.Empty)
            throw new DomainException("Doctor profile ID is required");

        if (string.IsNullOrWhiteSpace(subjectName))
            throw new DomainException("Subject name is required");

        if (string.IsNullOrWhiteSpace(pfxStoragePath))
            throw new DomainException("PFX storage path is required");

        if (notAfter <= DateTime.UtcNow)
            throw new DomainException("Certificate is expired and cannot be registered");

        return new DoctorCertificate(
            Guid.NewGuid(),
            doctorProfileId,
            subjectName,
            issuerName,
            serialNumber,
            notBefore,
            notAfter,
            pfxStoragePath,
            pfxFileName,
            cpf,
            crmNumber);
    }

    public static DoctorCertificate Reconstitute(
        Guid id,
        Guid doctorProfileId,
        string subjectName,
        string issuerName,
        string serialNumber,
        DateTime notBefore,
        DateTime notAfter,
        string pfxStoragePath,
        string pfxFileName,
        string? cpf,
        string? crmNumber,
        bool isValid,
        bool isRevoked,
        DateTime? revokedAt,
        string? revocationReason,
        bool validatedAtRegistration,
        DateTime? lastValidationDate,
        string? lastValidationResult,
        DateTime uploadedAt,
        string? uploadedByIp,
        DateTime createdAt)
    {
        return new DoctorCertificate(
            id,
            doctorProfileId,
            subjectName,
            issuerName,
            serialNumber,
            notBefore,
            notAfter,
            pfxStoragePath,
            pfxFileName,
            cpf,
            crmNumber,
            createdAt)
        {
            IsValid = isValid,
            IsRevoked = isRevoked,
            RevokedAt = revokedAt,
            RevocationReason = revocationReason,
            ValidatedAtRegistration = validatedAtRegistration,
            LastValidationDate = lastValidationDate,
            LastValidationResult = lastValidationResult,
            UploadedByIp = uploadedByIp,
            UploadedAt = uploadedAt
        };
    }

    /// <summary>
    /// Marca como validado no momento do registro.
    /// </summary>
    public void MarkAsValidatedAtRegistration(string? validationResult = null)
    {
        ValidatedAtRegistration = true;
        LastValidationDate = DateTime.UtcNow;
        LastValidationResult = validationResult ?? "Validated successfully";
    }

    /// <summary>
    /// Atualiza resultado da última validação.
    /// </summary>
    public void UpdateValidation(bool isValid, string? result = null)
    {
        IsValid = isValid;
        LastValidationDate = DateTime.UtcNow;
        LastValidationResult = result;
    }

    /// <summary>
    /// Revoga o certificado.
    /// </summary>
    public void Revoke(string reason)
    {
        if (IsRevoked)
            return;

        IsRevoked = true;
        RevokedAt = DateTime.UtcNow;
        RevocationReason = reason;
        IsValid = false;
    }

    /// <summary>
    /// Verifica se o certificado está pronto para uso.
    /// </summary>
    public bool IsReadyForSigning()
    {
        return IsValid && !IsExpired && !IsRevoked && !string.IsNullOrWhiteSpace(PfxStoragePath);
    }

    /// <summary>
    /// Retorna o tempo restante até a expiração.
    /// </summary>
    public TimeSpan? GetRemainingValidity()
    {
        if (IsExpired)
            return TimeSpan.Zero;

        return NotAfter - DateTime.UtcNow;
    }

    /// <summary>
    /// Extrai o nome do médico do subject do certificado.
    /// </summary>
    public string? ExtractDoctorName()
    {
        // Formato típico: CN=NOME DO MEDICO, OU=...
        var cnMatch = System.Text.RegularExpressions.Regex.Match(SubjectName, @"CN=([^,]+)");
        return cnMatch.Success ? cnMatch.Groups[1].Value.Trim() : null;
    }
}
