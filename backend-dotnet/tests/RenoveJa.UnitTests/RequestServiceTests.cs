using Microsoft.Extensions.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using RenoveJa.Application.Configuration;
using Xunit;
using FluentAssertions;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Requests;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.UnitTests.Services;

public class RequestServiceTests
{
    private readonly Mock<IRequestRepository> _requestRepoMock;
    private readonly Mock<IUserRepository> _userRepoMock;
    private readonly Mock<IDoctorRepository> _doctorRepoMock;
    private readonly Mock<IVideoRoomRepository> _videoRoomRepoMock;
    private readonly Mock<IConsultationAnamnesisRepository> _consultationAnamnesisRepoMock;
    private readonly Mock<IConsultationSessionStore> _consultationSessionStoreMock;
    private readonly Mock<INotificationRepository> _notificationRepoMock;
    private readonly Mock<IPushNotificationSender> _pushSenderMock;
    private readonly Mock<IPushNotificationDispatcher> _pushDispatcherMock;
    private readonly Mock<IAiReadingService> _aiReadingMock;
    private readonly Mock<IPrescriptionPdfService> _pdfServiceMock;
    private readonly Mock<IDigitalCertificateService> _certServiceMock;
    private readonly Mock<IConsultationTimeBankRepository> _consultationTimeBankRepoMock;
    private readonly Mock<IAiConductSuggestionService> _aiConductSuggestionServiceMock;
    private readonly Mock<ILogger<RequestService>> _loggerMock;
    private readonly RequestService _sut;

    public RequestServiceTests()
    {
        _requestRepoMock = new Mock<IRequestRepository>();
        _userRepoMock = new Mock<IUserRepository>();
        _doctorRepoMock = new Mock<IDoctorRepository>();
        _videoRoomRepoMock = new Mock<IVideoRoomRepository>();
        _consultationAnamnesisRepoMock = new Mock<IConsultationAnamnesisRepository>();
        _consultationSessionStoreMock = new Mock<IConsultationSessionStore>();
        _notificationRepoMock = new Mock<INotificationRepository>();
        _pushSenderMock = new Mock<IPushNotificationSender>();
        _pushDispatcherMock = new Mock<IPushNotificationDispatcher>();
        _pushDispatcherMock.Setup(x => x.SendAsync(It.IsAny<RenoveJa.Application.DTOs.Notifications.PushNotificationRequest>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _aiReadingMock = new Mock<IAiReadingService>();
        _pdfServiceMock = new Mock<IPrescriptionPdfService>();
        _certServiceMock = new Mock<IDigitalCertificateService>();
        _consultationTimeBankRepoMock = new Mock<IConsultationTimeBankRepository>();
        _aiConductSuggestionServiceMock = new Mock<IAiConductSuggestionService>();
        _loggerMock = new Mock<ILogger<RequestService>>();
        var aiPrescriptionGeneratorMock = new Mock<IAiPrescriptionGeneratorService>();
        var prescriptionVerifyRepoMock = new Mock<IPrescriptionVerifyRepository>();
        var httpClientFactoryMock = new Mock<IHttpClientFactory>();
        var apiConfigMock = new Mock<IOptions<ApiConfig>>();
        apiConfigMock.Setup(x => x.Value).Returns(new ApiConfig { BaseUrl = "" });
        var documentTokenServiceMock = new Mock<IDocumentTokenService>();
        var storageServiceMock = new Mock<IStorageService>();
        var requestEventsPublisherMock = new Mock<IRequestEventsPublisher>();
        var newRequestBatchServiceMock = new Mock<INewRequestBatchService>();
        var signedRequestClinicalSyncMock = new Mock<ISignedRequestClinicalSyncService>();
        var consultationEncounterServiceMock = new Mock<IConsultationEncounterService>();
        var auditServiceMock = new Mock<IAuditService>();
        var requestApprovalLoggerMock = new Mock<Microsoft.Extensions.Logging.ILogger<RequestApprovalService>>();
        var requestApprovalService = new RequestApprovalService(
            _requestRepoMock.Object,
            _userRepoMock.Object,
            _pushDispatcherMock.Object,
            requestEventsPublisherMock.Object,
            _aiConductSuggestionServiceMock.Object,
            requestApprovalLoggerMock.Object);

        _sut = new RequestService(
            _requestRepoMock.Object,
            _userRepoMock.Object,
            _doctorRepoMock.Object,
            _notificationRepoMock.Object,
            _pushSenderMock.Object,
            _pushDispatcherMock.Object,
            _aiReadingMock.Object,
            apiConfigMock.Object,
            documentTokenServiceMock.Object,
            _consultationTimeBankRepoMock.Object,
            _aiConductSuggestionServiceMock.Object,
            requestEventsPublisherMock.Object,
            newRequestBatchServiceMock.Object,
            auditServiceMock.Object,
            requestApprovalService,
            new RequestQueryService(
                _requestRepoMock.Object,
                _userRepoMock.Object,
                _consultationAnamnesisRepoMock.Object,
                documentTokenServiceMock.Object,
                apiConfigMock.Object,
                new Mock<ILogger<RequestQueryService>>().Object),
            new Mock<IConsultationLifecycleService>().Object,
            new Mock<ISignatureService>().Object,
            _loggerMock.Object);
    }

    private static User CreatePatientUser(Guid? id = null)
    {
        var userId = id ?? Guid.NewGuid();
        return User.Reconstitute(
            userId,
            "Paciente Teste",
            "patient@example.com",
            "hashedpwd",
            "Patient",
            "11999887766",
            "12345678901",
            new DateTime(1990, 3, 15),
            null,
            DateTime.UtcNow,
            DateTime.UtcNow);
    }

    private static User CreateDoctorUser(Guid? id = null)
    {
        var userId = id ?? Guid.NewGuid();
        return User.Reconstitute(
            userId,
            "Dr. Médico Teste",
            "doctor@example.com",
            "hashedpwd",
            "Doctor",
            "11988776655",
            "98765432100",
            new DateTime(1980, 1, 1),
            null,
            DateTime.UtcNow,
            DateTime.UtcNow);
    }

    [Fact]
    public async Task CreatePrescriptionAsync_ShouldCreateRequest_WhenValid()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var user = CreatePatientUser(userId);
        var dto = new CreatePrescriptionRequestDto("simples", new List<string> { "Paracetamol 500mg" });

        _userRepoMock
            .Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _requestRepoMock
            .Setup(r => r.CreateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);

        _notificationRepoMock
            .Setup(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification n, CancellationToken _) => n);

        // Act
        var result = await _sut.CreatePrescriptionAsync(dto, userId);

        // Assert
        result.Should().NotBeNull();
        result.PatientId.Should().Be(userId);
        result.RequestType.Should().Be("prescription");
        result.Status.Should().Be("submitted");
        result.PrescriptionType.Should().Be("simples");

        _requestRepoMock.Verify(r => r.CreateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()), Times.Once);
        // SendAsync comentado no RequestService.CreatePrescriptionAsync (push "Pedido enviado" desnecessário)
    }

    [Fact]
    public async Task CreatePrescriptionAsync_ShouldThrow_WhenUserNotFound()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var dto = new CreatePrescriptionRequestDto("simples");

        _userRepoMock
            .Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        // Act
        Func<Task> act = () => _sut.CreatePrescriptionAsync(dto, userId);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("User not found");
    }

    [Fact]
    public async Task ApproveAsync_ShouldApproveRequest_WhenValid()
    {
        // Arrange
        var patientId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();

        var medicalRequest = MedicalRequest.CreatePrescription(
            patientId,
            "Paciente Teste",
            PrescriptionType.Simple,
            new List<string> { "Med1" });

        var doctorUser = CreateDoctorUser(doctorId);

        _requestRepoMock
            .Setup(r => r.GetByIdAsync(medicalRequest.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(medicalRequest);

        _userRepoMock
            .Setup(r => r.GetByIdAsync(doctorId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(doctorUser);

        _requestRepoMock
            .Setup(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);

        _notificationRepoMock
            .Setup(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification n, CancellationToken _) => n);

        // Act
        var result = await _sut.ApproveAsync(medicalRequest.Id, new ApproveRequestDto(), doctorId);

        // Assert
        result.Should().NotBeNull();
        result.Status.Should().Be("paid");
        result.DoctorId.Should().Be(doctorId);
        result.DoctorName.Should().Be("Dr. Médico Teste");

        _requestRepoMock.Verify(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ApproveAsync_ShouldThrow_WhenRequestNotFound()
    {
        // Arrange
        var id = Guid.NewGuid();
        var doctorId = Guid.NewGuid();

        _requestRepoMock
            .Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest?)null);

        // Act
        Func<Task> act = () => _sut.ApproveAsync(id, new ApproveRequestDto(), doctorId);

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("Request not found");
    }

    [Fact]
    public async Task ApproveAsync_ShouldThrow_WhenDoctorNotFound()
    {
        // Arrange
        var patientId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();

        var medicalRequest = MedicalRequest.CreatePrescription(
            patientId,
            "Paciente",
            PrescriptionType.Simple,
            new List<string> { "Med1" });

        _requestRepoMock
            .Setup(r => r.GetByIdAsync(medicalRequest.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(medicalRequest);

        _userRepoMock
            .Setup(r => r.GetByIdAsync(doctorId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        // Act
        Func<Task> act = () => _sut.ApproveAsync(medicalRequest.Id, new ApproveRequestDto(), doctorId);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Doctor not found");
    }

    [Fact]
    public async Task RejectAsync_ShouldRejectRequest_WhenValid()
    {
        // Arrange
        var patientId = Guid.NewGuid();

        var medicalRequest = MedicalRequest.CreatePrescription(
            patientId,
            "Paciente Teste",
            PrescriptionType.Simple,
            new List<string> { "Med1" });

        _requestRepoMock
            .Setup(r => r.GetByIdAsync(medicalRequest.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(medicalRequest);

        _requestRepoMock
            .Setup(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);

        _notificationRepoMock
            .Setup(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification n, CancellationToken _) => n);

        var rejectDto = new RejectRequestDto("Receita ilegível");

        // Act
        var doctorId = Guid.NewGuid();
        var result = await _sut.RejectAsync(medicalRequest.Id, rejectDto, doctorId);

        // Assert
        result.Should().NotBeNull();
        result.Status.Should().Be("rejected");
        result.RejectionReason.Should().Be("Receita ilegível");

        _requestRepoMock.Verify(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()), Times.Once);
        _pushDispatcherMock.Verify(x => x.SendAsync(It.IsAny<RenoveJa.Application.DTOs.Notifications.PushNotificationRequest>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RejectAsync_ShouldThrow_WhenRequestNotFound()
    {
        // Arrange
        var id = Guid.NewGuid();

        _requestRepoMock
            .Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest?)null);

        // Act
        Func<Task> act = () => _sut.RejectAsync(id, new RejectRequestDto("motivo"), Guid.NewGuid());

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("Request not found");
    }

    [Fact]
    public async Task GetRequestByIdAsync_ShouldReturnRequest_WhenFound()
    {
        // Arrange
        var patientId = Guid.NewGuid();
        var medicalRequest = MedicalRequest.CreatePrescription(
            patientId,
            "Paciente",
            PrescriptionType.Controlled,
            new List<string> { "Rivotril 2mg" });

        _requestRepoMock
            .Setup(r => r.GetByIdAsync(medicalRequest.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(medicalRequest);

        // Act
        var result = await _sut.GetRequestByIdAsync(medicalRequest.Id, patientId);

        // Assert
        result.Should().NotBeNull();
        result.Id.Should().Be(medicalRequest.Id);
        result.RequestType.Should().Be("prescription");
        result.PrescriptionType.Should().Be("controlado");
    }

    [Fact]
    public async Task GetRequestByIdAsync_ShouldThrow_WhenNotFound()
    {
        // Arrange
        var id = Guid.NewGuid();

        _requestRepoMock
            .Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest?)null);

        // Act
        Func<Task> act = () => _sut.GetRequestByIdAsync(id, Guid.NewGuid());

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("Request not found");
    }
}
