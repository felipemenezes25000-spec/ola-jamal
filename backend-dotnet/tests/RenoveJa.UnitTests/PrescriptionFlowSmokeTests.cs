using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using RenoveJa.Application.Services.Verification;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using Xunit;

namespace RenoveJa.UnitTests;

/// <summary>
/// Smoke tests cobrindo o fluxo end-to-end de prescrição:
///   Criada (Submitted) → Revisão → ApprovedPendingPayment → Paid → Signed → Verificação pública
///
/// Não fazem chamadas HTTP, banco de dados ou integrações externas.
/// Testam regras de domínio e service de verificação com mocks.
/// </summary>
public class PrescriptionFlowSmokeTests
{
    // ─── Helpers ───────────────────────────────────────────────────────────────

    private static User BuildPatient(string name = "Paciente Smoke", string cpf = "12345678900")
    {
        return User.Reconstitute(
            Guid.NewGuid(),
            name,
            "smoke-patient@example.com",
            "hashed",
            "Patient",
            "11999990000",
            cpf,
            new DateTime(1990, 5, 20),
            null,
            DateTime.UtcNow,
            DateTime.UtcNow);
    }

    private static User BuildDoctor(string name = "Dr. Smoke Médico")
    {
        return User.Reconstitute(
            Guid.NewGuid(),
            name,
            "smoke-doctor@example.com",
            "hashed",
            "Doctor",
            "11988880000",
            "98765432100",
            new DateTime(1978, 3, 10),
            null,
            DateTime.UtcNow,
            DateTime.UtcNow);
    }

    private static DoctorProfile BuildDoctorProfile(Guid doctorUserId)
    {
        return DoctorProfile.Reconstitute(
            Guid.NewGuid(),
            doctorUserId,
            "123456",
            "SP",
            "Clínica Geral",
            null,
            5.0m,
            0,
            true,
            null,
            false,
            null,
            DateTime.UtcNow,
            null,
            null);
    }

    // ─── Testes de Domínio: fluxo de status ────────────────────────────────────

    [Fact]
    public void Prescription_Creation_ShouldHaveSubmittedStatus()
    {
        var patientId = Guid.NewGuid();
        var request = MedicalRequest.CreatePrescription(
            patientId,
            "Paciente Smoke",
            PrescriptionType.Simple,
            new List<string> { "Paracetamol 500mg" });

        request.Status.Should().Be(RequestStatus.Submitted);
        request.RequestType.Should().Be(RequestType.Prescription);
        request.PatientId.Should().Be(patientId);
        request.Medications.Should().ContainSingle();
        request.AccessCode.Should().HaveLength(4).And.MatchRegex(@"^\d{4}$");
    }

    [Fact]
    public void Prescription_Approve_ShouldSetApprovedPendingPayment()
    {
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(),
            "Paciente Smoke",
            PrescriptionType.Simple,
            new List<string> { "Ibuprofeno 600mg" });

        var doctorId = Guid.NewGuid();
        request.AssignDoctor(doctorId, "Dr. Smoke");
        request.Approve(49.90m);

        request.Status.Should().Be(RequestStatus.ApprovedPendingPayment);
        request.DoctorId.Should().Be(doctorId);
        request.Price.Should().NotBeNull();
        request.Price!.Amount.Should().Be(49.90m);
    }

    [Fact]
    public void Prescription_MarkAsPaid_ShouldSetPaidStatus()
    {
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(),
            "Paciente Smoke",
            PrescriptionType.Simple,
            new List<string> { "Omeprazol 20mg" });

        request.AssignDoctor(Guid.NewGuid(), "Dr. Smoke");
        request.Approve(49.90m);
        request.MarkAsPaid();

        request.Status.Should().Be(RequestStatus.Paid);
    }

    [Fact]
    public void Prescription_Sign_ShouldSetSignedStatusAndAccessCode()
    {
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(),
            "Paciente Smoke",
            PrescriptionType.Simple,
            new List<string> { "Amoxicilina 500mg" });

        request.AssignDoctor(Guid.NewGuid(), "Dr. Smoke");
        request.Approve(49.90m);
        request.MarkAsPaid();

        var signedUrl = "https://storage.example.com/prescription.pdf";
        var signatureId = "sig-abc-123";
        request.Sign(signedUrl, signatureId);

        request.Status.Should().Be(RequestStatus.Signed);
        request.SignedDocumentUrl.Should().Be(signedUrl);
        request.SignatureId.Should().Be(signatureId);
        request.SignedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        request.AccessCode.Should().HaveLength(4).And.MatchRegex(@"^\d{4}$");
    }

    [Fact]
    public void Prescription_Reject_ShouldSetRejectedStatus()
    {
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(),
            "Paciente Smoke",
            PrescriptionType.Controlled,
            new List<string> { "Ritalina 10mg" });

        request.AssignDoctor(Guid.NewGuid(), "Dr. Smoke");
        request.Reject("Receita ilegível — solicite nova foto.");

        request.Status.Should().Be(RequestStatus.Rejected);
        request.RejectionReason.Should().Contain("ilegível");
    }

    // ─── Testes de Domínio: fluxo de consulta ──────────────────────────────────

    [Fact]
    public void Consultation_Creation_ShouldHaveSearchingDoctorStatus()
    {
        var request = MedicalRequest.CreateConsultation(
            Guid.NewGuid(),
            "Paciente Smoke",
            "Dor abdominal há 3 dias");

        request.Status.Should().Be(RequestStatus.SearchingDoctor);
        request.RequestType.Should().Be(RequestType.Consultation);
        request.Symptoms.Should().NotBeNullOrEmpty();
    }

    // ─── Testes de Serviço: VerificationService ────────────────────────────────

    [Fact]
    public async Task VerificationService_GetPublicVerification_ReturnsMaskedData()
    {
        // Arrange
        var patientId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();

        var request = MedicalRequest.CreatePrescription(
            patientId,
            "Felipe Menezes da Silva",
            PrescriptionType.Simple,
            new List<string> { "Paracetamol 500mg" });

        request.AssignDoctor(doctorId, "Dr. Ana Lima");
        request.Approve(49.90m);
        request.MarkAsPaid();
        request.Sign("https://storage.example.com/rx.pdf", "sig-xyz");

        var requestRepoMock = new Mock<IRequestRepository>();
        requestRepoMock
            .Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);

        var doctorRepoMock = new Mock<IDoctorRepository>();
        doctorRepoMock
            .Setup(d => d.GetByUserIdAsync(doctorId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildDoctorProfile(doctorId));

        var userRepoMock = new Mock<IUserRepository>();
        var loggerMock = new Mock<ILogger<VerificationService>>();

        var sut = new VerificationService(
            requestRepoMock.Object,
            doctorRepoMock.Object,
            userRepoMock.Object,
            loggerMock.Object);

        // Act
        var result = await sut.GetPublicVerificationAsync(request.Id);

        // Assert
        result.Should().NotBeNull();
        result!.PatientName.Should().Be("Felipe Silva", "deve mascarar nome parcial: primeiro + último nome");
        result.DoctorName.Should().Be("Dr. Ana Lima");
        result.DoctorCrm.Should().Be("123456");
        result.Status.Should().Be("signed");
        result.AccessCodeRequired.Should().BeTrue();
    }

    [Fact]
    public async Task VerificationService_GetFullVerification_WithValidCode_ReturnsFullData()
    {
        // Arrange
        var patientId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();

        var request = MedicalRequest.CreatePrescription(
            patientId,
            "João Silva de Oliveira",
            PrescriptionType.Simple,
            new List<string> { "Dipirona 500mg" });

        request.AssignDoctor(doctorId, "Dr. Ana Lima");
        request.Approve(49.90m);
        request.MarkAsPaid();
        request.Sign("https://storage.example.com/rx.pdf", "sig-abc");

        var storedCode = request.AccessCode!;

        var requestRepoMock = new Mock<IRequestRepository>();
        requestRepoMock
            .Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);

        var doctorRepoMock = new Mock<IDoctorRepository>();
        doctorRepoMock
            .Setup(d => d.GetByUserIdAsync(doctorId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildDoctorProfile(doctorId));

        var patient = BuildPatient("João Silva de Oliveira", "12345678900");
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock
            .Setup(u => u.GetByIdAsync(patientId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(patient);

        var sut = new VerificationService(
            requestRepoMock.Object,
            doctorRepoMock.Object,
            userRepoMock.Object,
            new Mock<ILogger<VerificationService>>().Object);

        // Act — código correto
        var result = await sut.GetFullVerificationAsync(request.Id, storedCode);

        // Assert
        result.Should().NotBeNull();
        result!.PatientFullName.Should().Be("João Silva de Oliveira");
        result.SignedDocumentUrl.Should().Be("https://storage.example.com/rx.pdf");
        result.Medications.Should().ContainSingle().Which.Should().Contain("Dipirona");
    }

    [Fact]
    public async Task VerificationService_GetFullVerification_WithWrongCode_ThrowsUnauthorized()
    {
        var request = MedicalRequest.CreatePrescription(
            Guid.NewGuid(),
            "Paciente Smoke",
            PrescriptionType.Simple,
            new List<string> { "Aspirina 100mg" });

        request.AssignDoctor(Guid.NewGuid(), "Dr. Smoke");
        request.Approve(49.90m);
        request.MarkAsPaid();
        request.Sign("https://storage.example.com/rx.pdf", "sig-err");

        var requestRepoMock = new Mock<IRequestRepository>();
        requestRepoMock
            .Setup(r => r.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);

        var sut = new VerificationService(
            requestRepoMock.Object,
            new Mock<IDoctorRepository>().Object,
            new Mock<IUserRepository>().Object,
            new Mock<ILogger<VerificationService>>().Object);

        // Act & Assert
        await sut.Invoking(s => s.GetFullVerificationAsync(request.Id, "0000"))
            .Should().ThrowAsync<UnauthorizedAccessException>();
    }

    // ─── Testes de State Machine: transições inválidas ─────────────────────────

    [Fact]
    public void VerificationService_MaskPatientName_ShouldReturnFirstAndLastName()
    {
        VerificationService.MaskPatientName("Felipe Menezes da Silva Oliveira").Should().Be("Felipe Oliveira");
        VerificationService.MaskPatientName("Ana Lima").Should().Be("Ana Lima");
        VerificationService.MaskPatientName("João").Should().Be("João");
        VerificationService.MaskPatientName(null).Should().BeNull();
        VerificationService.MaskPatientName("   ").Should().BeNull();
    }

    [Fact]
    public void VerificationService_MaskCpf_ShouldMaskMiddleDigits()
    {
        VerificationService.MaskCpf("12345678900").Should().Be("123.***.***-00");
        VerificationService.MaskCpf(null).Should().BeNull();
        VerificationService.MaskCpf("invalid").Should().Be("***.***.***-**");
        VerificationService.MaskCpf("123.456.789-00").Should().Be("123.***.***-00");
    }

    [Fact]
    public void VerificationService_GenerateAccessCode_ShouldBeDeterministicAndFourDigits()
    {
        var id = Guid.NewGuid();
        var code1 = VerificationService.GenerateAccessCode(id);
        var code2 = VerificationService.GenerateAccessCode(id);

        code1.Should().HaveLength(4).And.MatchRegex(@"^\d{4}$");
        code1.Should().Be(code2, "deve ser determinístico para o mesmo ID");

        var otherId = Guid.NewGuid();
        var codeOther = VerificationService.GenerateAccessCode(otherId);
        // Não verificamos igualdade — pode colidir em casos raros (isso é aceitável por design)
        codeOther.Should().HaveLength(4).And.MatchRegex(@"^\d{4}$");
    }

    // ─── Testes de domínio: exame ───────────────────────────────────────────────

    [Fact]
    public void Exam_Creation_ShouldHaveSubmittedStatus()
    {
        var patientId = Guid.NewGuid();
        var request = MedicalRequest.CreateExam(
            patientId,
            "Paciente Smoke",
            "laboratorial",
            new List<string> { "Hemograma completo", "Glicemia em jejum" },
            "Check-up anual");

        request.Status.Should().Be(RequestStatus.Submitted);
        request.RequestType.Should().Be(RequestType.Exam);
        request.Exams.Should().HaveCount(2);
    }

    [Fact]
    public void Exam_Creation_WithoutExamsOrSymptoms_ShouldThrow()
    {
        var act = () => MedicalRequest.CreateExam(
            Guid.NewGuid(),
            "Paciente Smoke",
            "laboratorial",
            new List<string>());

        act.Should().Throw<Exception>("exame sem exames/sintomas/imagens deve falhar");
    }

    // ─── Testes: canonical status transitions via domain ────────────────────────

    [Theory]
    [InlineData(RequestStatus.Submitted)]
    [InlineData(RequestStatus.InReview)]
    [InlineData(RequestStatus.ApprovedPendingPayment)]
    [InlineData(RequestStatus.Paid)]
    [InlineData(RequestStatus.Signed)]
    [InlineData(RequestStatus.Delivered)]
    [InlineData(RequestStatus.SearchingDoctor)]
    [InlineData(RequestStatus.ConsultationReady)]
    [InlineData(RequestStatus.InConsultation)]
    [InlineData(RequestStatus.ConsultationFinished)]
    [InlineData(RequestStatus.Rejected)]
    [InlineData(RequestStatus.Cancelled)]
    public void CanonicalStatuses_ShouldNotBeObsolete(RequestStatus status)
    {
        var memberInfo = typeof(RequestStatus).GetMember(status.ToString()).FirstOrDefault();
        var isObsolete = memberInfo?.GetCustomAttributes(typeof(ObsoleteAttribute), false).Any() ?? false;
        isObsolete.Should().BeFalse($"status canônico {status} não deve ser [Obsolete]");
    }

    [Theory]
#pragma warning disable CS0618
    [InlineData(RequestStatus.Pending)]
    [InlineData(RequestStatus.Analyzing)]
    [InlineData(RequestStatus.Approved)]
    [InlineData(RequestStatus.Completed)]
    [InlineData(RequestStatus.PendingPayment)]
#pragma warning restore CS0618
    public void LegacyStatuses_ShouldBeObsolete(RequestStatus status)
    {
        var memberInfo = typeof(RequestStatus).GetMember(status.ToString()).FirstOrDefault();
        var isObsolete = memberInfo?.GetCustomAttributes(typeof(ObsoleteAttribute), false).Any() ?? false;
        isObsolete.Should().BeTrue($"status legado {status} deve estar marcado como [Obsolete]");
    }
}
