namespace RenoveJa.Application.DTOs.Doctors;

/// <summary>Item da listagem de médicos (admin e listagem pública). Inclui dados do User e DoctorProfile para aprovação/reprovação.</summary>
public record DoctorListResponseDto(
    Guid Id,
    string Name,
    string Email,
    string? Phone,
    string? AvatarUrl,
    string Crm,
    string CrmState,
    string Specialty,
    string? Bio,
    decimal Rating,
    int TotalConsultations,
    bool Available,
    string ApprovalStatus,
    DateTime? BirthDate = null,
    string? Cpf = null,
    string? Street = null,
    string? Number = null,
    string? Neighborhood = null,
    string? Complement = null,
    string? City = null,
    string? State = null,
    string? PostalCode = null,
    string? ProfessionalAddress = null,
    string? ProfessionalPhone = null,
    string? ProfessionalPostalCode = null,
    string? ProfessionalStreet = null,
    string? ProfessionalNumber = null,
    string? ProfessionalNeighborhood = null,
    string? ProfessionalComplement = null,
    string? ProfessionalCity = null,
    string? ProfessionalState = null,
    string? University = null,
    string? Courses = null,
    string? HospitalsServices = null
);

public record UpdateDoctorAvailabilityDto(
    bool Available
);

/// <summary>Atualiza endereço e telefone profissional (obrigatórios para assinar receitas).</summary>
public record UpdateDoctorProfileDto(
    string? ProfessionalAddress,
    string? ProfessionalPhone,
    string? ProfessionalPostalCode = null,
    string? ProfessionalStreet = null,
    string? ProfessionalNumber = null,
    string? ProfessionalNeighborhood = null,
    string? ProfessionalComplement = null,
    string? ProfessionalCity = null,
    string? ProfessionalState = null
);
