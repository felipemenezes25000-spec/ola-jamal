using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using FluentAssertions;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Video;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Application.Services.Video;
using RenoveJa.Application.Services.Audit;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.UnitTests.Services;

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
        var allNotifs = Enumerable.Range(1, 10)
            .Select(i => Notification.Create(userId, $"Title{i}", $"Msg{i}"))
            .ToList();
        var page2Notifs = allNotifs.Skip(3).Take(3).ToList();

        _notifRepoMock.Setup(r => r.CountByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(10);
        _notifRepoMock.Setup(r => r.GetByUserIdPagedAsync(userId, 3, 3, It.IsAny<CancellationToken>()))
            .ReturnsAsync(page2Notifs);

        var result = await _sut.GetUserNotificationsPagedAsync(userId, page: 2, pageSize: 3);

        result.Items.Should().HaveCount(3);
        result.TotalCount.Should().Be(10);
        result.Page.Should().Be(2);
        result.PageSize.Should().Be(3);
    }

    [Fact]
    public async Task MarkAsReadAsync_ShouldMarkAndReturn()
    {
        var userId = Guid.NewGuid();
        var notif = Notification.Create(userId, "T", "M");

        _notifRepoMock.Setup(r => r.GetByIdAsync(notif.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(notif);
        _notifRepoMock.Setup(r => r.UpdateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification n, CancellationToken _) => n);

        var result = await _sut.MarkAsReadAsync(notif.Id, userId);

        result.Read.Should().BeTrue();
        result.Id.Should().Be(notif.Id);
    }

    [Fact]
    public async Task MarkAsReadAsync_ShouldThrow_WhenNotFound()
    {
        _notifRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification?)null);

        Func<Task> act = () => _sut.MarkAsReadAsync(Guid.NewGuid(), Guid.NewGuid());
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task MarkAsReadAsync_ShouldThrow_WhenNotOwner()
    {
        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var notif = Notification.Create(ownerId, "T", "M");

        _notifRepoMock.Setup(r => r.GetByIdAsync(notif.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(notif);

        Func<Task> act = () => _sut.MarkAsReadAsync(notif.Id, otherUserId);
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
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
        _sut = new VideoService(_videoRepoMock.Object, _requestRepoMock.Object, Options.Create(new RenoveJa.Application.Configuration.DailyConfig()));
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
        result.RoomName.Should().StartWith("consult-");
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
    private readonly Mock<IAiConductSuggestionService> _aiConductSuggestionServiceMock = new();
    private readonly Mock<IRequestEventsPublisher> _requestEventsPublisherMock = new();
    private readonly Mock<ISignedRequestClinicalSyncService> _signedRequestClinicalSyncMock = new();
    private readonly Mock<IConsultationEncounterService> _consultationEncounterServiceMock = new();
    private readonly Mock<ILogger<global::RenoveJa.Application.Services.Requests.RequestService>> _loggerMock = new();
    private readonly global::RenoveJa.Application.Services.Requests.RequestService _sut;

    public ExtendedRequestServiceTests()
    {
        _apiConfigMock.Setup(x => x.Value).Returns(new ApiConfig { BaseUrl = "" });
        var storageServiceMock = new Mock<IStorageService>();
        var pushDispatcherMock = new Mock<IPushNotificationDispatcher>();
        pushDispatcherMock.Setup(x => x.SendAsync(It.IsAny<RenoveJa.Application.DTOs.Notifications.PushNotificationRequest>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var requestApprovalLoggerMock = new Mock<Microsoft.Extensions.Logging.ILogger<RenoveJa.Application.Services.Requests.RequestApprovalService>>();
        var requestApprovalService = new RenoveJa.Application.Services.Requests.RequestApprovalService(
            _requestRepoMock.Object,
            _userRepoMock.Object,
            pushDispatcherMock.Object,
            _requestEventsPublisherMock.Object,
            _aiConductSuggestionServiceMock.Object,
            requestApprovalLoggerMock.Object);
        _sut = new global::RenoveJa.Application.Services.Requests.RequestService(
            _requestRepoMock.Object,
            _userRepoMock.Object, _doctorRepoMock.Object,
            _notificationRepoMock.Object, _pushSenderMock.Object, pushDispatcherMock.Object, _aiReadingMock.Object,
            _apiConfigMock.Object,
            _documentTokenServiceMock.Object,
            _aiConductSuggestionServiceMock.Object,
            _requestEventsPublisherMock.Object,
            new Mock<IAuditService>().Object,
            requestApprovalService,
            new RenoveJa.Application.Services.Requests.RequestQueryService(
                _requestRepoMock.Object, _userRepoMock.Object,
                _consultationAnamnesisRepoMock.Object, _documentTokenServiceMock.Object,
                storageServiceMock.Object, _apiConfigMock.Object, new Mock<ILogger<RenoveJa.Application.Services.Requests.RequestQueryService>>().Object),
            new RenoveJa.Application.Services.Requests.ConsultationLifecycleService(
                _requestRepoMock.Object, _userRepoMock.Object,
                _videoRoomRepoMock.Object, _consultationAnamnesisRepoMock.Object,
                _consultationSessionStoreMock.Object,
                _consultationEncounterServiceMock.Object, storageServiceMock.Object,
                new Mock<IAuditService>().Object,
                _requestEventsPublisherMock.Object, pushDispatcherMock.Object,
                _documentTokenServiceMock.Object, _apiConfigMock.Object,
                Options.Create(new RenoveJa.Application.Configuration.DailyConfig()),
                new Mock<RenoveJa.Application.Interfaces.ISoapNotesService>().Object,
                new Mock<RenoveJa.Application.Interfaces.IStartConsultationRecording>().Object,
                new Mock<RenoveJa.Application.Interfaces.IRecordingSyncService>().Object,
                CreateScopeFactoryMock(),
                new Mock<ILogger<RenoveJa.Application.Services.Requests.ConsultationLifecycleService>>().Object),
            new RenoveJa.Application.Services.Requests.SignatureService(
                _requestRepoMock.Object, _doctorRepoMock.Object, _userRepoMock.Object,
                _certServiceMock.Object, _aiPrescriptionGeneratorMock.Object,
                _pdfServiceMock.Object, _prescriptionVerifyRepoMock.Object,
                _documentTokenServiceMock.Object, storageServiceMock.Object,
                _requestEventsPublisherMock.Object, pushDispatcherMock.Object,
                _signedRequestClinicalSyncMock.Object,
                _notificationRepoMock.Object, _pushSenderMock.Object,
                _httpClientFactoryMock.Object, _apiConfigMock.Object,
                new Mock<ILogger<RenoveJa.Application.Services.Requests.SignatureService>>().Object),
            _loggerMock.Object);
    }

    private static User CreatePatient(Guid id) =>
        User.Reconstitute(id, "Paciente Teste", "p@e.com", "hash", "Patient",
            "11987654321", "12345678901", null, null, DateTime.UtcNow, DateTime.UtcNow);

    private static User CreateDoctor(Guid id) =>
        User.Reconstitute(id, "Dr. Teste Silva", "d@e.com", "hash", "Doctor",
            "11988776655", "98765432100", null, null, DateTime.UtcNow, DateTime.UtcNow);

    private static IServiceScopeFactory CreateScopeFactoryMock()
    {
        var syncMock = new Mock<IRecordingSyncService>();
        syncMock.Setup(s => s.TrySyncRecordingAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        var spMock = new Mock<IServiceProvider>();
        spMock.Setup(sp => sp.GetService(typeof(IRecordingSyncService))).Returns(syncMock.Object);
        var scopeMock = new Mock<IServiceScope>();
        scopeMock.Setup(s => s.ServiceProvider).Returns(spMock.Object);
        var sfMock = new Mock<IServiceScopeFactory>();
        sfMock.Setup(sf => sf.CreateScope()).Returns(scopeMock.Object);
        return sfMock.Object;
    }

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
        var result = await _sut.CreateConsultationAsync(dto, userId);

        result.Status.Should().Be("searching_doctor");
        result.RequestType.Should().Be("consultation");
        result.Symptoms.Should().Be("Dor de cabeça forte");
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
        var result = await _sut.CreateExamAsync(dto, userId);

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
        request.Approve(0);

        _requestRepoMock.Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>())).ReturnsAsync(request);

        Func<Task> act = () => _sut.CancelAsync(request.Id, patientId);
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task MarkDeliveredAsync_ShouldDeliver_WhenSigned()
    {
        var patientId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(patientId, "P", PrescriptionType.Simple, new List<string> { "M" });
        request.Approve(0);
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
        request.Approve(0);
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
        _requestRepoMock.Setup(r => r.UpdateAsync(It.IsAny<MedicalRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalRequest req, CancellationToken _) => req);
        _videoRoomRepoMock.Setup(r => r.CreateAsync(It.IsAny<VideoRoom>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((VideoRoom v, CancellationToken _) => v);
        _notificationRepoMock.Setup(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification n, CancellationToken _) => n);

        var (resultReq, resultRoom) = await _sut.AcceptConsultationAsync(request.Id, doctorId);

        resultReq.Status.Should().Be("paid");
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
