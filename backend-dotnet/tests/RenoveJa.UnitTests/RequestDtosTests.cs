using Xunit;
using FluentAssertions;
using RenoveJa.Application.DTOs.Requests;

namespace RenoveJa.UnitTests.DTOs;

/// <summary>
/// Testes dos DTOs por bounded context (DDD).
/// Garante que a separação RequestDtos, PaymentDtos, etc. está correta.
/// </summary>
public class RequestDtosTests
{
    [Fact]
    public void RequestResponseDto_ShouldBeCreatable()
    {
        var now = DateTime.UtcNow;
        var dto = new RequestResponseDto(
            Guid.NewGuid(),       // Id
            Guid.NewGuid(),       // PatientId
            "Patient",            // PatientName
            Guid.NewGuid(),       // DoctorId
            "Doctor",             // DoctorName
            "prescription",       // RequestType
            "submitted",          // Status
            "simple",             // PrescriptionType
<<<<<<< HEAD
            null,                 // PrescriptionKind
=======
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
            new List<string> { "Med1" }, // Medications
            null,                 // PrescriptionImages
            null,                 // ExamType
            null,                 // Exams
            null,                 // ExamImages
            null,                 // Symptoms
            null,                 // Price
            null,                 // Notes
            null,                 // RejectionReason
            null,                 // AccessCode
            null,                 // SignedAt
            null,                 // SignedDocumentUrl
            null,                 // SignatureId
            now,                  // CreatedAt
            now);                 // UpdatedAt

        dto.RequestType.Should().Be("prescription");
        dto.Status.Should().Be("submitted");
        dto.Medications.Should().HaveCount(1);
    }
}
