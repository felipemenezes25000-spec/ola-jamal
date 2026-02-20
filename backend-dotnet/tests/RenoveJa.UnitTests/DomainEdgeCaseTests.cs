using Xunit;
using FluentAssertions;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;

namespace RenoveJa.UnitTests.Domain;

public class DomainEdgeCaseTests
{
    // --- Payment edge cases ---

    [Fact]
    public void Payment_SetPixData_ShouldSetAllFields()
    {
        var p = Payment.CreatePixPayment(Guid.NewGuid(), Guid.NewGuid(), 100);
        p.SetPixData("ext-123", "qrcode", "base64", "copypaste");
        p.ExternalId.Should().Be("ext-123");
        p.PixQrCode.Should().Be("qrcode");
        p.PixQrCodeBase64.Should().Be("base64");
        p.PixCopyPaste.Should().Be("copypaste");
    }

    [Fact]
    public void Payment_SetExternalId_ShouldSet()
    {
        var p = Payment.CreatePixPayment(Guid.NewGuid(), Guid.NewGuid(), 100);
        p.SetExternalId("mp-12345");
        p.ExternalId.Should().Be("mp-12345");
    }

    [Fact]
    public void Payment_Refund_ShouldSetRefunded()
    {
        var p = Payment.CreatePixPayment(Guid.NewGuid(), Guid.NewGuid(), 100);
        p.Approve();
        p.Refund();
        p.Status.Should().Be(PaymentStatus.Refunded);
    }

    [Fact]
    public void Payment_IsApproved_ShouldReturnCorrectly()
    {
        var p = Payment.CreatePixPayment(Guid.NewGuid(), Guid.NewGuid(), 100);
        p.IsApproved().Should().BeFalse();
        p.Approve();
        p.IsApproved().Should().BeTrue();
    }

    [Fact]
    public void Payment_CreateCheckoutPro_ShouldWork()
    {
        var p = Payment.CreateCheckoutProPayment(Guid.NewGuid(), Guid.NewGuid(), 200);
        p.PaymentMethod.Should().Be("checkout_pro");
        p.Status.Should().Be(PaymentStatus.Pending);
    }

    [Fact]
    public void Payment_Reconstitute_ShouldPreserveFields()
    {
        var id = Guid.NewGuid();
        var reqId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        var p = Payment.Reconstitute(id, reqId, userId, 150, "Approved", "pix",
            "ext-1", "qr", "qr64", "copy", now, now, now);

        p.Id.Should().Be(id);
        p.RequestId.Should().Be(reqId);
        p.Amount.Amount.Should().Be(150);
        p.Status.Should().Be(PaymentStatus.Approved);
        p.PaidAt.Should().Be(now);
    }

    // --- MedicalRequest domain edge cases ---

    [Fact]
    public void MedicalRequest_UpdatePrescriptionContent_ShouldUpdate()
    {
        var r = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "Old" });
        r.Approve(50);
        r.MarkAsPaid();
        r.UpdatePrescriptionContent(new List<string> { "New1", "New2" }, "New notes");
        r.Medications.Should().Contain("New1");
        r.Notes.Should().Be("New notes");
    }

    [Fact]
    public void MedicalRequest_UpdateExamContent_ShouldUpdate()
    {
        var r = MedicalRequest.CreateExam(Guid.NewGuid(), "P", "sangue", new List<string> { "Old" }, "S");
        r.Approve(50);
        r.MarkAsPaid();
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
