using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

public class DoctorProfile : Entity
{
    public Guid UserId { get; private set; }
    public string Crm { get; private set; }
    public string CrmState { get; private set; }
    public string Specialty { get; private set; }
    public string? Bio { get; private set; }
    public decimal Rating { get; private set; }
    public int TotalConsultations { get; private set; }
    public bool Available { get; private set; }

    private DoctorProfile() : base() { }

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

        if (string.IsNullOrWhiteSpace(crmState))
            throw new DomainException("CRM State is required");

        if (string.IsNullOrWhiteSpace(specialty))
            throw new DomainException("Specialty is required");

        return new DoctorProfile(
            Guid.NewGuid(),
            userId,
            crm,
            crmState,
            specialty,
            bio,
            5.0m,
            0,
            true);
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
        DateTime createdAt)
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
            createdAt);
    }

    public void UpdateProfile(string? bio = null, string? specialty = null)
    {
        if (!string.IsNullOrWhiteSpace(bio))
            Bio = bio;

        if (!string.IsNullOrWhiteSpace(specialty))
            Specialty = specialty;
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
}
