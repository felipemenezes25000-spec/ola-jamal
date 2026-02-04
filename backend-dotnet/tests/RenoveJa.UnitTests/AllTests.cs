using Xunit;
using Moq;
using FluentAssertions;
using RenoveJa.Application.Services.Auth;
using RenoveJa.Application.DTOs.Auth;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;
using RenoveJa.Domain.ValueObjects;

namespace RenoveJa.UnitTests.Application
{
public class AuthServiceTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IDoctorRepository> _doctorRepositoryMock;
    private readonly Mock<IAuthTokenRepository> _tokenRepositoryMock;
    private readonly AuthService _authService;

    public AuthServiceTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _doctorRepositoryMock = new Mock<IDoctorRepository>();
        _tokenRepositoryMock = new Mock<IAuthTokenRepository>();
        
        _authService = new AuthService(
            _userRepositoryMock.Object,
            _doctorRepositoryMock.Object,
            _tokenRepositoryMock.Object);
    }

    [Fact]
    public async Task RegisterAsync_ShouldCreateUserAndToken_WhenValidRequest()
    {
        // Arrange
        var request = new RegisterRequestDto(
            "John Doe",
            "john@example.com",
            "password123");

        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync(It.IsAny<string>(), default))
            .ReturnsAsync(false);
        
        _userRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<User>(), default))
            .ReturnsAsync((User user, CancellationToken _) => user);

        _tokenRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<AuthToken>(), default))
            .ReturnsAsync((AuthToken token, CancellationToken _) => token);

        // Act
        var response = await _authService.RegisterAsync(request);

        // Assert
        response.Should().NotBeNull();
        response.User.Should().NotBeNull();
        response.User.Email.Should().Be("john@example.com");
        response.Token.Should().NotBeNullOrEmpty();
        
        _userRepositoryMock.Verify(x => x.CreateAsync(It.IsAny<User>(), default), Times.Once);
        _tokenRepositoryMock.Verify(x => x.CreateAsync(It.IsAny<AuthToken>(), default), Times.Once);
    }

    [Fact]
    public async Task RegisterAsync_ShouldThrow_WhenEmailAlreadyExists()
    {
        // Arrange
        var request = new RegisterRequestDto(
            "John Doe",
            "john@example.com",
            "password123");

        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync(It.IsAny<string>(), default))
            .ReturnsAsync(true);

        // Act
        Func<Task> act = async () => await _authService.RegisterAsync(request);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Email already registered");
    }

    [Fact]
    public async Task LoginAsync_ShouldReturnToken_WhenCredentialsValid()
    {
        // Arrange
        var request = new LoginRequestDto("john@example.com", "password123");
        
        var passwordHash = BCrypt.Net.BCrypt.HashPassword("password123");
        var user = User.Reconstitute(
            Guid.NewGuid(),
            "John Doe",
            "john@example.com",
            passwordHash,
            "patient",
            null,
            null,
            null,
            null,
            DateTime.UtcNow,
            DateTime.UtcNow);

        _userRepositoryMock.Setup(x => x.GetByEmailAsync(It.IsAny<string>(), default))
            .ReturnsAsync(user);

        _tokenRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<AuthToken>(), default))
            .ReturnsAsync((AuthToken token, CancellationToken _) => token);

        // Act
        var response = await _authService.LoginAsync(request);

        // Assert
        response.Should().NotBeNull();
        response.User.Email.Should().Be("john@example.com");
        response.Token.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task LoginAsync_ShouldThrow_WhenUserNotFound()
    {
        // Arrange
        var request = new LoginRequestDto("notfound@example.com", "password123");

        _userRepositoryMock.Setup(x => x.GetByEmailAsync(It.IsAny<string>(), default))
            .ReturnsAsync((User?)null);

        // Act
        Func<Task> act = async () => await _authService.LoginAsync(request);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Invalid email or password");
    }

    [Fact]
    public async Task LoginAsync_ShouldThrow_WhenPasswordIncorrect()
    {
        // Arrange
        var request = new LoginRequestDto("john@example.com", "wrongpassword");
        
        var passwordHash = BCrypt.Net.BCrypt.HashPassword("correctpassword");
        var user = User.Reconstitute(
            Guid.NewGuid(),
            "John Doe",
            "john@example.com",
            passwordHash,
            "patient",
            null,
            null,
            null,
            null,
            DateTime.UtcNow,
            DateTime.UtcNow);

        _userRepositoryMock.Setup(x => x.GetByEmailAsync(It.IsAny<string>(), default))
            .ReturnsAsync(user);

        // Act
        Func<Task> act = async () => await _authService.LoginAsync(request);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Invalid email or password");
    }
}
}

namespace RenoveJa.UnitTests.Domain
{
public class UserTests
{
    [Fact]
    public void CreatePatient_ShouldCreateValidUser()
    {
        // Act
        var user = User.CreatePatient(
            "John Doe",
            "john@example.com",
            "hashedpassword",
            "+1234567890",
            "12345678901",
            new DateTime(1990, 1, 1));

        // Assert
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
        // Act
        Action act = () => User.CreatePatient(
            "",
            "john@example.com",
            "hashedpassword");

        // Assert
        act.Should().Throw<DomainException>()
            .WithMessage("Name is required");
    }

    [Fact]
    public void CreateDoctor_ShouldCreateValidUser()
    {
        // Act
        var user = User.CreateDoctor(
            "Dr. Smith",
            "smith@example.com",
            "hashedpassword",
            "+1234567890");

        // Assert
        user.Should().NotBeNull();
        user.Name.Should().Be("Dr. Smith");
        user.Role.Should().Be(UserRole.Doctor);
        user.IsDoctor().Should().BeTrue();
        user.IsPatient().Should().BeFalse();
    }

    [Fact]
    public void UpdatePassword_ShouldUpdatePasswordHash()
    {
        // Arrange
        var user = User.CreatePatient(
            "John Doe",
            "john@example.com",
            "oldpassword");

        // Act
        user.UpdatePassword("newpassword");

        // Assert
        user.PasswordHash.Should().Be("newpassword");
    }
}

public class EmailTests
{
    [Fact]
    public void Create_ShouldCreateValidEmail()
    {
        // Act
        var email = Email.Create("test@example.com");

        // Assert
        email.Should().NotBeNull();
        email.Value.Should().Be("test@example.com");
    }

    [Fact]
    public void Create_ShouldThrow_WhenInvalidFormat()
    {
        // Act
        Action act = () => Email.Create("invalidemail");

        // Assert
        act.Should().Throw<DomainException>()
            .WithMessage("Invalid email format");
    }

    [Fact]
    public void Create_ShouldNormalizeToLowerCase()
    {
        // Act
        var email = Email.Create("TEST@EXAMPLE.COM");

        // Assert
        email.Value.Should().Be("test@example.com");
    }
}

public class MoneyTests
{
    [Fact]
    public void Create_ShouldCreateValidMoney()
    {
        // Act
        var money = Money.Create(100.50m);

        // Assert
        money.Should().NotBeNull();
        money.Amount.Should().Be(100.50m);
        money.Currency.Should().Be("BRL");
    }

    [Fact]
    public void Create_ShouldThrow_WhenNegativeAmount()
    {
        // Act
        Action act = () => Money.Create(-10);

        // Assert
        act.Should().Throw<DomainException>()
            .WithMessage("Amount cannot be negative");
    }

    [Fact]
    public void Add_ShouldAddTwoMoneyObjects()
    {
        // Arrange
        var money1 = Money.Create(100);
        var money2 = Money.Create(50);

        // Act
        var result = money1.Add(money2);

        // Assert
        result.Amount.Should().Be(150);
    }

    [Fact]
    public void Subtract_ShouldSubtractTwoMoneyObjects()
    {
        // Arrange
        var money1 = Money.Create(100);
        var money2 = Money.Create(30);

        // Act
        var result = money1.Subtract(money2);

        // Assert
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
        // Arrange
        var patientId = Guid.NewGuid();
        var medications = new List<string> { "Paracetamol 500mg", "Ibuprofeno 400mg" };

        // Act
        var request = MedicalRequest.CreatePrescription(
            patientId,
            "John Doe",
            PrescriptionType.Simple,
            medications);

        // Assert
        request.Should().NotBeNull();
        request.PatientId.Should().Be(patientId);
        request.RequestType.Should().Be(RequestType.Prescription);
        request.Status.Should().Be(RequestStatus.Submitted);
        request.Medications.Should().HaveCount(2);
    }

    [Fact]
    public void Approve_ShouldUpdateStatusAndPrice()
    {
        // Arrange
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(),
            "John Doe",
            PrescriptionType.Simple,
            new List<string> { "Med1" });

        // Act
        request.Approve(50.00m, "Approved by Dr. Smith");

        // Assert
        request.Status.Should().Be(RequestStatus.ApprovedPendingPayment);
        request.Price.Should().NotBeNull();
        request.Price!.Amount.Should().Be(50.00m);
        request.Notes.Should().Be("Approved by Dr. Smith");
    }

    [Fact]
    public void Reject_ShouldUpdateStatusAndReason()
    {
        // Arrange
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(),
            "John Doe",
            PrescriptionType.Simple,
            new List<string> { "Med1" });

        // Act
        request.Reject("Invalid prescription");

        // Assert
        request.Status.Should().Be(RequestStatus.Rejected);
        request.RejectionReason.Should().Be("Invalid prescription");
    }

    [Fact]
    public void MarkAsPaid_ShouldUpdateStatus()
    {
        // Arrange
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(),
            "John Doe",
            PrescriptionType.Simple,
            new List<string> { "Med1" });
        
        request.Approve(50.00m);

        // Act
        request.MarkAsPaid();

        // Assert
        request.Status.Should().Be(RequestStatus.Paid);
    }
}

public class PaymentTests
{
    [Fact]
    public void CreatePixPayment_ShouldCreateValidPayment()
    {
        // Arrange
        var requestId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        // Act
        var payment = Payment.CreatePixPayment(requestId, userId, 100.00m);

        // Assert
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
        // Arrange
        var payment = Payment.CreatePixPayment(Guid.NewGuid(), Guid.NewGuid(), 100.00m);

        // Act
        payment.Approve();

        // Assert
        payment.Status.Should().Be(PaymentStatus.Approved);
        payment.PaidAt.Should().NotBeNull();
    }

    [Fact]
    public void Approve_ShouldThrow_WhenNotPending()
    {
        // Arrange
        var payment = Payment.CreatePixPayment(Guid.NewGuid(), Guid.NewGuid(), 100.00m);
        payment.Approve();

        // Act
        Action act = () => payment.Approve();

        // Assert
        act.Should().Throw<DomainException>()
            .WithMessage("Only pending payments can be approved");
    }
}
}

namespace RenoveJa.UnitTests.DTOs
{
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
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Patient",
            Guid.NewGuid(),
            "Doctor",
            "prescription",
            "submitted",
            "simple",
            new List<string> { "Med1" },
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            now,
            now);

        dto.RequestType.Should().Be("prescription");
        dto.Status.Should().Be("submitted");
        dto.Medications.Should().HaveCount(1);
    }
}
}
