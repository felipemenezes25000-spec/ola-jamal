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
///   Submitted → SearchingDoctor → ConsultationReady → InConsultation → ConsultationFinished
///   Qualquer estado → Rejected | Cancelled
///
/// Status marcados com [Obsolete] são legados e não devem ser usados em novas transições.
/// Mantidos apenas para parsing de dados históricos existentes no banco.
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

    /// <summary>Médico aceitou; sala de vídeo pronta para o paciente entrar.</summary>
    ConsultationReady,

    /// <summary>Consulta por vídeo em andamento.</summary>
    InConsultation,

    /// <summary>Consulta encerrada (estado final de sucesso para consultation).</summary>
    ConsultationFinished,

    // ── Legados (não usar em novas transições) ────────────────
    /// <summary>Use <see cref="Submitted"/> para novas solicitações.</summary>
    [Obsolete("Status legado. Use Submitted para novos requests.")]
    Pending,

    /// <summary>Use <see cref="InReview"/> para novas solicitações.</summary>
    [Obsolete("Status legado. Use InReview para novas transições.")]
    Analyzing,

    /// <summary>Use <see cref="ApprovedPendingPayment"/> para novas solicitações.</summary>
    [Obsolete("Status legado. Use ApprovedPendingPayment para novas transições.")]
    Approved,

    /// <summary>Use <see cref="ConsultationFinished"/> ou <see cref="Delivered"/> para novas solicitações.</summary>
    [Obsolete("Status legado. Use ConsultationFinished ou Delivered para novas transições.")]
    Completed,

    /// <summary>Use <see cref="ApprovedPendingPayment"/> para novas solicitações.</summary>
    [Obsolete("Status legado. Use ApprovedPendingPayment para novas transições.")]
    PendingPayment,
}
