using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

public class DoctorProfile : Entity
{
    public Guid UserId { get; private set; }
    public string Crm { get; private set; }
    public string CrmState { get; private set; }
    public string Specialty { get; private set; }
    public string? ProfessionalAddress { get; private set; }
    public string? ProfessionalPostalCode { get; private set; }
    public string? ProfessionalStreet { get; private set; }
    public string? ProfessionalNumber { get; private set; }
    public string? ProfessionalNeighborhood { get; private set; }
    public string? ProfessionalComplement { get; private set; }
    public string? ProfessionalCity { get; private set; }
    public string? ProfessionalState { get; private set; }
    public string? ProfessionalPhone { get; private set; }
    public string? University { get; private set; }
    public string? Courses { get; private set; }
    public string? HospitalsServices { get; private set; }
    public string? Bio { get; private set; }
    public decimal Rating { get; private set; }
    public int TotalConsultations { get; private set; }
    public bool Available { get; private set; }
    public DoctorApprovalStatus ApprovalStatus { get; private set; } = DoctorApprovalStatus.Pending;

    // Referência ao certificado digital ativo
    public Guid? ActiveCertificateId { get; private set; }

    // Validação CRM
    public bool CrmValidated { get; private set; }
    public DateTime? CrmValidatedAt { get; private set; }

    private DoctorProfile() : base()
    {
        Crm = null!;
        CrmState = null!;
        Specialty = null!;
    }

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
        DoctorApprovalStatus approvalStatus,
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
        ApprovalStatus = approvalStatus;
    }

    private const int CrmMaxLength = 20;
    private const int CrmStateLength = 2;
    private const int SpecialtyMaxLength = 100;
    private const int BioMaxLength = 5000;
    private const int ExtendedFieldMaxLength = 500;

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
            false,
            DoctorApprovalStatus.Pending);
    }

    public void UpdateProfile(string? bio = null, string? specialty = null, string? professionalAddress = null, string? professionalPhone = null, string? university = null, string? courses = null, string? hospitalsServices = null, string? professionalPostalCode = null, string? professionalStreet = null, string? professionalNumber = null, string? professionalNeighborhood = null, string? professionalComplement = null, string? professionalCity = null, string? professionalState = null)
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

        if (professionalAddress != null)
            ProfessionalAddress = professionalAddress;
        if (professionalPhone != null)
            ProfessionalPhone = professionalPhone;
        if (professionalPostalCode != null)
            ProfessionalPostalCode = professionalPostalCode;
        if (professionalStreet != null)
            ProfessionalStreet = professionalStreet;
        if (professionalNumber != null)
            ProfessionalNumber = professionalNumber;
        if (professionalNeighborhood != null)
            ProfessionalNeighborhood = professionalNeighborhood;
        if (professionalComplement != null)
            ProfessionalComplement = professionalComplement;
        if (professionalCity != null)
            ProfessionalCity = professionalCity;
        if (professionalState != null)
            ProfessionalState = professionalState;

        if (university != null)
        {
            if (university.Length > ExtendedFieldMaxLength)
                throw new DomainException($"University cannot exceed {ExtendedFieldMaxLength} characters");
            University = university;
        }
        if (courses != null)
        {
            if (courses.Length > ExtendedFieldMaxLength)
                throw new DomainException($"Courses cannot exceed {ExtendedFieldMaxLength} characters");
            Courses = courses;
        }
        if (hospitalsServices != null)
        {
            if (hospitalsServices.Length > ExtendedFieldMaxLength)
                throw new DomainException($"HospitalsServices cannot exceed {ExtendedFieldMaxLength} characters");
            HospitalsServices = hospitalsServices;
        }
    }

    public void SetAvailability(bool available)
    {
        Available = available;
    }

    public void Approve()
    {
        ApprovalStatus = DoctorApprovalStatus.Approved;
        Available = true;
    }

    public void Reject()
    {
        ApprovalStatus = DoctorApprovalStatus.Rejected;
        Available = false;
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
        DoctorApprovalStatus approvalStatus,
        Guid? activeCertificateId,
        bool crmValidated,
        DateTime? crmValidatedAt,
        DateTime createdAt,
        string? professionalAddress = null,
        string? professionalPhone = null,
        string? university = null,
        string? courses = null,
        string? hospitalsServices = null,
        string? professionalPostalCode = null,
        string? professionalStreet = null,
        string? professionalNumber = null,
        string? professionalNeighborhood = null,
        string? professionalComplement = null,
        string? professionalCity = null,
        string? professionalState = null)
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
            approvalStatus,
            createdAt)
        {
            ActiveCertificateId = activeCertificateId,
            CrmValidated = crmValidated,
            CrmValidatedAt = crmValidatedAt,
            ProfessionalAddress = professionalAddress,
            ProfessionalPhone = professionalPhone,
            University = university,
            Courses = courses,
            HospitalsServices = hospitalsServices,
            ProfessionalPostalCode = professionalPostalCode,
            ProfessionalStreet = professionalStreet,
            ProfessionalNumber = professionalNumber,
            ProfessionalNeighborhood = professionalNeighborhood,
            ProfessionalComplement = professionalComplement,
            ProfessionalCity = professionalCity,
            ProfessionalState = professionalState
        };
    }
}
