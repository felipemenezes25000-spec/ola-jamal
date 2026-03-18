using System.ComponentModel;

namespace RenoveJa.Domain.Enums;

/// <summary>
/// Status canônicos de uma solicitação médica (MedicalRequest).
///
/// State machine por tipo:
///
/// prescription / exam:
///   Submitted → InReview → ApprovedPendingPayment → Paid → Signed → Delivered
///   Qualquer estado → Rejected | Cancelled
///
/// consultation:
///   Submitted → SearchingDoctor → ApprovedPendingPayment → Paid → InConsultation → PendingPostConsultation → ConsultationFinished
///   Qualquer estado → Rejected | Cancelled
///
/// Status marcados com [Obsolete] + [EditorBrowsable(Never)] são legados:
///   - Não devem ser usados em novas transições de estado.
///   - Mantidos exclusivamente para parsing de registros históricos vindos do banco.
///   - Somem do autocomplete do IDE (EditorBrowsable.Never).
///   - Geram warning CS0618 em qualquer uso, exceto onde suprimido com #pragma intencional.
///   - MedicalRequest.UpdateStatus() rejeita legados em runtime via RequestStatusExtensions.IsLegacy().
/// </summary>
public enum RequestStatus
{
    // ── Canônicos comuns ──────────────────────────────────────
    /// <summary>Criada pelo paciente; aguardando médico.</summary>
    Submitted,

    /// <summary>Médico assumiu e está revisando (prescription/exam).</summary>
    InReview,

    /// <summary>Aprovada pelo médico; aguardando pagamento do paciente.</summary>
    ApprovedPendingPayment,

    /// <summary>Pagamento confirmado; aguardando assinatura do médico.</summary>
    Paid,

    /// <summary>PDF assinado digitalmente e disponível para download.</summary>
    Signed,

    /// <summary>Receita/exame entregue ao paciente (estado final de sucesso).</summary>
    Delivered,

    /// <summary>Rejeitada pelo médico.</summary>
    Rejected,

    /// <summary>Cancelada (paciente ou sistema).</summary>
    Cancelled,

    // ── Canônicos: consultation ───────────────────────────────
    /// <summary>Aguardando médico disponível aceitar a consulta.</summary>
    SearchingDoctor,

    /// <summary>[Semi-legado] Médico aceitou sem pagamento prévio. Novo fluxo: ApprovedPendingPayment → Paid.
    /// Ainda aceito como origem de transição em Approve() para compatibilidade.</summary>
    ConsultationReady,

    /// <summary>Consulta por vídeo em andamento.</summary>
    InConsultation,

    /// <summary>Chamada encerrada; aguardando emissão de pelo menos um documento para finalizar a consulta.</summary>
    PendingPostConsultation,

    /// <summary>Consulta encerrada (estado final de sucesso para consultation). Só após emitir pelo menos um documento.</summary>
    ConsultationFinished,

    // ── Legados (não usar em novas transições) ────────────────
    // EditorBrowsable.Never: some do autocomplete do IDE.
    // Obsolete: gera warning CS0618 em qualquer uso novo.
    // IsLegacy(): permite rejeição em runtime (ver RequestStatusExtensions).

    /// <summary>Use <see cref="Submitted"/> para novas solicitações.</summary>
    [Obsolete("Status legado. Use Submitted para novos requests.")]
    [EditorBrowsable(EditorBrowsableState.Never)]
    Pending,

    /// <summary>Use <see cref="InReview"/> para novas solicitações.</summary>
    [Obsolete("Status legado. Use InReview para novas transições.")]
    [EditorBrowsable(EditorBrowsableState.Never)]
    Analyzing,

    /// <summary>Use <see cref="ApprovedPendingPayment"/> para novas solicitações.</summary>
    [Obsolete("Status legado. Use ApprovedPendingPayment para novas transições.")]
    [EditorBrowsable(EditorBrowsableState.Never)]
    Approved,

    /// <summary>Use <see cref="ConsultationFinished"/> ou <see cref="Delivered"/> para novas solicitações.</summary>
    [Obsolete("Status legado. Use ConsultationFinished ou Delivered para novas transições.")]
    [EditorBrowsable(EditorBrowsableState.Never)]
    Completed,

    /// <summary>Use <see cref="ApprovedPendingPayment"/> para novas solicitações.</summary>
    [Obsolete("Status legado. Use ApprovedPendingPayment para novas transições.")]
    [EditorBrowsable(EditorBrowsableState.Never)]
    PendingPayment,
}

/// <summary>
/// Extensões de verificação de legado para <see cref="RequestStatus"/>.
/// Fonte única de verdade: atualizar <see cref="_legacy"/> sempre que um status
/// for marcado ou desmarcado como <see cref="ObsoleteAttribute"/>.
/// </summary>
public static class RequestStatusExtensions
{
#pragma warning disable CS0618 // Referência intencional — este é o ponto de registro dos legados
    private static readonly HashSet<RequestStatus> _legacy = new()
    {
        RequestStatus.Pending,
        RequestStatus.Analyzing,
        RequestStatus.Approved,
        RequestStatus.Completed,
        RequestStatus.PendingPayment,
    };
#pragma warning restore CS0618

    /// <summary>
    /// Retorna <c>true</c> se o status for legado.
    /// Status legados são mantidos apenas para parsing de dados históricos do banco;
    /// novas transições de estado NUNCA devem usá-los.
    /// </summary>
    public static bool IsLegacy(this RequestStatus status) => _legacy.Contains(status);
}
