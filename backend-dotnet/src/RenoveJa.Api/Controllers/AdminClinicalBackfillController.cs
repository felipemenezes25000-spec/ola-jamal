using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Endpoints administrativos para backfill do modelo clínico.
/// Sincroniza requests assinados antigos para encounters/documents.
/// </summary>
[ApiController]
[Route("api/admin/clinical-backfill")]
[Authorize(Roles = "admin")]
public class AdminClinicalBackfillController(
    IRequestRepository requestRepository,
    IMedicalDocumentRepository medicalDocumentRepository,
    ISignedRequestClinicalSyncService signedRequestClinicalSync,
    ICertificateRepository certificateRepository,
    IDoctorRepository doctorRepository,
    ILogger<AdminClinicalBackfillController> logger) : ControllerBase
{
    /// <summary>
    /// Executa backfill: sincroniza requests assinados (receita/exame) que ainda não têm documento clínico.
    /// Idempotente: não duplica se já existir.
    /// </summary>
    [HttpPost("signed-requests")]
    public async Task<IActionResult> BackfillSignedRequests(
        [FromQuery] int? limit = null,
        CancellationToken cancellationToken = default)
    {
        var signed = await requestRepository.GetByStatusAsync(RequestStatus.Signed, cancellationToken);
        var toSync = signed
            .Where(r => r.RequestType == RequestType.Prescription || r.RequestType == RequestType.Exam)
            .Where(r => r.DoctorId.HasValue)
            .Where(r => !string.IsNullOrWhiteSpace(r.SignedDocumentUrl) && !string.IsNullOrWhiteSpace(r.SignatureId))
            .Where(r => r.SignedAt.HasValue)
            .ToList();

        if (limit.HasValue && limit.Value > 0)
            toSync = toSync.Take(limit.Value).ToList();

        var synced = 0;
        var skipped = 0;
        var failed = 0;

        foreach (var request in toSync)
        {
            try
            {
                var docType = request.RequestType == RequestType.Prescription
                    ? DocumentType.Prescription
                    : DocumentType.ExamOrder;

                var existing = await medicalDocumentRepository.GetBySourceRequestIdAsync(
                    request.Id, docType, cancellationToken);

                if (existing != null)
                {
                    skipped++;
                    continue;
                }

                var (certId, certSubject) = await GetCertificateForRequestAsync(request.DoctorId!.Value, cancellationToken);

                await signedRequestClinicalSync.SyncSignedRequestAsync(
                    request,
                    request.SignedDocumentUrl!,
                    request.SignatureId!,
                    request.SignedAt!.Value,
                    certId,
                    certSubject,
                    cancellationToken);

                synced++;
            }
            catch (Exception ex)
            {
                failed++;
                logger.LogWarning(ex, "Backfill falhou para request {RequestId}", request.Id);
            }
        }

        return Ok(new
        {
            totalSigned = toSync.Count,
            synced,
            skipped,
            failed,
            message = $"Backfill concluído: {synced} sincronizados, {skipped} já existiam, {failed} falharam."
        });
    }

    /// <summary>
    /// Lista requests assinados que ainda não têm documento clínico (dry-run).
    /// </summary>
    [HttpGet("signed-requests-pending")]
    public async Task<IActionResult> GetPendingBackfill(CancellationToken cancellationToken = default)
    {
        var signed = await requestRepository.GetByStatusAsync(RequestStatus.Signed, cancellationToken);
        var pending = new List<object>();

        foreach (var r in signed.Where(x =>
            (x.RequestType == RequestType.Prescription || x.RequestType == RequestType.Exam)
            && x.DoctorId.HasValue
            && !string.IsNullOrWhiteSpace(x.SignedDocumentUrl)
            && !string.IsNullOrWhiteSpace(x.SignatureId)
            && x.SignedAt.HasValue))
        {
            var docType = r.RequestType == RequestType.Prescription ? DocumentType.Prescription : DocumentType.ExamOrder;
            var existing = await medicalDocumentRepository.GetBySourceRequestIdAsync(r.Id, docType, cancellationToken);
            if (existing == null)
                pending.Add(new { r.Id, r.RequestType, r.CreatedAt, r.SignedAt });
        }

        return Ok(new { count = pending.Count, items = pending });
    }

    private async Task<(Guid certId, string? certSubject)> GetCertificateForRequestAsync(
        Guid doctorUserId,
        CancellationToken cancellationToken)
    {
        var doctor = await doctorRepository.GetByUserIdAsync(doctorUserId, cancellationToken);
        if (doctor?.ActiveCertificateId == null)
            return (Guid.Empty, "Backfill");

        var cert = await certificateRepository.GetByIdAsync(doctor.ActiveCertificateId.Value, cancellationToken);
        return (doctor.ActiveCertificateId.Value, cert?.SubjectName ?? "Backfill");
    }
}
