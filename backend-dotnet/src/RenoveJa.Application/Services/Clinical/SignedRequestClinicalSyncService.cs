using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Domain.ValueObjects;

namespace RenoveJa.Application.Services.Clinical;

public class SignedRequestClinicalSyncService(
    IUserRepository userRepository,
    IPatientRepository patientRepository,
    IEncounterRepository encounterRepository,
    IMedicalDocumentRepository medicalDocumentRepository,
    IAuditService auditService,
    ILogger<SignedRequestClinicalSyncService> logger) : ISignedRequestClinicalSyncService
{
    public async Task SyncSignedRequestAsync(
        MedicalRequest request,
        string signedDocumentUrl,
        string signatureId,
        DateTime signedAt,
        Guid certificateId,
        string? certificateSubject,
        CancellationToken cancellationToken = default)
    {
        if (request.RequestType != RequestType.Prescription && request.RequestType != RequestType.Exam)
            return;

        if (!request.DoctorId.HasValue)
            return;

        try
        {
            var patient = await patientRepository.GetByUserIdAsync(request.PatientId, cancellationToken);
            if (patient == null)
            {
                var user = await userRepository.GetByIdAsync(request.PatientId, cancellationToken);
                if (user == null) return;

                patient = Patient.CreateFromUser(
                    user.Id,
                    user.Name,
                    user.Cpf ?? "00000000000",
                    user.BirthDate,
                    user.Gender,
                    null,
                    user.Phone?.Value,
                    user.Email,
                    user.Address ?? user.Street,
                    user.City,
                    user.State,
                    user.PostalCode);

                try
                {
                    patient = await patientRepository.CreateAsync(patient, cancellationToken);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Falha ao criar Patient para sync: userId {UserId}", request.PatientId);
                    return;
                }
            }

            var encounterType = request.RequestType == RequestType.Prescription
                ? EncounterType.PrescriptionRenewal
                : EncounterType.ExamOrder;

            var encounter = Encounter.Start(
                patient.Id,
                request.DoctorId.Value,
                encounterType,
                channel: "api",
                reason: request.Symptoms);

            encounter.UpdateClinicalNotes(anamnesis: null, physicalExam: null, plan: request.Notes, mainIcd10Code: null);
            encounter.FinalizeEncounter(signedAt);

            encounter = await encounterRepository.CreateAsync(encounter, cancellationToken);

            MedicalDocument doc;
            if (request.RequestType == RequestType.Prescription)
            {
                var medications = request.Medications?.Where(m => !string.IsNullOrWhiteSpace(m)).ToList() ?? new List<string>();
                if (medications.Count == 0) return;

                var prescription = Prescription.Create(patient.Id, request.DoctorId.Value, encounter.Id, request.Notes);
                foreach (var med in medications)
                    prescription.AddItem(med.Trim(), null, null, null, null, null, null);

                doc = prescription;
            }
            else
            {
                var exams = request.Exams?.Where(e => !string.IsNullOrWhiteSpace(e)).ToList() ?? new List<string>();
                if (exams.Count == 0) exams = new List<string> { "Exames conforme solicitação" };

                var order = ExamOrder.Create(patient.Id, request.DoctorId.Value, encounter.Id, request.Symptoms, null);
                foreach (var e in exams)
                    order.AddItem("exam", null, e.Trim());

                doc = order;
            }

            doc = await medicalDocumentRepository.CreateAsync(doc, cancellationToken);

            var documentHash = ComputeSha256(signedDocumentUrl + signatureId);
            var sig = SignatureInfo.Create(
                documentHash,
                "SHA-256",
                certificateSubject ?? certificateId.ToString(),
                signedAt,
                true,
                "Assinado via ICP-Brasil",
                null);

            doc.ApplySignature(sig);
            await medicalDocumentRepository.UpdateAsync(doc, cancellationToken);

            await auditService.LogModificationAsync(
                request.DoctorId,
                "Sign",
                "MedicalDocument",
                doc.Id,
                cancellationToken: cancellationToken);

            logger.LogInformation(
                "Sync request {RequestId} -> Encounter {EncounterId}, Document {DocumentId}",
                request.Id, encounter.Id, doc.Id);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Falha ao sincronizar request {RequestId} para modelo clínico (não bloqueia assinatura)", request.Id);
        }
    }

    private static string ComputeSha256(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
