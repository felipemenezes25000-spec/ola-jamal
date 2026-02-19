using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

public class DoctorProfile : Entity
{
    public Guid UserId { get; private set; }
    public string Crm { get; private set; }
    public string CrmState { get; private set; }
    public string Specialty { get; private set; }
<<<<<<< HEAD
    public string? ProfessionalAddress { get; private set; }
    public string? ProfessionalPhone { get; private set; }
=======
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
    public string? Bio { get; private set; }
    public decimal Rating { get; private set; }
    public int TotalConsultations { get; private set; }
    public bool Available { get; private set; }
<<<<<<< HEAD

    // Referência ao certificado digital ativo
    public Guid? ActiveCertificateId { get; private set; }

=======
    
    // Referência ao certificado digital ativo
    public Guid? ActiveCertificateId { get; private set; }
    
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
    // Validação CRM
    public bool CrmValidated { get; private set; }
    public DateTime? CrmValidatedAt { get; private set; }

<<<<<<< HEAD
    private DoctorProfile() : base()
    {
        Crm = null!;
        CrmState = null!;
        Specialty = null!;
    }
=======
    private DoctorProfile() : base() { }
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55

    private DoctorProfile(
        Guid id,
        Guid userId,
        string crm,
        string crmState,
        string specialty,
        string? bio,
        decimal rating,
        int totalConsultations,
        bool available,
        DateTime? createdAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        UserId = userId;
        Crm = crm;
        CrmState = crmState;
        Specialty = specialty;
        Bio = bio;
        Rating = rating;
        TotalConsultations = totalConsultations;
        Available = available;
    }

    private const int CrmMaxLength = 20;
    private const int CrmStateLength = 2;
    private const int SpecialtyMaxLength = 100;
    private const int BioMaxLength = 5000;

    public static DoctorProfile Create(
        Guid userId,
        string crm,
        string crmState,
        string specialty,
        string? bio = null)
    {
        if (userId == Guid.Empty)
            throw new DomainException("User ID is required");

        if (string.IsNullOrWhiteSpace(crm))
            throw new DomainException("CRM is required");
        if (crm.Length > CrmMaxLength)
            throw new DomainException($"CRM cannot exceed {CrmMaxLength} characters");

        if (string.IsNullOrWhiteSpace(crmState))
            throw new DomainException("CRM State is required");

        var hasNumbers = crmState.Any(char.IsNumber);
        if (hasNumbers || crmState.Trim().Length != CrmStateLength)
            throw new DomainException($"CRM State must be exactly {CrmStateLength} characters (state abbreviation)");

        if (string.IsNullOrWhiteSpace(specialty))
            throw new DomainException("Specialty is required");
        if (specialty.Length > SpecialtyMaxLength)
            throw new DomainException($"Specialty cannot exceed {SpecialtyMaxLength} characters");

        if (bio != null && bio.Length > BioMaxLength)
            throw new DomainException($"Bio cannot exceed {BioMaxLength} characters");

        return new DoctorProfile(
            Guid.NewGuid(),
            userId,
            crm,
            crmState,
            specialty,
            bio,
            5.0m,
            0,
            false);
    }

<<<<<<< HEAD
    public void UpdateProfile(string? bio = null, string? specialty = null, string? professionalAddress = null, string? professionalPhone = null)
=======
    public void UpdateProfile(string? bio = null, string? specialty = null)
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
    {
        if (!string.IsNullOrWhiteSpace(bio))
        {
            if (bio.Length > BioMaxLength)
                throw new DomainException($"Bio cannot exceed {BioMaxLength} characters");
            Bio = bio;
        }

        if (!string.IsNullOrWhiteSpace(specialty))
        {
            if (specialty.Length > SpecialtyMaxLength)
                throw new DomainException($"Specialty cannot exceed {SpecialtyMaxLength} characters");
            Specialty = specialty;
        }
<<<<<<< HEAD

        if (professionalAddress != null)
            ProfessionalAddress = professionalAddress;
        if (professionalPhone != null)
            ProfessionalPhone = professionalPhone;
=======
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
    }

    public void SetAvailability(bool available)
    {
        Available = available;
    }

    public void IncrementConsultations()
    {
        TotalConsultations++;
    }

    public void UpdateRating(decimal newRating)
    {
        if (newRating < 0 || newRating > 5)
            throw new DomainException("Rating must be between 0 and 5");

        Rating = newRating;
    }

    public void SetActiveCertificate(Guid certificateId)
    {
        ActiveCertificateId = certificateId;
    }

    public void ClearActiveCertificate()
    {
        ActiveCertificateId = null;
    }

    public void MarkCrmAsValidated()
    {
        CrmValidated = true;
        CrmValidatedAt = DateTime.UtcNow;
    }

    public static DoctorProfile Reconstitute(
        Guid id,
        Guid userId,
        string crm,
        string crmState,
        string specialty,
        string? bio,
        decimal rating,
        int totalConsultations,
        bool available,
        Guid? activeCertificateId,
        bool crmValidated,
        DateTime? crmValidatedAt,
<<<<<<< HEAD
        DateTime createdAt,
        string? professionalAddress = null,
        string? professionalPhone = null)
=======
        DateTime createdAt)
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
    {
        return new DoctorProfile(
            id,
            userId,
            crm,
            crmState,
            specialty,
            bio,
            rating,
            totalConsultations,
            available,
            createdAt)
        {
            ActiveCertificateId = activeCertificateId,
            CrmValidated = crmValidated,
<<<<<<< HEAD
            CrmValidatedAt = crmValidatedAt,
            ProfessionalAddress = professionalAddress,
            ProfessionalPhone = professionalPhone
=======
            CrmValidatedAt = crmValidatedAt
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
        };
    }
}
