using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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

        var docType = request.RequestType == RequestType.Prescription ? DocumentType.Prescription : DocumentType.ExamOrder;

        try
        {
            var existingDoc = await medicalDocumentRepository.GetBySourceRequestIdAsync(request.Id, docType, cancellationToken);
            if (existingDoc != null)
            {
                logger.LogInformation("Sync idempotente: documento clínico já existe para request {RequestId}", request.Id);
                return;
            }

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

            var existingEncounter = await encounterRepository.GetBySourceRequestIdAsync(request.Id, cancellationToken);
            Encounter encounter;
            if (existingEncounter != null)
            {
                encounter = existingEncounter;
            }
            else
            {
                encounter = Encounter.Start(
                    patient.Id,
                    request.DoctorId.Value,
                    encounterType,
                    channel: "api",
                    reason: request.Symptoms);

                encounter.UpdateClinicalNotes(anamnesis: null, physicalExam: null, plan: request.Notes, mainIcd10Code: null);
                encounter.FinalizeEncounter(signedAt);

                encounter = await encounterRepository.CreateAsync(encounter, cancellationToken, request.Id);
            }

            MedicalDocument doc;
            if (request.RequestType == RequestType.Prescription)
            {
                var items = ParseStructuredMedications(request);
                if (items.Count == 0) return;

                var prescription = Prescription.Create(patient.Id, request.DoctorId.Value, encounter.Id, request.Notes);
                foreach (var (drug, posology, duration, notes) in items)
                    prescription.AddItem(drug, null, null, posology, duration, null, notes);

                doc = await medicalDocumentRepository.CreateAsync(
                    prescription,
                    cancellationToken,
                    sourceRequestId: request.Id,
                    signedDocumentUrl,
                    signatureId);
            }
            else
            {
                var exams = request.Exams?.Where(e => !string.IsNullOrWhiteSpace(e)).ToList() ?? new List<string>();
                if (exams.Count == 0) exams = new List<string> { "Exames conforme solicitação" };

                var order = ExamOrder.Create(patient.Id, request.DoctorId.Value, encounter.Id, request.Symptoms, null);
                foreach (var e in exams)
                    order.AddItem("exam", null, e.Trim());

                doc = await medicalDocumentRepository.CreateAsync(
                    order,
                    cancellationToken,
                    sourceRequestId: request.Id,
                    signedDocumentUrl,
                    signatureId);
            }

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
                "Sync request {RequestId} -> Encounter {EncounterId}, Document {DocumentId} (source_request_id)",
                request.Id, encounter.Id, doc.Id);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Falha ao sincronizar request {RequestId} para modelo clínico (não bloqueia assinatura)", request.Id);
        }
    }

    /// <summary>Extrai medicamentos estruturados (drug, posology, duration, notes) de Medications e/ou AiExtractedJson.</summary>
    private static List<(string drug, string? posology, string? duration, string? notes)> ParseStructuredMedications(MedicalRequest request)
    {
        var result = new List<(string drug, string? posology, string? duration, string? notes)>();

        var structuredFromAi = TryParseStructuredFromAiJson(request.AiExtractedJson);
        if (structuredFromAi.Count > 0)
        {
            result.AddRange(structuredFromAi);
        }

        var meds = request.Medications?.Where(m => !string.IsNullOrWhiteSpace(m)).ToList() ?? new List<string>();
        if (result.Count == 0 && meds.Count > 0)
        {
            foreach (var m in meds)
            {
                var (drug, posology, duration, notes) = ParseMedicationString(m.Trim());
                result.Add((drug, posology, duration, notes));
            }
        }

        return result;
    }

    private static List<(string drug, string? posology, string? duration, string? notes)> TryParseStructuredFromAiJson(string? aiExtractedJson)
    {
        var result = new List<(string drug, string? posology, string? duration, string? notes)>();
        if (string.IsNullOrWhiteSpace(aiExtractedJson)) return result;

        try
        {
            using var doc = JsonDocument.Parse(aiExtractedJson);
            var root = doc.RootElement;
            if (!root.TryGetProperty("medications", out var meds) || meds.ValueKind != JsonValueKind.Array)
                return result;

            foreach (var m in meds.EnumerateArray())
            {
                if (m.ValueKind == JsonValueKind.String)
                {
                    var s = m.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(s))
                    {
                        var parsed = ParseMedicationString(s);
                        result.Add(parsed);
                    }
                }
                else if (m.ValueKind == JsonValueKind.Object)
                {
                    var drug = GetJsonString(m, "drug") ?? GetJsonString(m, "name") ?? GetJsonString(m, "medication");
                    if (string.IsNullOrEmpty(drug)) continue;

                    var posology = GetJsonString(m, "posology") ?? GetJsonString(m, "dosage");
                    var duration = GetJsonString(m, "duration");
                    var notes = GetJsonString(m, "notes");

                    result.Add((drug, posology, duration, notes));
                }
            }
        }
        catch { /* ignore */ }

        return result;
    }

    private static string? GetJsonString(JsonElement el, string prop)
    {
        if (el.TryGetProperty(prop, out var p))
        {
            var s = p.GetString()?.Trim();
            if (!string.IsNullOrEmpty(s)) return s;
        }
        return null;
    }

    private static (string drug, string? posology, string? duration, string? notes) ParseMedicationString(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return ("", null, null, null);

        var parts = s.Split(new[] { " - ", " | ", ";" }, 2, StringSplitOptions.None);
        var drug = parts[0].Trim();
        var rest = parts.Length > 1 ? parts[1].Trim() : null;

        string? posology = null;
        string? duration = null;
        string? notes = null;

        if (!string.IsNullOrEmpty(rest))
        {
            var subParts = rest.Split(new[] { ", ", ";" }, StringSplitOptions.RemoveEmptyEntries);
            if (subParts.Length >= 1) posology = subParts[0].Trim();
            if (subParts.Length >= 2) duration = subParts[1].Trim();
            if (subParts.Length >= 3) notes = string.Join(", ", subParts.Skip(2)).Trim();
        }

        return (drug, posology, duration, notes);
    }

    private static string ComputeSha256(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
