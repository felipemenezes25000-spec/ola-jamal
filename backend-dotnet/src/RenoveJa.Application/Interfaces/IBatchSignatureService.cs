namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Assinatura em lote: revisar → aprovar → acumular → assinar.
/// </summary>
public interface IBatchSignatureService
{
    Task<bool> MarkAsReviewedAsync(Guid doctorUserId, Guid requestId, CancellationToken ct);
    Task<(bool success, string? error)> ApproveForSigningAsync(Guid doctorUserId, Guid requestId, CancellationToken ct);
    Task<List<Guid>> GetApprovedRequestIdsAsync(Guid doctorUserId, CancellationToken ct);
    Task<BatchSignatureResult> SignBatchAsync(Guid doctorUserId, List<Guid> requestIds, string? pfxPassword, CancellationToken ct);
}

public record BatchSignatureResult(
    int SignedCount, int FailedCount,
    List<BatchSignatureItemResult> Items,
    string Message);

public record BatchSignatureItemResult(
    Guid RequestId, bool Success, string? Error);
