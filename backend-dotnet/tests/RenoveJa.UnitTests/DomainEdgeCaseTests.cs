using Xunit;
using FluentAssertions;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;

namespace RenoveJa.UnitTests.Domain;

public class DomainEdgeCaseTests
{
    // --- MedicalRequest domain edge cases ---

    [Fact]
    public void MedicalRequest_UpdatePrescriptionContent_ShouldUpdate()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "Old" });
        r.Approve(0);
        r.UpdatePrescriptionContent(new List<string> { "New1", "New2" }, "New notes");
        r.Medications.Should().Contain("New1");
        r.Notes.Should().Be("New notes");
    }

    [Fact]
    public void MedicalRequest_UpdateExamContent_ShouldUpdate()
    {
        var r = MedicalRequest.CreateExam(Guid.NewGuid(), "P", "sangue", new List<string> { "Old" }, "S");
        r.Approve(0);
        r.UpdateExamContent(new List<string> { "Hemograma", "TSH" }, "Notes");
        r.Exams.Should().Contain("Hemograma");
        r.Notes.Should().Be("Notes");
    }

    [Fact]
    public void MedicalRequest_UpdateStatus_ShouldChangeToAnyStatus()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        r.UpdateStatus(RequestStatus.Paid);
        r.Status.Should().Be(RequestStatus.Paid);
    }

    // ── Testes de proteção contra status legados ──────────────

#pragma warning disable CS0618 // Uso intencional de legados nos testes de proteção

    [Theory]
    [InlineData(RequestStatus.Pending)]
    [InlineData(RequestStatus.Analyzing)]
    [InlineData(RequestStatus.Approved)]
    [InlineData(RequestStatus.Completed)]
    [InlineData(RequestStatus.PendingPayment)]
    public void MedicalRequest_UpdateStatus_WithLegacyStatus_ShouldThrowDomainException(RequestStatus legacy)
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });

        Action act = () => r.UpdateStatus(legacy);

        act.Should().Throw<DomainException>()
            .WithMessage($"*{legacy}*legado*");
    }

    [Theory]
    [InlineData(RequestStatus.Pending)]
    [InlineData(RequestStatus.Analyzing)]
    [InlineData(RequestStatus.Approved)]
    [InlineData(RequestStatus.Completed)]
    [InlineData(RequestStatus.PendingPayment)]
    public void RequestStatusExtensions_IsLegacy_ShouldReturnTrue_ForLegacyStatuses(RequestStatus legacy)
    {
        legacy.IsLegacy().Should().BeTrue();
    }

#pragma warning restore CS0618

    [Theory]
    [InlineData(RequestStatus.Submitted)]
    [InlineData(RequestStatus.InReview)]
    [InlineData(RequestStatus.ApprovedPendingPayment)]
    [InlineData(RequestStatus.Paid)]
    [InlineData(RequestStatus.Signed)]
    [InlineData(RequestStatus.Delivered)]
    [InlineData(RequestStatus.Rejected)]
    [InlineData(RequestStatus.Cancelled)]
    [InlineData(RequestStatus.SearchingDoctor)]
    [InlineData(RequestStatus.ConsultationReady)]
    [InlineData(RequestStatus.InConsultation)]
    [InlineData(RequestStatus.ConsultationFinished)]
    public void RequestStatusExtensions_IsLegacy_ShouldReturnFalse_ForCanonicalStatuses(RequestStatus canonical)
    {
        canonical.IsLegacy().Should().BeFalse();
    }

    // --- DoctorCertificate edge cases ---

    [Fact]
    public void DoctorCertificate_GetRemainingValidity_ShouldReturnZero_WhenExpired()
    {
        var cert = DoctorCertificate.Reconstitute(
            Guid.NewGuid(), Guid.NewGuid(), "CN=X", "ICP", "123",
            DateTime.UtcNow.AddYears(-2), DateTime.UtcNow.AddDays(-1),
            "path", "file", null, null, false, false, null, null,
            false, null, null, DateTime.UtcNow.AddYears(-1), null, DateTime.UtcNow.AddYears(-1));

        cert.GetRemainingValidity().Should().Be(TimeSpan.Zero);
    }

    [Fact]
    public void DoctorCertificate_ExtractDoctorName_ShouldReturnNull_WhenNoCN()
    {
        var cert = DoctorCertificate.Create(
            Guid.NewGuid(), "OU=CRM, O=ICP-Brasil", "ICP", "123",
            DateTime.UtcNow, DateTime.UtcNow.AddYears(1), "path", "file");
        cert.ExtractDoctorName().Should().BeNull();
    }
}
