using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

/// <summary>
/// Visão mínima do profissional de saúde para o prontuário,
/// conectando o usuário e o perfil de médico existente.
/// </summary>
public class Practitioner : AggregateRoot
{
    public Guid UserId { get; private set; }
    public Guid DoctorProfileId { get; private set; }

    public string Name { get; private set; }
    public string Crm { get; private set; }
    public string CrmState { get; private set; }
    public string Specialty { get; private set; }

    public bool Active { get; private set; }
    public DoctorApprovalStatus ApprovalStatus { get; private set; }

    public Guid? ActiveCertificateId { get; private set; }

    private Practitioner() : base()
    {
        Name = null!;
        Crm = null!;
        CrmState = null!;
        Specialty = null!;
        ApprovalStatus = DoctorApprovalStatus.Pending;
    }

    private Practitioner(
        Guid id,
        Guid userId,
        Guid doctorProfileId,
        string name,
        string crm,
        string crmState,
        string specialty,
        bool active,
        DoctorApprovalStatus approvalStatus,
        Guid? activeCertificateId,
        DateTime? createdAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        UserId = userId;
        DoctorProfileId = doctorProfileId;
        Name = name;
        Crm = crm;
        CrmState = crmState;
        Specialty = specialty;
        Active = active;
        ApprovalStatus = approvalStatus;
        ActiveCertificateId = activeCertificateId;
    }

    public static Practitioner FromDoctorProfile(
        Guid userId,
        DoctorProfile doctorProfile,
        string doctorName)
    {
        if (userId == Guid.Empty)
            throw new DomainException("UserId is required");
        if (doctorProfile is null)
            throw new ArgumentNullException(nameof(doctorProfile));

        return new Practitioner(
            Guid.NewGuid(),
            userId,
            doctorProfile.Id,
            doctorName,
            doctorProfile.Crm,
            doctorProfile.CrmState,
            doctorProfile.Specialty,
            doctorProfile.Available,
            doctorProfile.ApprovalStatus,
            doctorProfile.ActiveCertificateId);
    }

    public void SetActiveCertificate(Guid? certificateId)
    {
        ActiveCertificateId = certificateId;
    }

    public void SetAvailability(bool active)
    {
        Active = active;
    }

    public static Practitioner Reconstitute(
        Guid id,
        Guid userId,
        Guid doctorProfileId,
        string name,
        string crm,
        string crmState,
        string specialty,
        bool active,
        DoctorApprovalStatus approvalStatus,
        Guid? activeCertificateId,
        DateTime createdAt)
    {
        return new Practitioner(
            id,
            userId,
            doctorProfileId,
            name,
            crm,
            crmState,
            specialty,
            active,
            approvalStatus,
            activeCertificateId,
            createdAt);
    }
}

