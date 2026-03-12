// ============================================================================
// FILE: backend-dotnet/src/RenoveJa.Application/Services/Notifications/PushNotificationRules.cs
// CHANGES:
//   1. BuildRequest now accepts targetRole parameter
//   2. All patient notifications pass targetRole: "patient"
//   3. All doctor notifications pass targetRole: "doctor"
//   4. TargetRole is included in the PushNotificationPayload
// ============================================================================

using RenoveJa.Application.DTOs.Notifications;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Application.Services.Notifications;

/// <summary>
/// Regras de push conforme spec — mapeia eventos para título, corpo, canal, prioridade e deep link.
/// Cada notificação inclui targetRole para permitir filtragem no frontend.
/// </summary>
public static class PushNotificationRules
{
    private static PushNotificationRequest BuildRequest(
        Guid userId,
        string eventType,
        Guid requestId,
        RequestType requestType,
        RequestStatus status,
        string title,
        string body,
        string targetRole,
        string? deepLinkSuffix = null,
        PushChannel channel = PushChannel.Default,
        bool highPriority = true,
        PushCategory? category = null,
        IReadOnlyDictionary<string, object?>? extra = null,
        bool bypassQuietHours = false,
        string? collapseKeySuffix = null)
    {
        var reqIdStr = requestId.ToString();
        var reqType = requestType.ToString().ToLowerInvariant();
        var statusStr = status.ToString();
        var userIdShort = userId.ToString("N")[..8];
        var collapseKey = string.IsNullOrEmpty(collapseKeySuffix)
            ? $"req_{reqIdStr}_{statusStr}_{userIdShort}".Replace(" ", "_")
            : $"req_{reqIdStr}_{collapseKeySuffix}_{userIdShort}";
        var deepLink = string.IsNullOrEmpty(deepLinkSuffix)
            ? $"renoveja://request-detail/{reqIdStr}"
            : deepLinkSuffix.StartsWith("renoveja://") ? deepLinkSuffix : $"renoveja://{deepLinkSuffix}";

        var cat = category ?? (status switch
        {
            RequestStatus.ApprovedPendingPayment or RequestStatus.Paid => PushCategory.Payments,
            RequestStatus.InConsultation or RequestStatus.SearchingDoctor => PushCategory.Consultations,
            _ => PushCategory.Requests
        });

        var payload = new PushNotificationPayload(
            eventType,
            deepLink,
            cat,
            collapseKey,
            DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            RequestId: reqIdStr,
            RequestType: reqType,
            Status: statusStr,
            TargetRole: targetRole,
            Extra: extra);

        return new PushNotificationRequest(userId, title, body, payload, channel, highPriority, bypassQuietHours);
    }

    // ── Paciente: Pedidos ─────────────────────────────────────────────────

    public static PushNotificationRequest Submitted(Guid userId, Guid requestId, RequestType requestType) =>
        BuildRequest(userId, "request_status_changed", requestId, requestType, RequestStatus.Submitted,
            "Pedido enviado ✅",
            "Recebemos sua solicitação. Um profissional vai analisar em breve.",
            targetRole: "patient",
            channel: PushChannel.Quiet, highPriority: false);

    public static PushNotificationRequest InReview(Guid userId, Guid requestId, RequestType requestType) =>
        BuildRequest(userId, "request_status_changed", requestId, requestType, RequestStatus.InReview,
            "Seu pedido está em análise",
            "Um profissional já está revisando sua solicitação.",
            targetRole: "patient",
            channel: PushChannel.Quiet, highPriority: false);

    public static PushNotificationRequest NeedMoreInfo(Guid userId, Guid requestId, RequestType requestType, string? focus = null) =>
        BuildRequest(userId, "request_status_changed", requestId, requestType, RequestStatus.InReview,
            "Precisamos de um detalhe",
            "Toque para completar seu pedido e evitar atraso.",
            targetRole: "patient",
            deepLinkSuffix: $"request-detail/{requestId}?focus=missingInfo",
            extra: focus != null ? new Dictionary<string, object?> { ["focus"] = focus } : null);

    public static PushNotificationRequest ApprovedPendingPayment(Guid userId, Guid requestId, RequestType requestType) =>
        BuildRequest(userId, "request_status_changed", requestId, requestType, RequestStatus.ApprovedPendingPayment,
            "Aprovado ✅ falta só o pagamento",
            "Pague para liberar a assinatura do documento.",
            targetRole: "patient",
            deepLinkSuffix: $"payment/request/{requestId}",
            category: PushCategory.Payments);

    public static PushNotificationRequest PaymentFailed(Guid userId, Guid requestId) =>
        BuildRequest(userId, "payment_failed", requestId, RequestType.Prescription, RequestStatus.ApprovedPendingPayment,
            "Pagamento não concluído",
            "Toque para tentar novamente ou trocar a forma de pagamento.",
            targetRole: "patient",
            deepLinkSuffix: $"payment/request/{requestId}?retry=1",
            category: PushCategory.Payments);

    public static PushNotificationRequest Paid(Guid userId, Guid requestId, RequestType requestType) =>
        BuildRequest(userId, "request_status_changed", requestId, requestType, RequestStatus.Paid,
            "Pagamento confirmado ✅",
            "Agora vamos gerar e assinar seu documento.",
            targetRole: "patient",
            category: PushCategory.Payments, bypassQuietHours: true);

    public static PushNotificationRequest Signed(Guid userId, Guid requestId, RequestType requestType) =>
        BuildRequest(userId, "request_status_changed", requestId, requestType, RequestStatus.Signed,
            "Documento pronto 🧾",
            "Sua receita/exame está assinado. Toque para baixar.",
            targetRole: "patient",
            deepLinkSuffix: $"request-detail/{requestId}?action=download",
            extra: new Dictionary<string, object?> { ["documentAvailable"] = true },
            bypassQuietHours: true);

    public static PushNotificationRequest Rejected(Guid userId, Guid requestId, RequestType requestType, string? reason = null) =>
        BuildRequest(userId, "request_status_changed", requestId, requestType, RequestStatus.Rejected,
            "Seu pedido precisa de revisão",
            "Toque para ver o motivo e o que fazer agora.",
            targetRole: "patient",
            deepLinkSuffix: $"request-detail/{requestId}?tab=reason",
            extra: reason != null ? new Dictionary<string, object?> { ["reasonCode"] = reason.Length > 50 ? reason[..50] : reason, ["reasonShort"] = reason } : null);

    public static PushNotificationRequest Cancelled(Guid userId, Guid requestId, bool hadPayment = false) =>
        BuildRequest(userId, "request_status_changed", requestId, RequestType.Prescription, RequestStatus.Cancelled,
            "Pedido cancelado",
            hadPayment ? "Pedido cancelado. Estamos processando reembolso/estorno." : "Toque para ver detalhes e próximos passos.",
            targetRole: "patient",
            channel: hadPayment ? PushChannel.Default : PushChannel.Quiet,
            highPriority: hadPayment,
            category: PushCategory.System);

    // ── Médico: Pedidos ───────────────────────────────────────────────────

    public static PushNotificationRequest NewRequestAvailable(Guid doctorId, string tipoSolicitacao, string? patientName = null, int count = 1) =>
        new(doctorId,
            count > 1 ? $"{count} novas solicitações" : "Nova solicitação",
            count > 1 ? $"Há {count} pedidos aguardando revisão." : $"Há um pedido de {tipoSolicitacao} aguardando revisão{(patientName != null ? $": {patientName}" : ".")}",
            new PushNotificationPayload("new_request_available", "renoveja://doctor-requests?filter=pending", PushCategory.Requests,
                $"new_req_{doctorId}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 120}", DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                TargetRole: "doctor",
                Extra: count > 1 ? new Dictionary<string, object?> { ["count"] = count } : null),
            PushChannel.Default, true, false);

    public static PushNotificationRequest RequestAssigned(Guid doctorId, Guid requestId, RequestType requestType = RequestType.Prescription) =>
        BuildRequest(doctorId, "request_assigned", requestId, requestType, RequestStatus.InReview,
            "Pedido atribuído a você",
            "Toque para abrir e iniciar a análise.",
            targetRole: "doctor",
            deepLinkSuffix: $"doctor-request/{requestId}",
            channel: PushChannel.Quiet, highPriority: false);

    public static PushNotificationRequest PaidForDoctor(Guid doctorId, Guid requestId, RequestType requestType) =>
        BuildRequest(doctorId, "request_status_changed", requestId, requestType, RequestStatus.Paid,
            "Pagamento confirmado",
            "Documento pronto para assinatura.",
            targetRole: "doctor",
            deepLinkSuffix: $"doctor-request/{requestId}?action=sign",
            category: PushCategory.Payments);

    public static PushNotificationRequest SigningFailed(Guid doctorId, Guid requestId) =>
        BuildRequest(doctorId, "signing_failed", requestId, RequestType.Prescription, RequestStatus.Paid,
            "Falha ao assinar",
            "Toque para tentar novamente ou atualizar certificado.",
            targetRole: "doctor",
            deepLinkSuffix: $"doctor-request/{requestId}?action=sign&retry=1",
            category: PushCategory.System);

    // ── Consulta ───────────────────────────────────────────────────────────

    public static PushNotificationRequest ConsultationScheduled(Guid userId, Guid requestId, bool isDoctor) =>
        BuildRequest(userId, "consultation_scheduled", requestId, RequestType.Consultation, RequestStatus.SearchingDoctor,
            "Consulta confirmada ✅",
            "Sua consulta foi agendada.",
            targetRole: isDoctor ? "doctor" : "patient",
            deepLinkSuffix: isDoctor ? $"doctor-request/{requestId}" : $"video/{requestId}",
            channel: PushChannel.Quiet, highPriority: false,
            category: PushCategory.Consultations);

    public static PushNotificationRequest ConsultationStartingSoon(Guid userId, Guid requestId, int minutesLeft, bool isDoctor) =>
        BuildRequest(userId, "consultation_starting_soon", requestId, RequestType.Consultation, RequestStatus.Paid,
            $"Sua consulta começa em {minutesLeft} min",
            "Toque para entrar na sala.",
            targetRole: isDoctor ? "doctor" : "patient",
            deepLinkSuffix: $"video/{requestId}",
            channel: minutesLeft <= 10 ? PushChannel.Default : PushChannel.Quiet,
            highPriority: minutesLeft <= 10,
            category: PushCategory.Consultations,
            bypassQuietHours: minutesLeft <= 10);

    public static PushNotificationRequest DoctorReady(Guid patientId, Guid requestId) =>
        BuildRequest(patientId, "doctor_ready", requestId, RequestType.Consultation, RequestStatus.Paid,
            "Seu médico já está pronto",
            "Toque para entrar na consulta.",
            targetRole: "patient",
            deepLinkSuffix: $"video/{requestId}",
            category: PushCategory.Consultations,
            bypassQuietHours: true);

    public static PushNotificationRequest NoShow(Guid userId, Guid requestId, bool isDoctor) =>
        BuildRequest(userId, "no_show", requestId, RequestType.Consultation, RequestStatus.Cancelled,
            "Não conseguimos iniciar a consulta",
            "Toque para remarcar ou falar com o suporte.",
            targetRole: isDoctor ? "doctor" : "patient",
            deepLinkSuffix: isDoctor ? $"doctor-request/{requestId}" : $"request-detail/{requestId}",
            channel: PushChannel.Quiet, highPriority: false,
            category: PushCategory.System);

    /// <summary>Médico encerrou a consulta — notifica o paciente com prioridade.</summary>
    public static PushNotificationRequest ConsultationFinished(Guid patientId, Guid requestId) =>
        BuildRequest(patientId, "consultation_finished", requestId, RequestType.Consultation, RequestStatus.ConsultationFinished,
            "Consulta finalizada",
            "Sua consulta foi encerrada. Obrigado!",
            targetRole: "patient",
            deepLinkSuffix: $"consultation-summary/{requestId}",
            category: PushCategory.Consultations,
            bypassQuietHours: true);

    // ── Lembretes (pedido parado) ───────────────────────────────────────────

    /// <summary>Lembrete: pagamento pendente há mais de 6h (paciente).</summary>
    public static PushNotificationRequest ReminderPaymentPending(Guid patientId, Guid requestId, RequestType requestType) =>
        BuildRequest(patientId, "reminder_payment_pending", requestId, requestType, RequestStatus.ApprovedPendingPayment,
            "Pagamento pendente",
            "Seu pedido está aprovado. Toque para concluir o pagamento.",
            targetRole: "patient",
            deepLinkSuffix: $"payment/request/{requestId}",
            channel: PushChannel.Default,
            category: PushCategory.Reminders,
            collapseKeySuffix: "reminder_payment");

    /// <summary>Lembrete: pedido em análise há mais de 30 min (médico).</summary>
    public static PushNotificationRequest ReminderInReviewStale(Guid doctorId, Guid requestId, RequestType requestType) =>
        BuildRequest(doctorId, "reminder_in_review_stale", requestId, requestType, RequestStatus.InReview,
            "Pedido aguardando sua análise",
            "Toque para continuar a revisão.",
            targetRole: "doctor",
            deepLinkSuffix: $"doctor-request/{requestId}",
            channel: PushChannel.Quiet,
            category: PushCategory.Reminders,
            collapseKeySuffix: "reminder_inreview");

    // ── Lembretes de renovação (receita vencendo) ────────────────────────────

    /// <summary>Lembrete: receita vence em breve — paciente deve renovar.</summary>
    public static PushNotificationRequest RenewalReminder(Guid patientId, Guid requestId) =>
        BuildRequest(patientId, "reminder_renewal", requestId, RequestType.Prescription, RequestStatus.Delivered,
            "Receita vencendo em breve",
            "Sua receita está próxima do vencimento. Renove agora para não ficar sem medicamento.",
            targetRole: "patient",
            deepLinkSuffix: $"request-detail/{requestId}",
            channel: PushChannel.Quiet,
            category: PushCategory.Reminders,
            collapseKeySuffix: "reminder_renewal");
}
