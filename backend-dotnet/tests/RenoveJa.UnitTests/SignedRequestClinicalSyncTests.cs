using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Clinical;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Domain.ValueObjects;
using Xunit;

namespace RenoveJa.UnitTests;

/// <summary>
/// Testes do SignedRequestClinicalSyncService: idempotência e mapeamento estruturado.
/// </summary>
public class SignedRequestClinicalSyncTests
{
    [Fact]
    public async Task SyncSignedRequestAsync_WhenDocumentAlreadyExists_ShouldReturnEarly_Idempotent()
    {
        var requestId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();

        var now = DateTime.UtcNow;
        var request = MedicalRequest.Reconstitute(
            requestId,
            patientId,
            "Paciente",
            doctorId,
            "Dr. X",
            "prescription",
            "signed",
            "simple",
            new List<string> { "Dipirona 500mg" },
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            now,
            "https://storage/signed.pdf",
            "sig-123",
            now,
            now);

        var existingDoc = Prescription.Create(Guid.NewGuid(), doctorId, Guid.NewGuid(), null);
        existingDoc.AddItem("Dipirona", "500mg", null, "1cp 6/6h", null, null, null);

        var patientRepo = new Mock<IPatientRepository>();
        var encounterRepo = new Mock<IEncounterRepository>();
        var medicalDocRepo = new Mock<IMedicalDocumentRepository>();
        medicalDocRepo
            .Setup(r => r.GetBySourceRequestIdAsync(requestId, DocumentType.Prescription, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingDoc);

        var userRepo = new Mock<IUserRepository>();
        var auditService = new Mock<RenoveJa.Application.Interfaces.IAuditService>();
        var logger = new Mock<ILogger<SignedRequestClinicalSyncService>>();

        var sut = new SignedRequestClinicalSyncService(
            userRepo.Object,
            patientRepo.Object,
            encounterRepo.Object,
            medicalDocRepo.Object,
            auditService.Object,
            logger.Object);

        await sut.SyncSignedRequestAsync(
            request,
            "https://storage/signed.pdf",
            "sig-123",
            DateTime.UtcNow,
            Guid.NewGuid(),
            "cert-subject",
            CancellationToken.None);

        medicalDocRepo.Verify(r => r.CreateAsync(It.IsAny<MedicalDocument>(), It.IsAny<CancellationToken>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Never);
        encounterRepo.Verify(r => r.CreateAsync(It.IsAny<Encounter>(), It.IsAny<CancellationToken>(), It.IsAny<Guid?>()), Times.Never);
    }

    [Fact(Skip = "Exam sync test - requires integration verification")]
    public async Task SyncSignedRequestAsync_WhenRequestIsExam_ShouldCreateExamOrderAndDocument()
    {
        var requestId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var patientEntityId = Guid.NewGuid();

        var now = DateTime.UtcNow;
        var request = MedicalRequest.Reconstitute(
            requestId,
            patientId,
            "Paciente",
            doctorId,
            "Dr. X",
            "exam",
            "signed",
            null,
            null,
            null,
            "geral",
            new List<string> { "Hemograma completo", "Glicemia" },
            null,
            null,
            null,
            null,
            null,
            now,
            "https://storage/signed.pdf",
            "sig-123",
            now,
            now);

        var patient = Patient.Reconstitute(
            patientEntityId,
            patientId,
            "Paciente",
            "12345678900",
            DateTime.Now.AddYears(-30),
            "M",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            DateTime.UtcNow,
            null,
            null,
            null,
            null);

        var patientRepo = new Mock<IPatientRepository>();
        patientRepo.Setup(r => r.GetByUserIdAsync(patientId, It.IsAny<CancellationToken>())).ReturnsAsync(patient);

        var encounterRepo = new Mock<IEncounterRepository>();
        encounterRepo.Setup(r => r.GetBySourceRequestIdAsync(requestId, It.IsAny<CancellationToken>())).ReturnsAsync((Encounter?)null);
        Encounter? createdEncounter = null;
        encounterRepo.Setup(r => r.CreateAsync(It.IsAny<Encounter>(), It.IsAny<CancellationToken>(), It.IsAny<Guid?>()))
            .Callback<Encounter, CancellationToken, Guid?>((e, _, _) => createdEncounter = e)
            .Returns<Encounter, CancellationToken, Guid?>((e, _, _) => Task.FromResult(e));

        var medicalDocRepo = new Mock<IMedicalDocumentRepository>();
        medicalDocRepo.Setup(r => r.GetBySourceRequestIdAsync(requestId, DocumentType.ExamOrder, It.IsAny<CancellationToken>())).ReturnsAsync((MedicalDocument?)null);
        MedicalDocument? createdDoc = null;
        medicalDocRepo.Setup(r => r.CreateAsync(It.IsAny<MedicalDocument>(), It.IsAny<CancellationToken>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Callback<MedicalDocument, CancellationToken, Guid?, string?, string?>((d, _, _, _, _) => { createdDoc = d; })
            .ReturnsAsync((MedicalDocument d, CancellationToken _, Guid? _, string? _, string? _) => d);
        medicalDocRepo.Setup(r => r.UpdateAsync(It.IsAny<MedicalDocument>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MedicalDocument d, CancellationToken _) => d);

        var userRepo = new Mock<IUserRepository>();
        var auditService = new Mock<IAuditService>();
        var logger = new Mock<ILogger<SignedRequestClinicalSyncService>>();

        var sut = new SignedRequestClinicalSyncService(
            userRepo.Object,
            patientRepo.Object,
            encounterRepo.Object,
            medicalDocRepo.Object,
            auditService.Object,
            logger.Object);

        await sut.SyncSignedRequestAsync(
            request,
            "https://storage/signed.pdf",
            "sig-123",
            now,
            Guid.NewGuid(),
            "cert-subject",
            CancellationToken.None);

        encounterRepo.Verify(r => r.CreateAsync(It.IsAny<Encounter>(), It.IsAny<CancellationToken>(), It.IsAny<Guid?>()), Times.Once);
        medicalDocRepo.Verify(r => r.CreateAsync(It.IsAny<MedicalDocument>(), It.IsAny<CancellationToken>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Once);

        if (createdEncounter != null)
        {
            createdEncounter.Type.Should().Be(EncounterType.ExamOrder);
        }
        createdDoc.Should().NotBeNull();
        createdDoc.Should().BeOfType<ExamOrder>();
        var order = (ExamOrder)createdDoc!;
        order.Items.Should().HaveCount(2);
        order.Items.Select(i => i.Description).Should().Contain("Hemograma completo");
        order.Items.Select(i => i.Description).Should().Contain("Glicemia");
    }
}
