using Microsoft.Extensions.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using FluentAssertions;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.DTOs.Video;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Application.Services.Payments;
using RenoveJa.Application.Services.Video;
using RenoveJa.Application.Services.Audit;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.UnitTests.Services;

// ============================================================
// PaymentService Tests
// ============================================================
public class PaymentServiceTests
{
    private readonly Mock<IPaymentRepository> _paymentRepoMock = new();
    private readonly Mock<IRequestRepository> _requestRepoMock = new();
    private readonly Mock<INotificationRepository> _notificationRepoMock = new();
    private readonly Mock<IPushNotificationSender> _pushSenderMock = new();
    private readonly Mock<IMercadoPagoService> _mercadoPagoMock = new();
    private readonly Mock<IUserRepository> _userRepoMock = new();
    private readonly Mock<IPaymentAttemptRepository> _paymentAttemptRepoMock = new();
    private readonly Mock<ISavedCardRepository> _savedCardRepoMock = new();
    private readonly Mock<ILogger<PaymentService>> _loggerMock = new();
    private readonly PaymentService _sut;

    public PaymentServiceTests()
    {
        var mpConfig = Options.Create(new MercadoPagoConfig());
        _sut = new PaymentService(
            _paymentRepoMock.Object,
            _requestRepoMock.Object,
            _notificationRepoMock.Object,
            _pushSenderMock.Object,
            _mercadoPagoMock.Object,
            _userRepoMock.Object,
            _paymentAttemptRepoMock.Object,
            _savedCardRepoMock.Object,
            mpConfig,
            _loggerMock.Object);
    }

    private MedicalRequest CreateApprovedRequest(Guid patientId)
    {
        var r = MedicalRequest.CreatePrescription(patientId, "Patient", PrescriptionType.Simple, new List<string> { "Med" });
        r.Approve(50.00m);
        return r;
    }

    private static User CreatePatient(Guid id) =>
        User.Reconstitute(id, "Paciente Teste", "p@e.com", "hash", "Patient",
            "11987654321", "12345678901", null, null, DateTime.UtcNow, DateTime.UtcNow);

    [Fact]
    public async Task CreatePaymentAsync_ShouldThrow_WhenRequestNotFound()
    {
        var dto = new CreatePaymentRequestDto(Guid.NewGuid());
        _requestRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest?)null);

        Func<Task> act = () => _sut.CreatePaymentAsync(dto, Guid.NewGuid());
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task CreatePaymentAsync_ShouldThrow_WhenNotOwner()
    {
        var patientId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var request = CreateApprovedRequest(patientId);

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);

        var dto = new CreatePaymentRequestDto(request.Id);
        Func<Task> act = () => _sut.CreatePaymentAsync(dto, otherId);
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task CreatePaymentAsync_ShouldThrow_WhenNotApproved()
    {
        var patientId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" });

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);

        var dto = new CreatePaymentRequestDto(request.Id);
        Func<Task> act = () => _sut.CreatePaymentAsync(dto, patientId);
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task CreatePaymentAsync_ShouldCreatePixPayment_WhenValid()
    {
        var patientId = Guid.NewGuid();
        var request = CreateApprovedRequest(patientId);
        var patient = CreatePatient(patientId);

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);
        _paymentRepoMock.Setup(r => r.GetByRequestIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);
        _userRepoMock.Setup(r => r.GetByIdAsync(patientId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(patient);
        _mercadoPagoMock.Setup(m => m.CreatePixPaymentAsync(It.IsAny<decimal>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MercadoPagoPixResult("ext-123", "qrcode", "base64qr", "copypaste"));
        _paymentRepoMock.Setup(r => r.CreateAsync(It.IsAny<Payment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment p, CancellationToken _) => p);
        _notificationRepoMock.Setup(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification n, CancellationToken _) => n);

        var dto = new CreatePaymentRequestDto(request.Id);
        var result = await _sut.CreatePaymentAsync(dto, patientId);

        result.Should().NotBeNull();
        result.Amount.Should().Be(50.00m);
        result.Status.Should().Be("pending");
        result.PaymentMethod.Should().Be("pix");
        _mercadoPagoMock.Verify(m => m.CreatePixPaymentAsync(50.00m, It.IsAny<string>(),
            "p@e.com", It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreatePaymentAsync_ShouldThrow_WhenCardMissingToken()
    {
        var patientId = Guid.NewGuid();
        var request = CreateApprovedRequest(patientId);
        var patient = CreatePatient(patientId);

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);
        _userRepoMock.Setup(r => r.GetByIdAsync(patientId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(patient);

        var dto = new CreatePaymentRequestDto(request.Id, PaymentMethod: "credit_card");
        Func<Task> act = () => _sut.CreatePaymentAsync(dto, patientId);
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task GetPaymentByRequestIdAsync_ShouldThrow_WhenRequestNotFound()
    {
        _requestRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest?)null);

        Func<Task> act = () => _sut.GetPaymentByRequestIdAsync(Guid.NewGuid(), Guid.NewGuid());
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task GetPaymentByRequestIdAsync_ShouldThrow_WhenNotOwner()
    {
        var patientId = Guid.NewGuid();
        var request = CreateApprovedRequest(patientId);

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);

        Func<Task> act = () => _sut.GetPaymentByRequestIdAsync(request.Id, Guid.NewGuid());
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task GetPaymentByRequestIdAsync_ShouldReturnNull_WhenNoPayment()
    {
        var patientId = Guid.NewGuid();
        var request = CreateApprovedRequest(patientId);

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);
        _paymentRepoMock.Setup(r => r.GetByRequestIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        var result = await _sut.GetPaymentByRequestIdAsync(request.Id, patientId);
        result.Should().BeNull();
    }
}

// ============================================================
// NotificationService Tests
// ============================================================
public class NotificationServiceTests
{
    private readonly Mock<INotificationRepository> _notifRepoMock = new();
    private readonly NotificationService _sut;

    public NotificationServiceTests()
    {
        _sut = new NotificationService(_notifRepoMock.Object);
    }

    [Fact]
    public async Task GetUserNotificationsAsync_ShouldReturnMappedDtos()
    {
        var userId = Guid.NewGuid();
        var notifs = new List<Notification>
        {
            Notification.Create(userId, "Title1", "Message1"),
            Notification.Create(userId, "Title2", "Message2", NotificationType.Warning)
        };

        _notifRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(notifs);

        var result = await _sut.GetUserNotificationsAsync(userId);

        result.Should().HaveCount(2);
        result[0].Title.Should().Be("Title1");
        result[0].NotificationType.Should().Be("info");
        result[1].NotificationType.Should().Be("warning");
    }

    [Fact]
    public async Task GetUserNotificationsAsync_ShouldReturnEmpty_WhenNone()
    {
        _notifRepoMock.Setup(r => r.GetByUserIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Notification>());

        var result = await _sut.GetUserNotificationsAsync(Guid.NewGuid());
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetUserNotificationsPagedAsync_ShouldPaginate()
    {
        var userId = Guid.NewGuid();
        var notifs = Enumerable.Range(1, 10)
            .Select(i => Notification.Create(userId, $"Title{i}", $"Msg{i}"))
            .ToList();

        _notifRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(notifs);

        var result = await _sut.GetUserNotificationsPagedAsync(userId, page: 2, pageSize: 3);

        result.Items.Should().HaveCount(3);
        result.TotalCount.Should().Be(10);
        result.Page.Should().Be(2);
        result.PageSize.Should().Be(3);
    }

    [Fact]
    public async Task MarkAsReadAsync_ShouldMarkAndReturn()
    {
        var notif = Notification.Create(Guid.NewGuid(), "T", "M");

        _notifRepoMock.Setup(r => r.GetByIdAsync(notif.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(notif);
        _notifRepoMock.Setup(r => r.UpdateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification n, CancellationToken _) => n);

        var result = await _sut.MarkAsReadAsync(notif.Id);

        result.Read.Should().BeTrue();
        result.Id.Should().Be(notif.Id);
    }

    [Fact]
    public async Task MarkAsReadAsync_ShouldThrow_WhenNotFound()
    {
        _notifRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification?)null);

        Func<Task> act = () => _sut.MarkAsReadAsync(Guid.NewGuid());
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task MarkAllAsReadAsync_ShouldCallRepository()
    {
        var userId = Guid.NewGuid();
        await _sut.MarkAllAsReadAsync(userId);
        _notifRepoMock.Verify(r => r.MarkAllAsReadAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }
}

// ============================================================
// VideoService Tests
// ============================================================
public class VideoServiceTests
{
    private readonly Mock<IVideoRoomRepository> _videoRepoMock = new();
    private readonly Mock<IRequestRepository> _requestRepoMock = new();
    private readonly VideoService _sut;

    public VideoServiceTests()
    {
        _sut = new VideoService(_videoRepoMock.Object, _requestRepoMock.Object);
    }

    [Fact]
    public async Task CreateRoomAsync_ShouldReturnExisting_WhenAlreadyExists()
    {
        var requestId = Guid.NewGuid();
        var existing = VideoRoom.Create(requestId, "consultation-old");
        existing.SetRoomUrl("https://meet.old.com");

        _videoRepoMock.Setup(r => r.GetByRequestIdAsync(requestId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        var dto = new CreateVideoRoomRequestDto(requestId);
        var result = await _sut.CreateRoomAsync(dto);

        result.RoomName.Should().Be("consultation-old");
        _videoRepoMock.Verify(r => r.CreateAsync(It.IsAny<VideoRoom>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateRoomAsync_ShouldCreateNew_WhenNotExists()
    {
        var patientId = Guid.NewGuid();
        var request = MedicalRequest.CreateConsultation(patientId, "P", "Symptoms");

        _videoRepoMock.Setup(r => r.GetByRequestIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((VideoRoom?)null);
        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);
        _videoRepoMock.Setup(r => r.CreateAsync(It.IsAny<VideoRoom>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((VideoRoom v, CancellationToken _) => v);

        var dto = new CreateVideoRoomRequestDto(request.Id);
        var result = await _sut.CreateRoomAsync(dto);

        result.Should().NotBeNull();
        result.RoomName.Should().StartWith("consultation-");
        result.Status.Should().Be("waiting");
    }

    [Fact]
    public async Task CreateRoomAsync_ShouldThrow_WhenRequestNotFound()
    {
        _videoRepoMock.Setup(r => r.GetByRequestIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((VideoRoom?)null);
        _requestRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest?)null);

        Func<Task> act = () => _sut.CreateRoomAsync(new CreateVideoRoomRequestDto(Guid.NewGuid()));
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task GetRoomAsync_ShouldReturnRoom()
    {
        var room = VideoRoom.Create(Guid.NewGuid(), "room");
        room.SetRoomUrl("https://meet.com/room");

        _videoRepoMock.Setup(r => r.GetByIdAsync(room.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(room);

        var result = await _sut.GetRoomAsync(room.Id);
        result.Id.Should().Be(room.Id);
        result.RoomUrl.Should().Be("https://meet.com/room");
    }

    [Fact]
    public async Task GetRoomAsync_ShouldThrow_WhenNotFound()
    {
        _videoRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((VideoRoom?)null);

        Func<Task> act = () => _sut.GetRoomAsync(Guid.NewGuid());
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task GetRoomByRequestIdAsync_ShouldReturnNull_WhenNotFound()
    {
        _videoRepoMock.Setup(r => r.GetByRequestIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((VideoRoom?)null);

        var result = await _sut.GetRoomByRequestIdAsync(Guid.NewGuid());
        result.Should().BeNull();
    }
}

// ============================================================
// AuditService Tests
// ============================================================
public class AuditServiceTests
{
    private readonly Mock<IAuditLogRepository> _auditRepoMock = new();
    private readonly Mock<ILogger<AuditService>> _loggerMock = new();
    private readonly AuditService _sut;

    public AuditServiceTests()
    {
        _sut = new AuditService(_auditRepoMock.Object, _loggerMock.Object);
    }

    [Fact]
    public async Task LogAsync_ShouldCreateAuditLog()
    {
        _auditRepoMock.Setup(r => r.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        await _sut.LogAsync(Guid.NewGuid(), "Create", "Request", Guid.NewGuid());

        _auditRepoMock.Verify(r => r.CreateAsync(It.Is<AuditLog>(
            log => log.Action == "Create" && log.EntityType == "Request"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LogAsync_ShouldNotThrow_WhenRepositoryFails()
    {
        _auditRepoMock.Setup(r => r.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        // Should NOT throw - audit failures are swallowed
        await _sut.LogAsync(Guid.NewGuid(), "Create", "Request");
    }

    [Fact]
    public async Task LogAccessAsync_ShouldDelegateToLog()
    {
        _auditRepoMock.Setup(r => r.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        await _sut.LogAccessAsync(Guid.NewGuid(), "Payment", Guid.NewGuid());

        _auditRepoMock.Verify(r => r.CreateAsync(It.Is<AuditLog>(
            log => log.Action == "Read"), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LogModificationAsync_ShouldPassOldAndNewValues()
    {
        _auditRepoMock.Setup(r => r.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var oldVals = new Dictionary<string, object?> { ["status"] = "submitted" };
        var newVals = new Dictionary<string, object?> { ["status"] = "approved" };

        await _sut.LogModificationAsync(Guid.NewGuid(), "Update", "Request",
            Guid.NewGuid(), oldVals, newVals);

        _auditRepoMock.Verify(r => r.CreateAsync(It.Is<AuditLog>(
            log => log.Action == "Update" && log.OldValues != null && log.NewValues != null),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}

// ============================================================
// Extended RequestService Tests (consultation & cancel flows)
// ============================================================
public class ExtendedRequestServiceTests
{
    private readonly Mock<IRequestRepository> _requestRepoMock = new();
    private readonly Mock<IProductPriceRepository> _productPriceRepoMock = new();
    private readonly Mock<IUserRepository> _userRepoMock = new();
    private readonly Mock<IDoctorRepository> _doctorRepoMock = new();
    private readonly Mock<IVideoRoomRepository> _videoRoomRepoMock = new();
    private readonly Mock<INotificationRepository> _notificationRepoMock = new();
    private readonly Mock<IPushNotificationSender> _pushSenderMock = new();
    private readonly Mock<IAiReadingService> _aiReadingMock = new();
    private readonly Mock<IAiPrescriptionGeneratorService> _aiPrescriptionGeneratorMock = new();
    private readonly Mock<IPrescriptionPdfService> _pdfServiceMock = new();
    private readonly Mock<IConsultationAnamnesisRepository> _consultationAnamnesisRepoMock = new();
    private readonly Mock<IConsultationSessionStore> _consultationSessionStoreMock = new();
    private readonly Mock<IDigitalCertificateService> _certServiceMock = new();
    private readonly Mock<IPrescriptionVerifyRepository> _prescriptionVerifyRepoMock = new();
    private readonly Mock<IHttpClientFactory> _httpClientFactoryMock = new();
    private readonly Mock<IOptions<ApiConfig>> _apiConfigMock = new();
    private readonly Mock<IDocumentTokenService> _documentTokenServiceMock = new();
    private readonly Mock<ILogger<global::RenoveJa.Application.Services.Requests.RequestService>> _loggerMock = new();
    private readonly global::RenoveJa.Application.Services.Requests.RequestService _sut;

    public ExtendedRequestServiceTests()
    {
        _apiConfigMock.Setup(x => x.Value).Returns(new ApiConfig { BaseUrl = "" });
        _sut = new global::RenoveJa.Application.Services.Requests.RequestService(
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
        User.Reconstitute(id, "Dr. Teste Silva", "d@e.com", "hash", "Doctor",
            "11988776655", "98765432100", null, null, DateTime.UtcNow, DateTime.UtcNow);

    private void SetupDefaultMocks()
    {
        _notificationRepoMock.Setup(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification n, CancellationToken _) => n);
        _doctorRepoMock.Setup(r => r.GetAvailableAsync(It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<DoctorProfile>());
    }

    [Fact]
    public async Task CreateConsultationAsync_ShouldCreateWithSearchingDoctor()
    {
        SetupDefaultMocks();
        var userId = Guid.NewGuid();
        var user = CreatePatient(userId);

        _userRepoMock.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _requestRepoMock.Setup(r => r.CreateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);

        var dto = new RenoveJa.Application.DTOs.Requests.CreateConsultationRequestDto("Dor de cabeça forte");
        var (result, payment) = await _sut.CreateConsultationAsync(dto, userId);

        result.Status.Should().Be("searching_doctor");
        result.RequestType.Should().Be("consultation");
        result.Symptoms.Should().Be("Dor de cabeça forte");
        payment.Should().BeNull();
    }

    [Fact]
    public async Task CreateExamAsync_ShouldCreateValid()
    {
        SetupDefaultMocks();
        var userId = Guid.NewGuid();
        var user = CreatePatient(userId);

        _userRepoMock.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _requestRepoMock.Setup(r => r.CreateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);
        _requestRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid id, CancellationToken _) => null);

        var dto = new RenoveJa.Application.DTOs.Requests.CreateExamRequestDto(
            "sangue", new List<string> { "Hemograma", "Glicemia" }, "Febre");
        var (result, _) = await _sut.CreateExamAsync(dto, userId);

        result.Status.Should().Be("submitted");
        result.RequestType.Should().Be("exam");
    }

    [Fact]
    public async Task CancelAsync_ShouldCancel_WhenSubmitted()
    {
        var patientId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" });

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _requestRepoMock.Setup(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);

        var result = await _sut.CancelAsync(request.Id, patientId);
        result.Status.Should().Be("cancelled");
    }

    [Fact]
    public async Task CancelAsync_ShouldThrow_WhenNotOwner()
    {
        var patientId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" });

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        Func<Task> act = () => _sut.CancelAsync(request.Id, Guid.NewGuid());
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task CancelAsync_ShouldThrow_WhenAlreadyPaid()
    {
        var patientId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" });
        request.Approve(50);
        request.MarkAsPaid();

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        Func<Task> act = () => _sut.CancelAsync(request.Id, patientId);
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task MarkDeliveredAsync_ShouldDeliver_WhenSigned()
    {
        var patientId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" });
        request.Approve(50);
        request.MarkAsPaid();
        request.Sign("https://signed.pdf", "sig");

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _requestRepoMock.Setup(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);

        var result = await _sut.MarkDeliveredAsync(request.Id, patientId);
        result.Status.Should().Be("delivered");
    }

    [Fact]
    public async Task MarkDeliveredAsync_ShouldThrow_WhenNotOwner()
    {
        var patientId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" });
        request.Approve(50);
        request.MarkAsPaid();
        request.Sign("url", "sig");

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        Func<Task> act = () => _sut.MarkDeliveredAsync(request.Id, Guid.NewGuid());
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task AcceptConsultationAsync_ShouldCreateVideoRoom()
    {
        var patientId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var request = MedicalRequest.CreateConsultation(patientId, "P", "Symptoms");
        var doctor = CreateDoctor(doctorId);

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);
        _userRepoMock.Setup(r => r.GetByIdAsync(doctorId, It.IsAny<CancellationToken>())).ReturnsAsync(doctor);
        _productPriceRepoMock.Setup(r => r.GetPriceAsync("consultation", "default", It.IsAny<CancellationToken>()))
            .ReturnsAsync(149.90m);
        _requestRepoMock.Setup(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);
        _videoRoomRepoMock.Setup(r => r.CreateAsync(It.IsAny<VideoRoom>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((VideoRoom v, CancellationToken _) => v);
        _notificationRepoMock.Setup(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification n, CancellationToken _) => n);

        var (resultReq, resultRoom) = await _sut.AcceptConsultationAsync(request.Id, doctorId);

        resultReq.Status.Should().Be("consultation_ready");
        resultReq.DoctorId.Should().Be(doctorId);
        resultRoom.Should().NotBeNull();
        resultRoom.RoomName.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task AcceptConsultationAsync_ShouldThrow_WhenNotConsultation()
    {
        var request = MedicalRequest.CreatePrescription(Guid.NewGuid(), "P", PrescriptionType.Simple, new List<string> { "M" });

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        Func<Task> act = () => _sut.AcceptConsultationAsync(request.Id, Guid.NewGuid());
        await act.Should().ThrowAsync<InvalidOperationException>();
    }
}
