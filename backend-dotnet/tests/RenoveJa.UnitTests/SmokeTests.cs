using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using RenoveJa.Api.Controllers;
using RenoveJa.Api.Middleware;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Analytics;
using RenoveJa.Application.DTOs.Clinical;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Payments;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using Xunit;

namespace RenoveJa.UnitTests.Smoke;

// ============================================================
// AnalyticsController Smoke Tests
// ============================================================
public class AnalyticsControllerSmokeTests
{
    private readonly Mock<ILogger<AnalyticsController>> _loggerMock = new();
    private readonly AnalyticsController _sut;

    public AnalyticsControllerSmokeTests()
    {
        _sut = new AnalyticsController(_loggerMock.Object);
    }

    [Fact]
    public void AnalyticsController_IngestEvents_ShouldReturnAccepted_WhenValidBatch()
    {
        var batch = new AnalyticsBatchDto
        {
            Events =
            [
                new AnalyticsEventDto
                {
                    EventName = "screen_view",
                    Timestamp = DateTimeOffset.UtcNow,
                    SessionId = "sess-123",
                    DevicePlatform = "ios",
                    DeviceVersion = "17.0",
                    Properties = new Dictionary<string, string> { ["screen"] = "home" }
                }
            ]
        };

        var userId = Guid.NewGuid();
        _sut.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, userId.ToString())],
                    "Bearer"))
            }
        };

        var result = _sut.IngestEvents(batch);

        var accepted = result.Should().BeOfType<Microsoft.AspNetCore.Mvc.AcceptedResult>().Subject;
        accepted.StatusCode.Should().Be(202);
    }

    [Fact]
    public void AnalyticsController_Health_ShouldReturnHealthyStatus_WhenCalled()
    {
        var result = _sut.Health();

        var okResult = result.Should().BeOfType<Microsoft.AspNetCore.Mvc.OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        var dto = okResult.Value.Should().BeOfType<HealthMetricsDto>().Subject;
        dto.Status.Should().Be("healthy");
        dto.UptimeSeconds.Should().BeGreaterOrEqualTo(0);
        dto.ServerTime.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
    }
}

// ============================================================
// FhirLiteController Smoke Tests
// ============================================================
public class FhirLiteControllerSmokeTests
{
    private readonly Mock<IClinicalRecordService> _clinicalRecordServiceMock = new();
    private readonly Mock<IAuditEventService> _auditEventServiceMock = new();
    private readonly Mock<ILogger<FhirLiteController>> _loggerMock = new();
    private readonly FhirLiteController _sut;

    public FhirLiteControllerSmokeTests()
    {
        _sut = new FhirLiteController(
            _clinicalRecordServiceMock.Object,
            _auditEventServiceMock.Object,
            _loggerMock.Object);
    }

    private void SetupAuthenticatedUser(Guid userId)
    {
        _sut.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, userId.ToString())],
                    "Bearer")),
                Connection = { RemoteIpAddress = System.Net.IPAddress.Loopback }
            }
        };
    }

    [Fact]
    public async Task FhirLiteController_GetMyPatientSummary_ShouldReturnSummary_WhenServiceReturnsData()
    {
        var userId = Guid.NewGuid();
        SetupAuthenticatedUser(userId);

        var summary = new PatientSummaryDto
        {
            Id = userId,
            Name = new PatientNameDto { Full = "Paciente Teste", Social = "Paciente" },
            Stats = new PatientSummaryStatsDto { TotalRequests = 3, TotalPrescriptions = 2 }
        };

        _clinicalRecordServiceMock
            .Setup(s => s.GetPatientSummaryAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(summary);
        _auditEventServiceMock
            .Setup(s => s.LogReadAsync(It.IsAny<Guid?>(), It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var result = await _sut.GetMyPatientSummary(CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<Microsoft.AspNetCore.Mvc.OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        var dto = okResult.Value.Should().BeOfType<PatientSummaryDto>().Subject;
        dto.Name.Full.Should().Be("Paciente Teste");
        dto.Stats.TotalRequests.Should().Be(3);
    }

    [Fact]
    public async Task FhirLiteController_GetMyEncounters_ShouldReturnList_WhenCalled()
    {
        var userId = Guid.NewGuid();
        SetupAuthenticatedUser(userId);

        var encounters = new List<EncounterSummaryDto>
        {
            new() { Id = Guid.NewGuid(), Type = EncounterType.Teleconsultation, StartedAt = DateTime.UtcNow.AddDays(-1) }
        };

        _clinicalRecordServiceMock
            .Setup(s => s.GetEncountersByPatientAsync(userId, 50, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(encounters);
        _auditEventServiceMock
            .Setup(s => s.LogReadAsync(It.IsAny<Guid?>(), It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var result = await _sut.GetMyEncounters(limit: 50, offset: 0, CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<Microsoft.AspNetCore.Mvc.OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        var list = okResult.Value.Should().BeAssignableTo<IReadOnlyList<EncounterSummaryDto>>().Subject;
        list.Should().HaveCount(1);
    }

    [Fact]
    public async Task FhirLiteController_GetMyDocuments_ShouldReturnList_WhenCalled()
    {
        var userId = Guid.NewGuid();
        SetupAuthenticatedUser(userId);

        var documents = new List<MedicalDocumentSummaryDto>
        {
            new() { Id = Guid.NewGuid(), DocumentType = DocumentType.Prescription, Status = "signed", CreatedAt = DateTime.UtcNow }
        };

        _clinicalRecordServiceMock
            .Setup(s => s.GetMedicalDocumentsByPatientAsync(userId, 50, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(documents);
        _auditEventServiceMock
            .Setup(s => s.LogReadAsync(It.IsAny<Guid?>(), It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var result = await _sut.GetMyDocuments(limit: 50, offset: 0, CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<Microsoft.AspNetCore.Mvc.OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        var list = okResult.Value.Should().BeAssignableTo<IReadOnlyList<MedicalDocumentSummaryDto>>().Subject;
        list.Should().HaveCount(1);
    }
}

// ============================================================
// PaymentService Webhook Validation Smoke Tests
// ============================================================
public class PaymentServiceWebhookValidationSmokeTests
{
    private static string ComputeHmac(string secret, string manifest)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(manifest));
        return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
    }

    [Fact]
    public void PaymentService_ValidateWebhookSignature_ShouldReturnTrue_WhenValidHmac()
    {
        var secret = "test-webhook-secret-key";
        var ts = "1234567890";
        var dataId = "12345";
        var requestId = "req-xyz";

        var manifest = $"id:{dataId};request-id:{requestId};ts:{ts};";
        var validV1 = ComputeHmac(secret, manifest);
        var xSignature = $"ts={ts},v1={validV1}";

        var mpConfig = Options.Create(new MercadoPagoConfig { WebhookSecret = secret });
        var sut = CreatePaymentService(mpConfig);

        var result = sut.ValidateWebhookSignature(xSignature, requestId, dataId);

        result.Should().BeTrue();
    }

    [Fact]
    public void PaymentService_ValidateWebhookSignature_ShouldReturnFalse_WhenInvalidHmac()
    {
        var secret = "test-webhook-secret-key";
        var mpConfig = Options.Create(new MercadoPagoConfig { WebhookSecret = secret });
        var sut = CreatePaymentService(mpConfig);

        var xSignature = "ts=1234567890,v1=invalid-hash-value";
        var result = sut.ValidateWebhookSignature(xSignature, "req-1", "12345");

        result.Should().BeFalse();
    }

    private static PaymentService CreatePaymentService(IOptions<MercadoPagoConfig> mpConfig)
    {
        var paymentRepoMock = new Mock<IPaymentRepository>();
        var requestRepoMock = new Mock<IRequestRepository>();
        var notificationRepoMock = new Mock<INotificationRepository>();
        var pushSenderMock = new Mock<IPushNotificationSender>();
        var mercadoPagoMock = new Mock<IMercadoPagoService>();
        var userRepoMock = new Mock<IUserRepository>();
        var paymentAttemptRepoMock = new Mock<IPaymentAttemptRepository>();
        var savedCardRepoMock = new Mock<ISavedCardRepository>();
        var requestEventsPublisherMock = new Mock<IRequestEventsPublisher>();
        var loggerMock = new Mock<ILogger<PaymentService>>();

        return new PaymentService(
            paymentRepoMock.Object,
            requestRepoMock.Object,
            notificationRepoMock.Object,
            pushSenderMock.Object,
            mercadoPagoMock.Object,
            userRepoMock.Object,
            paymentAttemptRepoMock.Object,
            savedCardRepoMock.Object,
            mpConfig,
            requestEventsPublisherMock.Object,
            loggerMock.Object);
    }
}

// ============================================================
// ExceptionHandlingMiddleware Correlation ID Smoke Tests
// ============================================================
public class ExceptionHandlingMiddlewareCorrelationIdSmokeTests
{
    [Fact]
    public async Task ExceptionHandlingMiddleware_InvokeAsync_ShouldIncludeRequestIdInErrorResponse_WhenExceptionOccurs()
    {
        var correlationId = "corr-abc-123";
        var loggerMock = new Mock<ILogger<ExceptionHandlingMiddleware>>();

        RequestDelegate next = _ => throw new InvalidOperationException("Test error");

        var middleware = new ExceptionHandlingMiddleware(next, loggerMock.Object);

        var context = new DefaultHttpContext();
        context.Items["CorrelationId"] = correlationId;
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(400);
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        var json = JsonSerializer.Deserialize<JsonElement>(body);

        json.TryGetProperty("requestId", out var requestIdProp).Should().BeTrue();
        requestIdProp.GetString().Should().Be(correlationId);
    }

    [Fact]
    public async Task ExceptionHandlingMiddleware_InvokeAsync_ShouldUseTraceIdentifierAsRequestId_WhenCorrelationIdNotSet()
    {
        var traceId = "trace-xyz-456";
        var loggerMock = new Mock<ILogger<ExceptionHandlingMiddleware>>();

        RequestDelegate next = _ => throw new KeyNotFoundException("Not found");

        var middleware = new ExceptionHandlingMiddleware(next, loggerMock.Object);

        var context = new DefaultHttpContext();
        context.TraceIdentifier = traceId;
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(404);
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        var json = JsonSerializer.Deserialize<JsonElement>(body);

        json.TryGetProperty("requestId", out var requestIdProp).Should().BeTrue();
        requestIdProp.GetString().Should().Be(traceId);
    }
}
