namespace RenoveJa.Application.DTOs.Doctors;

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
    bool Available
);

public record UpdateDoctorAvailabilityDto(
    bool Available
);

/// <summary>Atualiza endereço e telefone profissional (obrigatórios para assinar receitas).</summary>
public record UpdateDoctorProfileDto(
    string? ProfessionalAddress,
    string? ProfessionalPhone
);
