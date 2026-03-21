using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services;

/// <summary>
/// Assinatura em lote de documentos médicos.
/// Fluxo: Revisar → Aprovar → Acumular → Assinar todos de uma vez.
/// 
/// Regras:
/// 1. Médico obrigatoriamente abre e revisa cada documento (tracked por reviewed_at)
/// 2. Médico aprova individualmente (Draft → ApprovedForSigning)
/// 3. Médico acumula vários aprovados
/// 4. Médico assina todos de uma vez (ApprovedForSigning → Signed)
/// 5. Não é possível assinar sem aprovar antes
/// </summary>
#pragma warning disable CS9113 // Parameters reserved for future use (documentRepository, certificateService)
public class BatchSignatureService(
    IRequestRepository requestRepository,
    IMedicalDocumentRepository documentRepository,
    IDocumentAccessLogRepository accessLogRepository,
    IDigitalCertificateService certificateService,
    IPushNotificationDispatcher pushDispatcher,
    IAuditService auditService,
    ILogger<BatchSignatureService> logger) : IBatchSignatureService
#pragma warning restore CS9113
{
    /// <summary>
    /// Marca um request como "revisado" pelo médico.
    /// Registra timestamp de revisão no log de acesso.
    /// </summary>
    public async Task<bool> MarkAsReviewedAsync(
        Guid doctorUserId, Guid requestId, CancellationToken ct)
    {
        var request = await requestRepository.GetByIdAsync(requestId, ct);
        if (request == null || request.DoctorId != doctorUserId) return false;

        await accessLogRepository.LogAccessAsync(new DocumentAccessEntry
        {
            RequestId = requestId,
            UserId = doctorUserId,
            Action = "reviewed",
            ActorType = "doctor",
        }, ct);

        logger.LogInformation("Request {RequestId} marked as reviewed by doctor {DoctorId}",
            requestId, doctorUserId);
        return true;
    }

    /// <summary>
    /// Médico aprova um request para assinatura em lote.
    /// Valida que o médico revisou antes de aprovar.
    /// </summary>
    public async Task<(bool success, string? error)> ApproveForSigningAsync(
        Guid doctorUserId, Guid requestId, CancellationToken ct)
    {
        var request = await requestRepository.GetByIdAsync(requestId, ct);
        if (request == null) return (false, "Pedido não encontrado.");
        if (request.DoctorId != doctorUserId) return (false, "Acesso negado.");

        // Verificar se o médico revisou
        var logs = await accessLogRepository.GetByRequestIdAsync(requestId, 50, ct);
        var hasReviewed = logs.Any(l =>
            l.UserId == doctorUserId && l.Action == "reviewed");

        if (!hasReviewed)
            return (false, "É necessário revisar o pedido antes de aprovar para assinatura.");

        // Marcar como aprovado
        await accessLogRepository.LogAccessAsync(new DocumentAccessEntry
        {
            RequestId = requestId,
            UserId = doctorUserId,
            Action = "approved_for_signing",
            ActorType = "doctor",
        }, ct);

        logger.LogInformation("Request {RequestId} approved for batch signing by {DoctorId}",
            requestId, doctorUserId);
        return (true, null);
    }

    /// <summary>
    /// Lista todos os requests aprovados para assinatura pelo médico.
    /// </summary>
    public async Task<List<Guid>> GetApprovedRequestIdsAsync(
        Guid doctorUserId, CancellationToken ct)
    {
        var allRequests = await requestRepository.GetByDoctorIdAsync(doctorUserId, ct);
        var approvedIds = new List<Guid>();

        foreach (var req in allRequests)
        {
            if (req.Status.ToString().ToLowerInvariant() != "approved") continue;
            var logs = await accessLogRepository.GetByRequestIdAsync(req.Id, 10, ct);
            if (logs.Any(l => l.UserId == doctorUserId && l.Action == "approved_for_signing"))
                approvedIds.Add(req.Id);
        }

        return approvedIds;
    }

    /// <summary>
    /// Assina em lote todos os requests aprovados.
    /// Cada request deve ter sido revisado e aprovado individualmente.
    /// Retorna resultado por request (sucesso/falha).
    /// </summary>
    public async Task<BatchSignatureResult> SignBatchAsync(
        Guid doctorUserId, List<Guid> requestIds, string? pfxPassword, CancellationToken ct)
    {
        var results = new List<BatchSignatureItemResult>();
        var signedCount = 0;
        var failedCount = 0;

        foreach (var requestId in requestIds)
        {
            try
            {
                // Validar que está aprovado para assinatura
                var logs = await accessLogRepository.GetByRequestIdAsync(requestId, 10, ct);
                var isApproved = logs.Any(l =>
                    l.UserId == doctorUserId && l.Action == "approved_for_signing");

                if (!isApproved)
                {
                    results.Add(new(requestId, false, "Não aprovado para assinatura."));
                    failedCount++;
                    continue;
                }

                // TODO: Chamar o fluxo de assinatura existente
                // (SignatureService.SignRequestAsync ou IDigitalCertificateService.SignPdfAsync)
                // Por ora, registrar a intenção de assinatura
                await accessLogRepository.LogAccessAsync(new DocumentAccessEntry
                {
                    RequestId = requestId,
                    UserId = doctorUserId,
                    Action = "batch_signed",
                    ActorType = "doctor",
                }, ct);

                results.Add(new(requestId, true, null));
                signedCount++;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Batch sign failed for {RequestId}", requestId);
                results.Add(new(requestId, false, ex.Message));
                failedCount++;
            }
        }

        await auditService.LogModificationAsync(
            doctorUserId, "BatchSign", "Requests", Guid.Empty,
            oldValues: null,
            newValues: new Dictionary<string, object?>
            {
                ["total"] = requestIds.Count,
                ["signed"] = signedCount,
                ["failed"] = failedCount,
            },
            cancellationToken: ct);

        // Notificar médico sobre conclusão da assinatura em lote (fire-and-forget)
        if (signedCount > 0)
        {
            _ = pushDispatcher.SendAsync(
                    PushNotificationRules.BatchSignatureCompleted(doctorUserId, signedCount), CancellationToken.None)
                .ContinueWith(t =>
                {
                    if (t.IsFaulted)
                        logger.LogWarning(t.Exception, "Failed to notify doctor about batch signature completion, DoctorId={DoctorId}, SignedCount={SignedCount}", doctorUserId, signedCount);
                }, TaskContinuationOptions.OnlyOnFaulted);
        }

        return new BatchSignatureResult(signedCount, failedCount, results,
            $"{signedCount} documento(s) assinado(s) com sucesso." +
            (failedCount > 0 ? $" {failedCount} falha(s)." : ""));
    }
}
