using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

/// <summary>
/// Registro de consentimento LGPD associado a um paciente.
/// </summary>
public class ConsentRecord : AggregateRoot
{
    public Guid PatientId { get; private set; }
    public ConsentType ConsentType { get; private set; }
    public LegalBasis LegalBasis { get; private set; }
    public string Purpose { get; private set; }

    public DateTime AcceptedAt { get; private set; }
    public string Channel { get; private set; }
    public string? TextVersion { get; private set; }

    private ConsentRecord() : base()
    {
        Purpose = null!;
        Channel = null!;
    }

    private ConsentRecord(
        Guid id,
        Guid patientId,
        ConsentType consentType,
        LegalBasis legalBasis,
        string purpose,
        DateTime acceptedAt,
        string channel,
        string? textVersion,
        DateTime? createdAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        PatientId = patientId;
        ConsentType = consentType;
        LegalBasis = legalBasis;
        Purpose = purpose;
        AcceptedAt = acceptedAt;
        Channel = channel;
        TextVersion = textVersion;
    }

    public static ConsentRecord Create(
        Guid patientId,
        ConsentType consentType,
        LegalBasis legalBasis,
        string purpose,
        DateTime acceptedAt,
        string channel,
        string? textVersion)
    {
        if (patientId == Guid.Empty)
            throw new DomainException("PatientId is required");
        if (string.IsNullOrWhiteSpace(purpose))
            throw new DomainException("Purpose is required");
        if (string.IsNullOrWhiteSpace(channel))
            throw new DomainException("Channel is required");

        return new ConsentRecord(
            Guid.NewGuid(),
            patientId,
            consentType,
            legalBasis,
            purpose.Trim(),
            acceptedAt,
            channel.Trim(),
            string.IsNullOrWhiteSpace(textVersion) ? null : textVersion.Trim());
    }

    public static ConsentRecord Reconstitute(
        Guid id,
        Guid patientId,
        ConsentType consentType,
        LegalBasis legalBasis,
        string purpose,
        DateTime acceptedAt,
        string channel,
        string? textVersion,
        DateTime createdAt)
    {
        return new ConsentRecord(
            id,
            patientId,
            consentType,
            legalBasis,
            purpose,
            acceptedAt,
            channel,
            textVersion,
            createdAt);
    }
}

