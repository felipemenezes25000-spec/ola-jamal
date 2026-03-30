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
            RequestStatus.InConsultation or RequestStatus.SearchingDoctor => PushCategory.Consultations,
            _ => PushCategory.Requests  // Fluxo de pagamento removido — Paid/ApprovedPendingPayment → Requests
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

    public static PushNotificationRequest InReview(Guid userId, Guid requestId, RequestType requestType) =>
        BuildRequest(userId, "request_status_changed", requestId, requestType, RequestStatus.InReview,
            "Seu pedido está em análise",
            "Um profissional já está revisando sua solicitação.",
            targetRole: "patient",
            channel: PushChannel.Quiet, highPriority: false);

    public static PushNotificationRequest Paid(Guid userId, Guid requestId, RequestType requestType) =>
        BuildRequest(userId, "request_status_changed", requestId, requestType, RequestStatus.Paid,
            "Solicitação aprovada ✅",
            "Agora vamos gerar e assinar seu documento.",
            targetRole: "patient",
            deepLinkSuffix: $"request-detail/{requestId}",
            bypassQuietHours: true);

    /// <summary>Paciente notificado quando solicitação é aprovada (status Paid).</summary>
    public static PushNotificationRequest Approved(Guid userId, Guid requestId, RequestType requestType) =>
        BuildRequest(userId, "request_approved", requestId, requestType, RequestStatus.Paid,
            "Solicitação aprovada",
            "Seu pedido foi aprovado! O médico está preparando o documento.",
            targetRole: "patient",
            deepLinkSuffix: $"request-detail/{requestId}",
            channel: PushChannel.Default,
            category: PushCategory.Requests,
            bypassQuietHours: true);

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

    /// <summary>Médico notificado quando paciente realiza o pagamento.</summary>
    public static PushNotificationRequest PaidForDoctor(Guid doctorId, Guid requestId, RequestType requestType) =>
        BuildRequest(doctorId, "payment_received", requestId, requestType, RequestStatus.Paid,
            "Pagamento recebido",
            requestType == RequestType.Consultation
                ? "O paciente pagou. A consulta está pronta para iniciar."
                : "O paciente pagou. Você já pode assinar o documento.",
            targetRole: "doctor",
            deepLinkSuffix: $"doctor-request/{requestId}",
            channel: PushChannel.Default,
            category: PushCategory.Requests,
            bypassQuietHours: true);

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

    /// <summary>Médico recebe quando paciente cancela o pedido.</summary>
    public static PushNotificationRequest PatientCancelled(Guid doctorId, Guid requestId, RequestType requestType = RequestType.Prescription) =>
        BuildRequest(doctorId, "patient_cancelled", requestId, requestType, RequestStatus.Cancelled,
            "Pedido Cancelado",
            "O paciente cancelou o pedido.",
            targetRole: "doctor",
            deepLinkSuffix: $"doctor-request/{requestId}",
            channel: PushChannel.Quiet, highPriority: false,
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

    /// <summary>Médico encerrou a consulta — notifica o paciente. Consulta só finaliza após emissão de documentos.</summary>
    public static PushNotificationRequest ConsultationFinished(Guid patientId, Guid requestId) =>
        BuildRequest(patientId, "consultation_finished", requestId, RequestType.Consultation, RequestStatus.ConsultationFinished,
            "Consulta finalizada",
            "Sua consulta foi encerrada. Obrigado!",
            targetRole: "patient",
            deepLinkSuffix: $"consultation-summary/{requestId}",
            category: PushCategory.Consultations,
            bypassQuietHours: true);

    /// <summary>Chamada encerrada; aguardando médico emitir documentos para finalizar.</summary>
    public static PushNotificationRequest ConsultationEndedPendingDocuments(Guid patientId, Guid requestId) =>
        BuildRequest(patientId, "consultation_ended_pending_documents", requestId, RequestType.Consultation, RequestStatus.PendingPostConsultation,
            "Chamada encerrada",
            "Sua consulta foi encerrada. Os documentos serão disponibilizados em breve.",
            targetRole: "patient",
            deepLinkSuffix: $"consultation-summary/{requestId}",
            category: PushCategory.Consultations,
            bypassQuietHours: true);

    // ── Pós-consulta ──────────────────────────────────────────────────────

    /// <summary>Paciente notificado quando documentos pós-consulta são emitidos pelo médico.</summary>
    public static PushNotificationRequest PostConsultationDocumentsReady(Guid patientId, Guid requestId) =>
        BuildRequest(patientId, "post_consultation_documents_ready", requestId, RequestType.Consultation, RequestStatus.ConsultationFinished,
            "Documentos da consulta disponíveis",
            "Seu médico emitiu documentos da consulta. Toque para ver.",
            targetRole: "patient",
            deepLinkSuffix: $"request-detail/{requestId}",
            channel: PushChannel.Default,
            category: PushCategory.Consultations,
            bypassQuietHours: true);

    // ── Lembretes (pedido parado) ───────────────────────────────────────────

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

    // ── Sistema (certificado, etc.) ───────────────────────────────────────────

    /// <summary>Médico recebe notificação quando certificado digital está próximo do vencimento.</summary>
    public static PushNotificationRequest CertificateExpiringSoon(Guid doctorUserId, int daysLeft) =>
        new(doctorUserId,
            "Certificado digital vencendo",
            $"Seu certificado vence em {daysLeft} dias. Renove para continuar assinando.",
            new PushNotificationPayload("certificate_expiring_soon", "renoveja://settings", PushCategory.System,
                $"cert_expiry_{doctorUserId:N}_{daysLeft}", DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                TargetRole: "doctor"),
            PushChannel.Default, true, BypassQuietHours: true);

    /// <summary>Médico recebe notificação quando certificado digital é cadastrado.</summary>
    public static PushNotificationRequest CertificateUploaded(Guid doctorId, string validUntil) =>
        new(doctorId,
            "Certificado Digital Cadastrado",
            $"Seu certificado digital foi cadastrado e validado com sucesso. Válido até {validUntil}.",
            new PushNotificationPayload("certificate_uploaded", "renoveja://settings", PushCategory.System,
                $"cert_{doctorId:N}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 300}", DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                TargetRole: "doctor"),
            PushChannel.Default, true, false);

    // ── Notificação de verificação (farmácia/empregador verificou) ──────────

    /// <summary>Paciente recebe notificação quando documento é verificado externamente.
    /// collapseKey usa documentId + userId (sem time bucket) para colapsar múltiplas
    /// verificações do mesmo documento pelo mesmo usuário em uma única notificação.</summary>
    public static PushNotificationRequest DocumentVerified(Guid patientId, Guid documentId, string documentType) =>
        BuildRequest(patientId, "document_verified", documentId, RequestType.Prescription, RequestStatus.Delivered,
            "Documento verificado",
            $"Seu {documentType.ToLowerInvariant()} foi verificado com sucesso.",
            targetRole: "patient",
            channel: PushChannel.Quiet,
            category: PushCategory.Reminders,
            collapseKeySuffix: "doc_verified");

    // ── Notificação de dispensação (farmácia dispensou receita) ──────────────

    /// <summary>Paciente recebe notificação quando receita é dispensada na farmácia.</summary>
    public static PushNotificationRequest DocumentDispensed(Guid patientId, Guid requestId) =>
        BuildRequest(patientId, "document_dispensed", requestId, RequestType.Prescription, RequestStatus.Delivered,
            "Receita dispensada",
            "Sua receita foi dispensada na farmácia.",
            targetRole: "patient",
            deepLinkSuffix: $"request-detail/{requestId}",
            channel: PushChannel.Quiet,
            category: PushCategory.Requests);

    /// <summary>Paciente recebe notificação quando receita controlada é dispensada (não pode reutilizar).</summary>
    public static PushNotificationRequest ControlledSubstanceDispensed(Guid patientId, Guid requestId) =>
        BuildRequest(patientId, "controlled_substance_dispensed", requestId, RequestType.Prescription, RequestStatus.Delivered,
            "Receita controlada utilizada",
            "Sua receita controlada foi dispensada. Esta receita não pode ser utilizada novamente.",
            targetRole: "patient",
            deepLinkSuffix: $"request-detail/{requestId}",
            category: PushCategory.System,
            bypassQuietHours: true);

    // ── Admin: Aprovação/Rejeição de médico ──────────────────────────────────

    /// <summary>Médico notificado quando admin aprova seu cadastro.</summary>
    public static PushNotificationRequest DoctorApprovedByAdmin(Guid doctorUserId) =>
        new(doctorUserId,
            "Cadastro aprovado!",
            "Seu cadastro foi aprovado. Você já pode atender pacientes.",
            new PushNotificationPayload("doctor_approved", "renoveja://doctor-dashboard", PushCategory.System,
                $"admin_approval_{doctorUserId:N}", DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                TargetRole: "doctor"),
            PushChannel.Default, true, true);

    /// <summary>Médico notificado quando admin rejeita seu cadastro.</summary>
    public static PushNotificationRequest DoctorRejectedByAdmin(Guid doctorUserId) =>
        new(doctorUserId,
            "Cadastro não aprovado",
            "Seu cadastro precisa de ajustes. Verifique as orientações.",
            new PushNotificationPayload("doctor_rejected", "renoveja://settings", PushCategory.System,
                $"admin_rejection_{doctorUserId:N}", DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                TargetRole: "doctor"),
            PushChannel.Default, true, false);

    // ── Assinatura em lote ───────────────────────────────────────────────────

    /// <summary>Médico notificado quando assinatura em lote é concluída.</summary>
    public static PushNotificationRequest BatchSignatureCompleted(Guid doctorUserId, int count) =>
        new(doctorUserId,
            "Documentos assinados",
            $"{count} documentos assinados com sucesso.",
            new PushNotificationPayload("batch_signature_completed", "renoveja://doctor-requests?filter=signed", PushCategory.Requests,
                $"batch_sign_{doctorUserId:N}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60}", DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                TargetRole: "doctor"),
            PushChannel.Quiet, true, false);
}
