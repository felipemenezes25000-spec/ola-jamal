using Xunit;
using FluentAssertions;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;
using RenoveJa.Domain.ValueObjects;

namespace RenoveJa.UnitTests.Domain;

public class UserTests
{
    [Fact]
    public void CreatePatient_ShouldCreateValidUser()
    {
        var user = User.CreatePatient(
            "John Doe",
            "john@example.com",
            "hashedpassword",
            "12345678901",
            "11987654321",
            new DateTime(1990, 1, 1));

        user.Should().NotBeNull();
        user.Name.Should().Be("John Doe");
        user.Email.Value.Should().Be("john@example.com");
        user.Role.Should().Be(UserRole.Patient);
        user.IsPatient().Should().BeTrue();
        user.IsDoctor().Should().BeFalse();
    }

    [Fact]
    public void CreatePatient_ShouldThrow_WhenNameEmpty()
    {
        Action act = () => User.CreatePatient(
            "",
            "john@example.com",
            "hashedpassword",
            "12345678901",
            "11987654321");

        act.Should().Throw<DomainException>()
            .WithMessage("Name is required");
    }

    [Fact]
    public void CreateDoctor_ShouldCreateValidUser()
    {
        var user = User.CreateDoctor(
            "Dr. Smith",
            "smith@example.com",
            "hashedpassword",
            "11987654321",
            "12345678901");

        user.Should().NotBeNull();
        user.Name.Should().Be("Dr. Smith");
        user.Role.Should().Be(UserRole.Doctor);
        user.IsDoctor().Should().BeTrue();
        user.IsPatient().Should().BeFalse();
    }

    [Fact]
    public void UpdatePassword_ShouldUpdatePasswordHash()
    {
        var user = User.CreatePatient(
            "John Doe",
            "john@example.com",
            "oldpassword",
            "12345678901",
            "11987654321");

        user.UpdatePassword("newpassword");

        user.PasswordHash.Should().Be("newpassword");
    }
}

public class EmailTests
{
    [Fact]
    public void Create_ShouldCreateValidEmail()
    {
        var email = Email.Create("test@example.com");

        email.Should().NotBeNull();
        email.Value.Should().Be("test@example.com");
    }

    [Fact]
    public void Create_ShouldThrow_WhenInvalidFormat()
    {
        Action act = () => Email.Create("invalidemail");

        act.Should().Throw<DomainException>()
            .WithMessage("Invalid email format");
    }

    [Fact]
    public void Create_ShouldNormalizeToLowerCase()
    {
        var email = Email.Create("TEST@EXAMPLE.COM");

        email.Value.Should().Be("test@example.com");
    }
}

public class MoneyTests
{
    [Fact]
    public void Create_ShouldCreateValidMoney()
    {
        var money = Money.Create(100.50m);

        money.Should().NotBeNull();
        money.Amount.Should().Be(100.50m);
        money.Currency.Should().Be("BRL");
    }

    [Fact]
    public void Create_ShouldThrow_WhenNegativeAmount()
    {
        Action act = () => Money.Create(-10);

        act.Should().Throw<DomainException>()
            .WithMessage("Amount cannot be negative");
    }

    [Fact]
    public void Add_ShouldAddTwoMoneyObjects()
    {
        var money1 = Money.Create(100);
        var money2 = Money.Create(50);

        var result = money1.Add(money2);

        result.Amount.Should().Be(150);
    }

    [Fact]
    public void Subtract_ShouldSubtractTwoMoneyObjects()
    {
        var money1 = Money.Create(100);
        var money2 = Money.Create(30);

        var result = money1.Subtract(money2);

        result.Amount.Should().Be(70);
    }
}

public class MedicalRequestTests
{
    [Fact]
    public void MedicalRequest_ShouldBeAggregateRoot()
    {
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(),
            "John Doe",
            PrescriptionType.Simple,
            new List<string> { "Med1" });

        request.Should().BeAssignableTo<AggregateRoot>();
        request.Should().BeAssignableTo<Entity>();
    }

    [Fact]
    public void CreatePrescription_ShouldCreateValidRequest()
    {
        var patientId = Guid.NewGuid();
        var medications = new List<string> { "Paracetamol 500mg", "Ibuprofeno 400mg" };

        var request = MedicalRequest.CreatePrescription(
            patientId,
            "John Doe",
            PrescriptionType.Simple,
            medications);

        request.Should().NotBeNull();
        request.PatientId.Should().Be(patientId);
        request.RequestType.Should().Be(RequestType.Prescription);
        request.Status.Should().Be(RequestStatus.Submitted);
        request.Medications.Should().HaveCount(2);
    }

    [Fact]
    public void Approve_ShouldUpdateStatusAndPrice()
    {
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(),
            "John Doe",
            PrescriptionType.Simple,
            new List<string> { "Med1" });

        request.Approve(50.00m, "Approved by Dr. Smith");

        request.Status.Should().Be(RequestStatus.ApprovedPendingPayment);
        request.Price.Should().NotBeNull();
        request.Price!.Amount.Should().Be(50.00m);
        request.Notes.Should().Be("Approved by Dr. Smith");
    }

    [Fact]
    public void Reject_ShouldUpdateStatusAndReason()
    {
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(),
            "John Doe",
            PrescriptionType.Simple,
            new List<string> { "Med1" });

        request.Reject("Invalid prescription");

        request.Status.Should().Be(RequestStatus.Rejected);
        request.RejectionReason.Should().Be("Invalid prescription");
    }

    [Fact]
    public void MarkAsPaid_ShouldUpdateStatus()
    {
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(),
            "John Doe",
            PrescriptionType.Simple,
            new List<string> { "Med1" });

        request.Approve(50.00m);

        request.MarkAsPaid();

        request.Status.Should().Be(RequestStatus.Paid);
    }
}

public class PaymentTests
{
    [Fact]
    public void CreatePixPayment_ShouldCreateValidPayment()
    {
        var requestId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var payment = Payment.CreatePixPayment(requestId, userId, 100.00m);

        payment.Should().NotBeNull();
        payment.RequestId.Should().Be(requestId);
        payment.UserId.Should().Be(userId);
        payment.Amount.Amount.Should().Be(100.00m);
        payment.Status.Should().Be(PaymentStatus.Pending);
        payment.PaymentMethod.Should().Be("pix");
    }

    [Fact]
    public void Approve_ShouldUpdateStatus()
    {
        var payment = Payment.CreatePixPayment(Guid.NewGuid(), Guid.NewGuid(), 100.00m);

        payment.Approve();

        payment.Status.Should().Be(PaymentStatus.Approved);
        payment.PaidAt.Should().NotBeNull();
    }

    [Fact]
    public void Approve_ShouldThrow_WhenNotPending()
    {
        var payment = Payment.CreatePixPayment(Guid.NewGuid(), Guid.NewGuid(), 100.00m);
        payment.Approve();

        Action act = () => payment.Approve();

        act.Should().Throw<DomainException>()
            .WithMessage("Only pending payments can be approved");
    }
}
