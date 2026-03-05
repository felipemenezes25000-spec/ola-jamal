using Moq;
using Xunit;
using FluentAssertions;
using RenoveJa.Application.DTOs.Assistant;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Assistant;

namespace RenoveJa.UnitTests.Services;

public class AssistantNavigatorServiceTests
{
    private readonly Mock<IRequestService> _requestServiceMock = new();
    private readonly AssistantNavigatorService _sut;

    public AssistantNavigatorServiceTests()
    {
        _sut = new AssistantNavigatorService(_requestServiceMock.Object);
    }

    private static RequestResponseDto CreateRequestDto(Guid id, string status, string requestType, string? signedDocumentUrl = null)
    {
        var now = DateTime.UtcNow;
        return new RequestResponseDto(
            id, Guid.NewGuid(), "P", null, null, requestType, status,
            null, null, null, null, null, null, null, null, null, null, null, null, null, signedDocumentUrl, null,
            now, now);
    }

    [Fact]
    public void EvaluateCompleteness_Prescription_ShouldReturnCorrectScore_WhenComplete()
    {
        var request = new AssistantCompleteRequestDto(
            Flow: "prescription",
            PrescriptionType: "simples",
            ImagesCount: 2);

        var result = _sut.EvaluateCompleteness(request);

        result.Score.Should().Be(100);
        result.DoneCount.Should().Be(3);
        result.TotalCount.Should().Be(3);
        result.MissingFields.Should().BeEmpty();
        result.Checks.Should().HaveCount(3);
        result.Checks.Should().Contain(c => c.Id == "prescription_type" && c.Done);
        result.Checks.Should().Contain(c => c.Id == "main_photo" && c.Done);
        result.Checks.Should().Contain(c => c.Id == "extra_photo" && c.Done);
    }

    [Fact]
    public void EvaluateCompleteness_Prescription_ShouldReturnPartialScore_WhenMissingPhoto()
    {
        var request = new AssistantCompleteRequestDto(
            Flow: "prescription",
            PrescriptionType: "controlado",
            ImagesCount: 0);

        var result = _sut.EvaluateCompleteness(request);

        result.Score.Should().BeLessThan(100);
        result.MissingFields.Should().Contain("main_photo");
        result.Checks.Should().Contain(c => c.Id == "main_photo" && !c.Done);
    }

    [Fact]
    public void EvaluateCompleteness_Exam_ShouldReturnCorrectScore_WhenComplete()
    {
        var request = new AssistantCompleteRequestDto(
            Flow: "exam",
            ExamType: "laboratorial",
            ExamsCount: 2,
            Symptoms: "Dor de cabeça há uma semana, piora pela manhã",
            ImagesCount: 0);

        var result = _sut.EvaluateCompleteness(request);

        result.Score.Should().Be(100);
        result.MissingFields.Should().BeEmpty();
        result.Checks.Should().Contain(c => c.Id == "exam_type" && c.Done);
        result.Checks.Should().Contain(c => c.Id == "exam_or_image" && c.Done);
        result.Checks.Should().Contain(c => c.Id == "symptoms" && c.Done);
    }

    [Fact]
    public void EvaluateCompleteness_Exam_ShouldDetectRedFlags_InSymptoms()
    {
        var request = new AssistantCompleteRequestDto(
            Flow: "exam",
            ExamType: "laboratorial",
            ExamsCount: 1,
            Symptoms: "Dor no peito e falta de ar",
            ImagesCount: 0);

        var result = _sut.EvaluateCompleteness(request);

        result.HasUrgencyRisk.Should().BeTrue();
        result.UrgencySignals.Should().NotBeEmpty();
        result.UrgencySignals.Should().Contain("dor no peito");
        result.UrgencySignals.Should().Contain("falta de ar");
        result.UrgencyMessage.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void EvaluateCompleteness_Consultation_ShouldReturnCorrectScore_WhenComplete()
    {
        var request = new AssistantCompleteRequestDto(
            Flow: "consultation",
            ConsultationType: "psicologo",
            DurationMinutes: 15,
            Symptoms: "Ansiedade e insônia há duas semanas. Começou após mudança de emprego, piora à noite.");

        var result = _sut.EvaluateCompleteness(request);

        result.Score.Should().Be(100);
        result.MissingFields.Should().BeEmpty();
        result.Checks.Should().Contain(c => c.Id == "professional_type" && c.Done);
        result.Checks.Should().Contain(c => c.Id == "duration" && c.Done);
        result.Checks.Should().Contain(c => c.Id == "main_reason" && c.Done);
    }

    [Fact]
    public void EvaluateCompleteness_InvalidFlow_ShouldReturnEmptyChecks()
    {
        var request = new AssistantCompleteRequestDto(Flow: "invalid");

        var result = _sut.EvaluateCompleteness(request);

        result.Checks.Should().BeEmpty();
        result.Score.Should().Be(0);
    }

    [Fact]
    public async Task GetNextActionAsync_WithRequestId_ShouldResolveStatusFromRequest()
    {
        var requestId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var dto = CreateRequestDto(requestId, "approved_pending_payment", "prescription");

        _requestServiceMock
            .Setup(s => s.GetRequestByIdAsync(requestId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(dto);

        var request = new AssistantNextActionRequestDto(RequestId: requestId);
        var result = await _sut.GetNextActionAsync(request, userId);

        result.Intent.Should().Be("pay");
        result.CtaLabel.Should().Be("Pagar agora");
    }

    [Fact]
    public async Task GetNextActionAsync_WithStatusDirectly_ShouldReturnCorrectAction()
    {
        var request = new AssistantNextActionRequestDto(Status: "submitted", RequestType: "prescription");
        var result = await _sut.GetNextActionAsync(request, Guid.NewGuid());

        result.Intent.Should().Be("track");
        result.Title.Should().Contain("recebido");
    }
}
