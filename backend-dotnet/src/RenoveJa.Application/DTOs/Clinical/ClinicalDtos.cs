using RenoveJa.Domain.Enums;

namespace RenoveJa.Application.DTOs.Clinical;

public sealed class PatientSummaryDto
{
    public Guid Id { get; set; }
    public PatientIdentifierDto Identifier { get; set; } = new();
    public PatientNameDto Name { get; set; } = new();
    public DateTime? BirthDate { get; set; }
    public string? Sex { get; set; }
    public PatientContactDto Contact { get; set; } = new();
    public PatientAddressDto? Address { get; set; }
    public PatientSummaryStatsDto Stats { get; set; } = new();
    public List<string> Medications { get; set; } = new();
    public List<string> Exams { get; set; } = new();
}

public sealed class PatientIdentifierDto
{
    public string Cpf { get; set; } = string.Empty;
}

public sealed class PatientNameDto
{
    public string Full { get; set; } = string.Empty;
    public string? Social { get; set; }
}

public sealed class PatientContactDto
{
    public string? Phone { get; set; }
    public string? Email { get; set; }
}

public sealed class PatientAddressDto
{
    public string? Line1 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? ZipCode { get; set; }
}

public sealed class PatientSummaryStatsDto
{
    public int TotalRequests { get; set; }
    public int TotalPrescriptions { get; set; }
    public int TotalExams { get; set; }
    public int TotalConsultations { get; set; }
    public DateTime? LastConsultationDate { get; set; }
    public int? LastConsultationDaysAgo { get; set; }
}

public sealed class EncounterSummaryDto
{
    public Guid Id { get; set; }
    public EncounterType Type { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public string? MainIcd10Code { get; set; }
}

public sealed class MedicalDocumentSummaryDto
{
    public Guid Id { get; set; }
    public DocumentType DocumentType { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? SignedAt { get; set; }
    public Guid? EncounterId { get; set; }
}

