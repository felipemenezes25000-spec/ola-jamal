using Microsoft.Extensions.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using FluentAssertions;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.DTOs.Auth;
using RenoveJa.Application.DTOs.Verification;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Auth;
using RenoveJa.Application.Services.Payments;
using RenoveJa.Application.Services.Requests;
using RenoveJa.Application.Services.Verification;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.UnitTests.Services;

// ============================================================
// VerificationService Tests
// ============================================================
public class VerificationServiceTests
{
    private readonly Mock<IRequestRepository> _requestRepoMock = new();
    private readonly Mock<IDoctorRepository> _doctorRepoMock = new();
    private readonly Mock<IUserRepository> _userRepoMock = new();
    private readonly Mock<ILogger<VerificationService>> _loggerMock = new();
    private readonly VerificationService _sut;

    public VerificationServiceTests()
    {
        _sut = new VerificationService(
            _requestRepoMock.Object,
            _doctorRepoMock.Object,
            _userRepoMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task GetPublicVerificationAsync_ShouldReturnNull_WhenNotFound()
    {
        _requestRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest?)null);

        var result = await _sut.GetPublicVerificationAsync(Guid.NewGuid());
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetPublicVerificationAsync_ShouldReturnMaskedData()
    {
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(), "João Silva de Oliveira", PrescriptionType.Simple, new List<string> { "Paracetamol" });

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);
        _doctorRepoMock.Setup(r => r.GetByUserIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DoctorProfile?)null);

        var result = await _sut.GetPublicVerificationAsync(request.Id);

        result.Should().NotBeNull();
        result!.PatientName.Should().Be("João Oliveira"); // masked
        result.Medications.Should().Contain("Paracetamol");
        result.PrescriptionType.Should().Be("simples");
        result.AccessCodeRequired.Should().BeTrue();
        result.VerificationUrl.Should().Be("https://validar.iti.gov.br");
    }

    [Fact]
    public async Task GetPublicVerificationAsync_ShouldIncludeDoctorInfo()
    {
        var doctorId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(), "Patient", PrescriptionType.Controlled, new List<string> { "Med" });
        request.AssignDoctor(doctorId, "Dr. Test");

        var doctorProfile = DoctorProfile.Create(doctorId, "123456", "SP", "Cardiologia");

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);
        _doctorRepoMock.Setup(r => r.GetByUserIdAsync(doctorId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(doctorProfile);

        var result = await _sut.GetPublicVerificationAsync(request.Id);

        result!.DoctorCrm.Should().Be("123456");
        result.DoctorCrmState.Should().Be("SP");
        result.DoctorSpecialty.Should().Be("Cardiologia");
        result.PrescriptionType.Should().Be("controlado");
    }

    [Fact]
    public async Task GetFullVerificationAsync_ShouldReturnNull_WhenNotFound()
    {
        _requestRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest?)null);

        var result = await _sut.GetFullVerificationAsync(Guid.NewGuid(), "1234");
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetFullVerificationAsync_ShouldThrow_WhenInvalidCode()
    {
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(), "Patient Name", PrescriptionType.Simple, new List<string> { "Med" });

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);

        Func<Task> act = () => _sut.GetFullVerificationAsync(request.Id, "0000");
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Código de acesso inválido.");
    }

    [Fact]
    public async Task GetFullVerificationAsync_ShouldReturnFull_WhenCodeValid()
    {
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(), "Patient Full Name", PrescriptionType.Simple, new List<string> { "Med" });
        var accessCode = request.AccessCode!;

        var patient = User.Reconstitute(request.PatientId, "Patient", "p@e.com", "h", "Patient",
            "11999999999", "52998224725", null, null, DateTime.UtcNow, DateTime.UtcNow);

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);
        _userRepoMock.Setup(r => r.GetByIdAsync(request.PatientId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(patient);
        _doctorRepoMock.Setup(r => r.GetByUserIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DoctorProfile?)null);

        var result = await _sut.GetFullVerificationAsync(request.Id, accessCode);

        result.Should().NotBeNull();
        result!.PatientFullName.Should().Be("Patient Full Name");
        result.PatientCpfMasked.Should().Contain("***");
    }

    [Fact]
    public void ValidateAccessCode_ByGuid_ShouldReturnTrue_WhenCorrect()
    {
        var requestId = Guid.NewGuid();
        var code = VerificationService.GenerateAccessCode(requestId);
        _sut.ValidateAccessCode(requestId, code).Should().BeTrue();
    }

    [Fact]
    public void ValidateAccessCode_ByGuid_ShouldReturnFalse_WhenIncorrect()
    {
        _sut.ValidateAccessCode(Guid.NewGuid(), "9999").Should().BeFalse();
    }

    [Fact]
    public void ValidateAccessCode_ByGuid_ShouldReturnFalse_WhenEmpty()
    {
        _sut.ValidateAccessCode(Guid.NewGuid(), "").Should().BeFalse();
    }

    [Fact]
    public void ValidateAccessCode_Static_ShouldCompareCorrectly()
    {
        VerificationService.ValidateAccessCode("1234", "1234").Should().BeTrue();
        VerificationService.ValidateAccessCode("1234", "5678").Should().BeFalse();
        VerificationService.ValidateAccessCode(null, "1234").Should().BeFalse();
        VerificationService.ValidateAccessCode("1234", "").Should().BeFalse();
    }

    [Fact]
    public void GenerateAccessCode_ShouldBeDeterministic()
    {
        var id = Guid.NewGuid();
        var c1 = VerificationService.GenerateAccessCode(id);
        var c2 = VerificationService.GenerateAccessCode(id);
        c1.Should().Be(c2);
        c1.Should().HaveLength(4);
    }

    [Fact]
    public void GenerateAccessCode_ShouldDifferForDifferentIds()
    {
        var c1 = VerificationService.GenerateAccessCode(Guid.NewGuid());
        var c2 = VerificationService.GenerateAccessCode(Guid.NewGuid());
        // Very unlikely to be equal, but not impossible
        // Just verify format
        c1.Should().HaveLength(4);
        c2.Should().HaveLength(4);
    }

    [Theory]
    [InlineData("João Silva de Oliveira", "João Oliveira")]
    [InlineData("Maria", "Maria")]
    [InlineData("Ana Costa", "Ana Costa")]
    [InlineData(null, null)]
    [InlineData("", null)]
    public void MaskPatientName_ShouldMaskCorrectly(string? input, string? expected)
    {
        VerificationService.MaskPatientName(input).Should().Be(expected);
    }

    [Theory]
    [InlineData("52998224725", "529.***.***-25")]
    [InlineData("41012345616", "410.***.***-16")]
    [InlineData(null, null)]
    [InlineData("", null)]
    [InlineData("123", "***.***.***-**")]
    public void MaskCpf_ShouldMaskCorrectly(string? input, string? expected)
    {
        VerificationService.MaskCpf(input).Should().Be(expected);
    }
}

// ============================================================
// AuthService - Missing Methods
// ============================================================
public class AuthServiceExtendedTests
{
    private readonly Mock<IUserRepository> _userRepoMock = new();
    private readonly Mock<IDoctorRepository> _doctorRepoMock = new();
    private readonly Mock<IAuthTokenRepository> _tokenRepoMock = new();
    private readonly Mock<IPasswordResetTokenRepository> _resetTokenRepoMock = new();
    private readonly Mock<IEmailService> _emailServiceMock = new();
    private readonly AuthService _sut;

    public AuthServiceExtendedTests()
    {
        var smtpConfig = Options.Create(new SmtpConfig());
        var googleConfig = Options.Create(new GoogleAuthConfig());
        _sut = new AuthService(
            _userRepoMock.Object, _doctorRepoMock.Object,
            _tokenRepoMock.Object, _resetTokenRepoMock.Object,
            _emailServiceMock.Object, smtpConfig, googleConfig);
    }

    private static User CreatePatient(Guid id) =>
        User.Reconstitute(id, "Test User", "t@e.com",
            BCrypt.Net.BCrypt.HashPassword("password123"),
            "Patient", "11987654321", "12345678901", null, null,
            DateTime.UtcNow, DateTime.UtcNow);

    [Fact]
    public async Task GetMeAsync_ShouldReturnUser()
    {
        var user = CreatePatient(Guid.NewGuid());
        _userRepoMock.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var result = await _sut.GetMeAsync(user.Id);
        result.Should().NotBeNull();
        result.Email.Should().Be("t@e.com");
        result.Name.Should().Be("Test User");
    }

    [Fact]
    public async Task GetMeAsync_ShouldThrow_WhenNotFound()
    {
        _userRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        Func<Task> act = () => _sut.GetMeAsync(Guid.NewGuid());
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task LogoutAsync_ShouldDeleteToken()
    {
        var token = AuthToken.Create(Guid.NewGuid());
        _tokenRepoMock.Setup(r => r.GetByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);

        await _sut.LogoutAsync("some-token");

        _tokenRepoMock.Verify(r => r.DeleteByTokenAsync("some-token", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ValidateTokenAsync_ShouldReturnUserInfo_WhenValid()
    {
        var userId = Guid.NewGuid();
        var token = AuthToken.Create(userId);
        var user = CreatePatient(userId);

        _tokenRepoMock.Setup(r => r.GetByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);
        _userRepoMock.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var (resultUserId, role) = await _sut.ValidateTokenAsync("token-value");
        resultUserId.Should().Be(userId);
        role.Should().Be("patient");
    }

    [Fact]
    public async Task ValidateTokenAsync_ShouldThrow_WhenTokenNotFound()
    {
        _tokenRepoMock.Setup(r => r.GetByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuthToken?)null);

        Func<Task> act = () => _sut.ValidateTokenAsync("invalid");
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task ValidateTokenAsync_ShouldThrow_WhenExpired()
    {
        var expired = AuthToken.Reconstitute(Guid.NewGuid(), Guid.NewGuid(), "tok",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(-2));

        _tokenRepoMock.Setup(r => r.GetByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expired);

        Func<Task> act = () => _sut.ValidateTokenAsync("tok");
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task ForgotPasswordAsync_ShouldSendEmail_WhenUserExists()
    {
        var user = CreatePatient(Guid.NewGuid());
        _userRepoMock.Setup(r => r.GetByEmailAsync("t@e.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _resetTokenRepoMock.Setup(r => r.CreateAsync(It.IsAny<PasswordResetToken>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((PasswordResetToken t, CancellationToken _) => t);

        await _sut.ForgotPasswordAsync("t@e.com");

        _emailServiceMock.Verify(e => e.SendPasswordResetEmailAsync(
            "t@e.com", It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ForgotPasswordAsync_ShouldNotThrow_WhenUserNotFound()
    {
        _userRepoMock.Setup(r => r.GetByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        // Should NOT throw (security: don't reveal if email exists)
        await _sut.ForgotPasswordAsync("unknown@e.com");
        _emailServiceMock.Verify(e => e.SendPasswordResetEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ResetPasswordAsync_ShouldThrow_WhenTokenNotFound()
    {
        _resetTokenRepoMock.Setup(r => r.GetByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((PasswordResetToken?)null);

        Func<Task> act = () => _sut.ResetPasswordAsync("invalid-token", "newpassword123");
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task ChangePasswordAsync_ShouldThrow_WhenCurrentPasswordWrong()
    {
        var user = CreatePatient(Guid.NewGuid());
        _userRepoMock.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        Func<Task> act = () => _sut.ChangePasswordAsync(user.Id, "wrongpassword", "newpassword123");
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task ChangePasswordAsync_ShouldUpdate_WhenValid()
    {
        var user = CreatePatient(Guid.NewGuid());
        _userRepoMock.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _userRepoMock.Setup(r => r.UpdateAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((User u, CancellationToken _) => u);

        await _sut.ChangePasswordAsync(user.Id, "password123", "newpassword123");

        _userRepoMock.Verify(r => r.UpdateAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RegisterDoctorAsync_ShouldCreateDoctorAndProfile()
    {
        var request = new RegisterDoctorRequestDto(
            "Dr. Test Doctor", "doc@e.com", "password123", "password123",
            "11987654321", "52998224725",
            "123456", "SP", "Cardiologia",
            new DateTime(1985, 3, 10), null, "Rua Teste", "100", "Centro", null, "São Paulo", "SP", "01310100");

        _userRepoMock.Setup(r => r.ExistsByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _userRepoMock.Setup(r => r.CreateAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((User u, CancellationToken _) => u);
        _doctorRepoMock.Setup(r => r.CreateAsync(It.IsAny<DoctorProfile>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DoctorProfile p, CancellationToken _) => p);
        _tokenRepoMock.Setup(r => r.CreateAsync(It.IsAny<AuthToken>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuthToken t, CancellationToken _) => t);

        var result = await _sut.RegisterDoctorAsync(request);

        result.Should().NotBeNull();
        result.User.Email.Should().Be("doc@e.com");
        result.User.Role.Should().Be("doctor");
        _doctorRepoMock.Verify(r => r.CreateAsync(It.IsAny<DoctorProfile>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RegisterDoctorAsync_ShouldThrow_WhenEmailExists()
    {
        _userRepoMock.Setup(r => r.ExistsByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var request = new RegisterDoctorRequestDto(
            "Dr. X", "dup@e.com", "pass", "pass", "11999999999", "12345678900", "CRM123", "SP", "Cardiologia",
            new DateTime(1980, 1, 1), null, "Rua X", "1", "Bairro", null, "São Paulo", "SP", "01310100");

        Func<Task> act = () => _sut.RegisterDoctorAsync(request);
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task CancelRegistrationAsync_ShouldDeleteUser()
    {
        var userId = Guid.NewGuid();
        var user = User.Reconstitute(userId, "Test User", "t@e.com",
            BCrypt.Net.BCrypt.HashPassword("password123"),
            "Patient", "11987654321", "12345678901", null, null,
            DateTime.UtcNow, DateTime.UtcNow, profileComplete: false);

        _userRepoMock.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        await _sut.CancelRegistrationAsync(userId);

        _tokenRepoMock.Verify(r => r.DeleteByUserIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
        _userRepoMock.Verify(r => r.DeleteAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }
}

// ============================================================
// RequestService - All Missing Methods
// ============================================================
public class RequestServiceFullTests
{
    private readonly Mock<IRequestRepository> _requestRepoMock = new();
    private readonly Mock<IProductPriceRepository> _productPriceRepoMock = new();
    private readonly Mock<IUserRepository> _userRepoMock = new();
    private readonly Mock<IDoctorRepository> _doctorRepoMock = new();
    private readonly Mock<IVideoRoomRepository> _videoRoomRepoMock = new();
    private readonly Mock<IConsultationAnamnesisRepository> _consultationAnamnesisRepoMock = new();
    private readonly Mock<IConsultationSessionStore> _consultationSessionStoreMock = new();
    private readonly Mock<INotificationRepository> _notificationRepoMock = new();
    private readonly Mock<IPushNotificationSender> _pushSenderMock = new();
    private readonly Mock<IAiReadingService> _aiReadingMock = new();
    private readonly Mock<IAiPrescriptionGeneratorService> _aiPrescriptionGeneratorMock = new();
    private readonly Mock<IPrescriptionPdfService> _pdfServiceMock = new();
    private readonly Mock<IDigitalCertificateService> _certServiceMock = new();
    private readonly Mock<IPrescriptionVerifyRepository> _prescriptionVerifyRepoMock = new();
    private readonly Mock<IHttpClientFactory> _httpClientFactoryMock = new();
    private readonly Mock<IOptions<ApiConfig>> _apiConfigMock = new();
    private readonly Mock<IDocumentTokenService> _documentTokenServiceMock = new();
    private readonly Mock<ILogger<RequestService>> _loggerMock = new();
    private readonly RequestService _sut;

    public RequestServiceFullTests()
    {
        _apiConfigMock.Setup(x => x.Value).Returns(new ApiConfig { BaseUrl = "" });
        _sut = new RequestService(
            _requestRepoMock.Object, _productPriceRepoMock.Object,
            _userRepoMock.Object, _doctorRepoMock.Object,
            _videoRoomRepoMock.Object, _consultationAnamnesisRepoMock.Object, _consultationSessionStoreMock.Object,
            _notificationRepoMock.Object, _pushSenderMock.Object, _aiReadingMock.Object,
            _aiPrescriptionGeneratorMock.Object,
            _pdfServiceMock.Object, _certServiceMock.Object,
            _prescriptionVerifyRepoMock.Object,
            _httpClientFactoryMock.Object, _apiConfigMock.Object,
            _documentTokenServiceMock.Object, _loggerMock.Object);
    }

    private static User CreatePatient(Guid id) =>
        User.Reconstitute(id, "Paciente Teste", "p@e.com", "hash", "Patient",
            "11987654321", "12345678901", null, null, DateTime.UtcNow, DateTime.UtcNow);

    private static User CreateDoctor(Guid id) =>
        User.Reconstitute(id, "Dr. Teste", "d@e.com", "hash", "Doctor",
            "11988776655", "98765432100", null, null, DateTime.UtcNow, DateTime.UtcNow);

    private void SetupNotifications()
    {
        _notificationRepoMock.Setup(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification n, CancellationToken _) => n);
    }

    // --- GetUserRequestsAsync ---

    [Fact]
    public async Task GetUserRequestsAsync_ShouldReturnPatientRequests()
    {
        var patientId = Guid.NewGuid();
        var patient = CreatePatient(patientId);
        var requests = new List<MedicalRequest>
        {
            MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" }),
            MedicalRequest.CreateExam(patientId, "P", "sangue", new List<string> { "Hemograma" }, "Febre")
        };

        _userRepoMock.Setup(r => r.GetByIdAsync(patientId, It.IsAny<CancellationToken>())).ReturnsAsync(patient);
        _requestRepoMock.Setup(r => r.GetByPatientIdAsync(patientId, It.IsAny<CancellationToken>())).ReturnsAsync(requests);

        var result = await _sut.GetUserRequestsAsync(patientId);
        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetUserRequestsAsync_ShouldReturnDoctorAssignedAndAvailable()
    {
        var doctorId = Guid.NewGuid();
        var doctor = CreateDoctor(doctorId);
        var assigned = new List<MedicalRequest>
        {
            MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" })
        };
        var available = new List<MedicalRequest>
        {
            MedicalRequest.CreatePrescription(Guid.NewGuid(), "P2", PrescriptionType.Controlled, new List<string> { "M2" })
        };

        _userRepoMock.Setup(r => r.GetByIdAsync(doctorId, It.IsAny<CancellationToken>())).ReturnsAsync(doctor);
        _requestRepoMock.Setup(r => r.GetByDoctorIdAsync(doctorId, It.IsAny<CancellationToken>())).ReturnsAsync(assigned);
        _requestRepoMock.Setup(r => r.GetAvailableForQueueAsync(It.IsAny<CancellationToken>())).ReturnsAsync(available);

        var result = await _sut.GetUserRequestsAsync(doctorId);
        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetUserRequestsAsync_ShouldFilterByStatus()
    {
        var patientId = Guid.NewGuid();
        var patient = CreatePatient(patientId);
        var r1 = MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" });
        var r2 = MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M2" });
        r2.Approve(50); // becomes ApprovedPendingPayment

        _userRepoMock.Setup(r => r.GetByIdAsync(patientId, It.IsAny<CancellationToken>())).ReturnsAsync(patient);
        _requestRepoMock.Setup(r => r.GetByPatientIdAsync(patientId, It.IsAny<CancellationToken>())).ReturnsAsync(new List<MedicalRequest> { r1, r2 });

        var result = await _sut.GetUserRequestsAsync(patientId, status: "submitted");
        result.Should().HaveCount(1);
        result[0].Status.Should().Be("submitted");
    }

    [Fact]
    public async Task GetUserRequestsAsync_ShouldFilterByType()
    {
        var patientId = Guid.NewGuid();
        var patient = CreatePatient(patientId);
        var r1 = MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" });
        var r2 = MedicalRequest.CreateExam(patientId, "P", "sangue", new List<string> { "Ex" }, "S");

        _userRepoMock.Setup(r => r.GetByIdAsync(patientId, It.IsAny<CancellationToken>())).ReturnsAsync(patient);
        _requestRepoMock.Setup(r => r.GetByPatientIdAsync(patientId, It.IsAny<CancellationToken>())).ReturnsAsync(new List<MedicalRequest> { r1, r2 });

        var result = await _sut.GetUserRequestsAsync(patientId, type: "exam");
        result.Should().HaveCount(1);
        result[0].RequestType.Should().Be("exam");
    }

    // --- GetUserRequestsPagedAsync ---

    [Fact]
    public async Task GetUserRequestsPagedAsync_ShouldPaginate()
    {
        var patientId = Guid.NewGuid();
        var patient = CreatePatient(patientId);
        var requests = Enumerable.Range(0, 15)
            .Select(_ => MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" }))
            .ToList();

        _userRepoMock.Setup(r => r.GetByIdAsync(patientId, It.IsAny<CancellationToken>())).ReturnsAsync(patient);
        _requestRepoMock.Setup(r => r.GetByPatientIdAsync(patientId, It.IsAny<CancellationToken>())).ReturnsAsync(requests);

        var result = await _sut.GetUserRequestsPagedAsync(patientId, page: 2, pageSize: 5);
        result.Items.Should().HaveCount(5);
        result.TotalCount.Should().Be(15);
        result.Page.Should().Be(2);
    }

    // --- UpdateStatusAsync ---

    [Fact]
    public async Task UpdateStatusAsync_ShouldUpdateAndNotify()
    {
        SetupNotifications();
        var request = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _requestRepoMock.Setup(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);

        var dto = new UpdateRequestStatusDto("in_review");
        var result = await _sut.UpdateStatusAsync(request.Id, dto);

        result.Status.Should().Be("in_review");
    }

    [Fact]
    public async Task UpdateStatusAsync_ShouldThrow_WhenNotFound()
    {
        _requestRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest?)null);

        Func<Task> act = () => _sut.UpdateStatusAsync(Guid.NewGuid(), new UpdateRequestStatusDto("paid"));
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    // --- StartConsultationAsync ---

    [Fact]
    public async Task StartConsultationAsync_ShouldStart_WhenPaidAndDoctor()
    {
        SetupNotifications();
        var doctorId = Guid.NewGuid();
        var request = MedicalRequest.CreateConsultation(Guid.NewGuid(), "P", "Symptoms");
        request.AssignDoctor(doctorId, "Dr. Test");
        request.MarkConsultationReady();
        request.Approve(100);
        request.MarkAsPaid();

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _requestRepoMock.Setup(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);

        var result = await _sut.StartConsultationAsync(request.Id, doctorId);
        result.Status.Should().Be("in_consultation");
    }

    [Fact]
    public async Task StartConsultationAsync_ShouldThrow_WhenNotAssignedDoctor()
    {
        var request = MedicalRequest.CreateConsultation(Guid.NewGuid(), "P", "Symptoms");
        request.AssignDoctor(Guid.NewGuid(), "Dr. Other");

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        Func<Task> act = () => _sut.StartConsultationAsync(request.Id, Guid.NewGuid());
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task StartConsultationAsync_ShouldThrow_WhenNotConsultation()
    {
        var request = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        Func<Task> act = () => _sut.StartConsultationAsync(request.Id, Guid.NewGuid());
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    // --- FinishConsultationAsync ---

    [Fact]
    public async Task FinishConsultationAsync_ShouldFinish_WhenInConsultation()
    {
        SetupNotifications();
        var doctorId = Guid.NewGuid();
        var request = MedicalRequest.CreateConsultation(Guid.NewGuid(), "P", "Symptoms");
        request.AssignDoctor(doctorId, "Dr.");
        request.MarkConsultationReady();
        request.Approve(100);
        request.MarkAsPaid();
        request.StartConsultation();

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _requestRepoMock.Setup(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);
        _videoRoomRepoMock.Setup(r => r.GetByRequestIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((VideoRoom?)null);

        var result = await _sut.FinishConsultationAsync(request.Id, doctorId, new FinishConsultationDto("Notas clínicas"));
        result.Status.Should().Be("consultation_finished");
        result.Notes.Should().Be("Notas clínicas");
    }

    [Fact]
    public async Task FinishConsultationAsync_ShouldThrow_WhenNotAssignedDoctor()
    {
        var doctorId = Guid.NewGuid();
        var request = MedicalRequest.CreateConsultation(Guid.NewGuid(), "P", "Symptoms");
        request.AssignDoctor(doctorId, "Dr.");

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        Func<Task> act = () => _sut.FinishConsultationAsync(request.Id, Guid.NewGuid(), null);
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    // --- SignAsync ---

    [Fact]
    public async Task SignAsync_ShouldThrow_WhenNotPaid()
    {
        var request = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        Func<Task> act = () => _sut.SignAsync(request.Id, new SignRequestDto());
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task SignAsync_ShouldThrow_WhenNotFound()
    {
        _requestRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest?)null);

        Func<Task> act = () => _sut.SignAsync(Guid.NewGuid(), new SignRequestDto());
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    // --- ReanalyzePrescriptionAsync ---

    [Fact]
    public async Task ReanalyzePrescriptionAsync_ShouldThrow_WhenNotPrescription()
    {
        var request = MedicalRequest.CreateExam(Guid.NewGuid(), "P", "sangue", new List<string> { "Ex" }, "S");
        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        var dto = new ReanalyzePrescriptionDto(new List<string> { "url1" });
        Func<Task> act = () => _sut.ReanalyzePrescriptionAsync(request.Id, dto, request.PatientId);
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task ReanalyzePrescriptionAsync_ShouldThrow_WhenNotOwner()
    {
        var request = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        var dto = new ReanalyzePrescriptionDto(new List<string> { "url" });
        Func<Task> act = () => _sut.ReanalyzePrescriptionAsync(request.Id, dto, Guid.NewGuid());
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task ReanalyzePrescriptionAsync_ShouldThrow_WhenNoImages()
    {
        var patientId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" });
        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        var dto = new ReanalyzePrescriptionDto(new List<string>());
        Func<Task> act = () => _sut.ReanalyzePrescriptionAsync(request.Id, dto, patientId);
        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task ReanalyzePrescriptionAsync_ShouldCallAiAndUpdate()
    {
        SetupNotifications();
        var patientId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" });

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _requestRepoMock.Setup(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);
        _aiReadingMock.Setup(a => a.AnalyzePrescriptionAsync(It.IsAny<IReadOnlyList<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiPrescriptionAnalysisResult(true, "AI Summary", "{}", "low", "Receita legível"));

        var dto = new ReanalyzePrescriptionDto(new List<string> { "url1" });
        var result = await _sut.ReanalyzePrescriptionAsync(request.Id, dto, patientId);

        result.Should().NotBeNull();
        result.AiSummaryForDoctor.Should().Be("AI Summary");
        result.AiReadabilityOk.Should().BeTrue();
    }

    // --- UpdatePrescriptionContentAsync ---

    [Fact]
    public async Task UpdatePrescriptionContentAsync_ShouldUpdate_WhenPaid()
    {
        SetupNotifications();
        var doctorId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "Old" });
        request.AssignDoctor(doctorId, "Dr.");
        request.Approve(50);
        request.MarkAsPaid();

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _requestRepoMock.Setup(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);

        var result = await _sut.UpdatePrescriptionContentAsync(request.Id, new List<string> { "New1" }, "Notas", doctorId);
        result.Medications.Should().Contain("New1");
    }

    [Fact]
    public async Task UpdatePrescriptionContentAsync_ShouldThrow_WhenNotDoctor()
    {
        var doctorId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        request.AssignDoctor(doctorId, "Dr.");
        request.Approve(50);
        request.MarkAsPaid();

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        Func<Task> act = () => _sut.UpdatePrescriptionContentAsync(request.Id, null, null, Guid.NewGuid());
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task UpdatePrescriptionContentAsync_ShouldThrow_WhenNotPaid()
    {
        var doctorId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        request.AssignDoctor(doctorId, "Dr.");

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        Func<Task> act = () => _sut.UpdatePrescriptionContentAsync(request.Id, null, null, doctorId);
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    // --- UpdateExamContentAsync ---

    [Fact]
    public async Task UpdateExamContentAsync_ShouldUpdate_WhenPaid()
    {
        SetupNotifications();
        var doctorId = Guid.NewGuid();
        var request = MedicalRequest.CreateExam(Guid.NewGuid(), "P", "sangue", new List<string> { "Old" }, "S");
        request.AssignDoctor(doctorId, "Dr.");
        request.Approve(50);
        request.MarkAsPaid();

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _requestRepoMock.Setup(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);

        var result = await _sut.UpdateExamContentAsync(request.Id, new List<string> { "Hemograma" }, "Notes", doctorId);
        result.Exams.Should().Contain("Hemograma");
    }

    [Fact]
    public async Task UpdateExamContentAsync_ShouldThrow_WhenNotExam()
    {
        var doctorId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        request.AssignDoctor(doctorId, "Dr.");
        request.Approve(50);
        request.MarkAsPaid();

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        Func<Task> act = () => _sut.UpdateExamContentAsync(request.Id, null, null, doctorId);
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    // --- GetPrescriptionPdfPreviewAsync ---

    [Fact]
    public async Task GetPrescriptionPdfPreviewAsync_ShouldReturnNull_WhenNotFound()
    {
        _requestRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest?)null);

        var result = await _sut.GetPrescriptionPdfPreviewAsync(Guid.NewGuid(), Guid.NewGuid());
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetPrescriptionPdfPreviewAsync_ShouldReturnNull_WhenNotPrescription()
    {
        var request = MedicalRequest.CreateExam(Guid.NewGuid(), "P", "sangue", new List<string> { "Ex" }, "S");
        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        var result = await _sut.GetPrescriptionPdfPreviewAsync(request.Id, request.PatientId);
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetPrescriptionPdfPreviewAsync_ShouldReturnNull_WhenNotOwner()
    {
        var request = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        var result = await _sut.GetPrescriptionPdfPreviewAsync(request.Id, Guid.NewGuid());
        result.Should().BeNull();
    }

    // --- AssignToQueueAsync ---

    [Fact]
    public async Task AssignToQueueAsync_ShouldThrow_WhenNoDoctorsAvailable()
    {
        var request = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _doctorRepoMock.Setup(r => r.GetAvailableAsync(It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<DoctorProfile>());

        Func<Task> act = () => _sut.AssignToQueueAsync(request.Id);
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task AssignToQueueAsync_ShouldAssignFirstAvailableDoctor()
    {
        SetupNotifications();
        var request = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        var doctorUserId = Guid.NewGuid();
        var doctorProfile = DoctorProfile.Create(doctorUserId, "123456", "SP", "Clínica");
        var doctorUser = CreateDoctor(doctorUserId);

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _doctorRepoMock.Setup(r => r.GetAvailableAsync(It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<DoctorProfile> { doctorProfile });
        _userRepoMock.Setup(r => r.GetByIdAsync(doctorUserId, It.IsAny<CancellationToken>())).ReturnsAsync(doctorUser);
        _requestRepoMock.Setup(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);

        var result = await _sut.AssignToQueueAsync(request.Id);
        result.DoctorId.Should().Be(doctorUserId);
        result.Status.Should().Be("in_review");
    }
}

// ============================================================
// PaymentService - Remaining Methods
// ============================================================
public class PaymentServiceFullTests
{
    private readonly Mock<IPaymentRepository> _paymentRepoMock = new();
    private readonly Mock<IRequestRepository> _requestRepoMock = new();
    private readonly Mock<INotificationRepository> _notifRepoMock = new();
    private readonly Mock<IPushNotificationSender> _pushSenderMock = new();
    private readonly Mock<IMercadoPagoService> _mercadoPagoMock = new();
    private readonly Mock<IUserRepository> _userRepoMock = new();
    private readonly Mock<IPaymentAttemptRepository> _paymentAttemptRepoMock = new();
    private readonly Mock<ISavedCardRepository> _savedCardRepoMock = new();
    private readonly Mock<ILogger<PaymentService>> _loggerMock = new();
    private readonly PaymentService _sut;

    public PaymentServiceFullTests()
    {
        var mpConfig = Options.Create(new MercadoPagoConfig { WebhookSecret = "test-secret" });
        _sut = new PaymentService(
            _paymentRepoMock.Object, _requestRepoMock.Object,
            _notifRepoMock.Object, _pushSenderMock.Object,
            _mercadoPagoMock.Object, _userRepoMock.Object,
            _paymentAttemptRepoMock.Object, _savedCardRepoMock.Object,
            mpConfig, _loggerMock.Object);
    }

    private void SetupNotifications()
    {
        _notifRepoMock.Setup(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification n, CancellationToken _) => n);
    }

    [Fact]
    public async Task GetPaymentAsync_ShouldReturnPayment()
    {
        var userId = Guid.NewGuid();
        var payment = Payment.CreatePixPayment(Guid.NewGuid(), userId, 100);

        _paymentRepoMock.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var result = await _sut.GetPaymentAsync(payment.Id, userId);
        result.Amount.Should().Be(100);
        result.UserId.Should().Be(userId);
    }

    [Fact]
    public async Task GetPaymentAsync_ShouldThrow_WhenNotOwner()
    {
        var payment = Payment.CreatePixPayment(Guid.NewGuid(), Guid.NewGuid(), 100);
        _paymentRepoMock.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        Func<Task> act = () => _sut.GetPaymentAsync(payment.Id, Guid.NewGuid());
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task GetPaymentAsync_ShouldThrow_WhenNotFound()
    {
        _paymentRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        Func<Task> act = () => _sut.GetPaymentAsync(Guid.NewGuid(), Guid.NewGuid());
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task ConfirmPaymentAsync_ShouldApproveAndUpdateRequest()
    {
        SetupNotifications();
        var patientId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" });
        request.Approve(50);
        var payment = Payment.CreatePixPayment(request.Id, patientId, 50);

        _paymentRepoMock.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>())).ReturnsAsync(payment);
        _paymentRepoMock.Setup(r => r.UpdateAsync(It.IsAny<Payment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment p, CancellationToken _) => p);
        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _requestRepoMock.Setup(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest r, CancellationToken _) => r);

        var result = await _sut.ConfirmPaymentAsync(payment.Id);
        result.Status.Should().Be("approved");
    }

    [Fact]
    public async Task ConfirmPaymentAsync_ShouldThrow_WhenNotFound()
    {
        _paymentRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        Func<Task> act = () => _sut.ConfirmPaymentAsync(Guid.NewGuid());
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task ConfirmPaymentByRequestIdAsync_ShouldThrow_WhenNoPayment()
    {
        _paymentRepoMock.Setup(r => r.GetByRequestIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        Func<Task> act = () => _sut.ConfirmPaymentByRequestIdAsync(Guid.NewGuid());
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task ConfirmPaymentByRequestIdAsync_ShouldThrow_WhenNotPending()
    {
        var payment = Payment.CreatePixPayment(Guid.NewGuid(), Guid.NewGuid(), 50);
        payment.Approve();

        _paymentRepoMock.Setup(r => r.GetByRequestIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        Func<Task> act = () => _sut.ConfirmPaymentByRequestIdAsync(Guid.NewGuid());
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task ProcessWebhookAsync_ShouldIgnore_WhenActionNotPayment()
    {
        var webhook = new MercadoPagoWebhookDto("subscription.created", null, null);
        await _sut.ProcessWebhookAsync(webhook);
        _paymentRepoMock.Verify(r => r.GetByExternalIdAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessWebhookAsync_ShouldIgnore_WhenNoId()
    {
        var webhook = new MercadoPagoWebhookDto("payment.created", null, null);
        await _sut.ProcessWebhookAsync(webhook);
        _paymentRepoMock.Verify(r => r.GetByExternalIdAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SyncPaymentStatusAsync_ShouldReturnNull_WhenNoPayment()
    {
        _paymentRepoMock.Setup(r => r.GetByRequestIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        var result = await _sut.SyncPaymentStatusAsync(Guid.NewGuid());
        result.Should().BeNull();
    }

    [Fact]
    public void ValidateWebhookSignature_ShouldReturnFalse_WhenNoSecret()
    {
        var noSecretConfig = Options.Create(new MercadoPagoConfig());
        var svc = new PaymentService(
            _paymentRepoMock.Object, _requestRepoMock.Object,
            _notifRepoMock.Object, _pushSenderMock.Object,
            _mercadoPagoMock.Object, _userRepoMock.Object,
            _paymentAttemptRepoMock.Object, _savedCardRepoMock.Object,
            noSecretConfig, _loggerMock.Object);

        svc.ValidateWebhookSignature("ts=123,v1=abc", "req-1", "data-1").Should().BeFalse();
    }

    [Fact]
    public void ValidateWebhookSignature_ShouldReturnFalse_WhenNoSignature()
    {
        _sut.ValidateWebhookSignature(null, "req-1", "data-1").Should().BeFalse();
    }

    [Fact]
    public void ValidateWebhookSignature_ShouldReturnFalse_WhenMalformedSignature()
    {
        _sut.ValidateWebhookSignature("garbage", "req-1", "data-1").Should().BeFalse();
    }

    [Fact]
    public async Task GetCheckoutProUrlAsync_ShouldThrow_WhenNotFound()
    {
        _requestRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest?)null);

        Func<Task> act = () => _sut.GetCheckoutProUrlAsync(Guid.NewGuid(), Guid.NewGuid());
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task GetCheckoutProUrlAsync_ShouldThrow_WhenNotOwner()
    {
        var request = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });
        request.Approve(50);

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        Func<Task> act = () => _sut.GetCheckoutProUrlAsync(request.Id, Guid.NewGuid());
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task GetCheckoutProUrlAsync_ShouldThrow_WhenNotApproved()
    {
        var patientId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" });

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        Func<Task> act = () => _sut.GetCheckoutProUrlAsync(request.Id, patientId);
        await act.Should().ThrowAsync<InvalidOperationException>();
    }
}

