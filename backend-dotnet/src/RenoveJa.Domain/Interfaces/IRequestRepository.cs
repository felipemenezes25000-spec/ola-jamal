using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Domain.Interfaces;

public interface IRequestRepository
{
    Task<MedicalRequest?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    /// <summary>Busca por short_code (12 hex chars). Retorna o primeiro se houver colisão.</summary>
    Task<MedicalRequest?> GetByShortCodeAsync(string shortCode, CancellationToken cancellationToken = default);
    Task<List<MedicalRequest>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<List<MedicalRequest>> GetByPatientIdAsync(Guid patientId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Busca requests ativos (não rejeitados/cancelados) do paciente por tipo.
    /// Otimização: usado pelos cooldowns para evitar carregar TODOS os requests do paciente.
    /// </summary>
    Task<List<MedicalRequest>> GetActiveByPatientAndTypeAsync(Guid patientId, RequestType type, CancellationToken cancellationToken = default);
    Task<List<MedicalRequest>> GetByDoctorIdAsync(Guid doctorId, CancellationToken cancellationToken = default);
    Task<List<MedicalRequest>> GetByStatusAsync(RequestStatus status, CancellationToken cancellationToken = default);
    /// <summary>Fila: requests sem médico em status que exigem ação. Uma query em vez de 6 GetByStatusAsync.</summary>
    Task<List<MedicalRequest>> GetAvailableForQueueAsync(CancellationToken cancellationToken = default);
    Task<List<MedicalRequest>> GetByTypeAsync(RequestType type, CancellationToken cancellationToken = default);
    /// <summary>Retorna contagens e ganhos para o médico (stats do dashboard).</summary>
    Task<(int PendingCount, int InReviewCount, int CompletedCount, decimal TotalEarnings)> GetDoctorStatsAsync(Guid doctorId, CancellationToken cancellationToken = default);

    /// <summary>Pedidos em ApprovedPendingPayment com updated_at anterior ao cutoff (para lembretes de pagamento).</summary>
    Task<List<MedicalRequest>> GetStaleApprovedPendingPaymentAsync(DateTime cutoffUtc, CancellationToken cancellationToken = default);

    /// <summary>Pedidos em InReview com updated_at anterior ao cutoff (para lembretes de pedido parado).</summary>
    Task<List<MedicalRequest>> GetStaleInReviewAsync(DateTime cutoffUtc, CancellationToken cancellationToken = default);

    /// <summary>Receitas entregues (delivered) que vencem nos próximos N dias. Para lembretes de renovação.</summary>
    Task<List<MedicalRequest>> GetPrescriptionsExpiringSoonAsync(DateTime nowUtc, int daysAhead = 7, CancellationToken cancellationToken = default);

    /// <summary>Consultas em status Paid ou ConsultationReady (aceitas, não iniciadas) atualizadas recentemente. Para lembretes de consulta próxima.</summary>
    Task<List<MedicalRequest>> GetUpcomingConsultationsAsync(CancellationToken cancellationToken = default);

    Task<MedicalRequest> CreateAsync(MedicalRequest request, CancellationToken cancellationToken = default);
    Task<MedicalRequest> UpdateAsync(MedicalRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);

    // ── Paginação real no banco (evita buscar tudo + Skip/Take em memória) ──────────

    /// <summary>
    /// Pedidos do paciente com paginação real no banco (LIMIT/OFFSET).
    /// Filtros opcionais: status snake_case, requestType snake_case.
    /// Retorna (items, totalCount) para montar PagedResponse sem query extra.
    /// </summary>
    Task<(List<MedicalRequest> Items, int TotalCount)> GetByPatientIdPagedAsync(
        Guid patientId,
        string? status = null,
        string? type = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Pedidos da fila do médico (atribuídos + disponíveis) com paginação real.
    /// Combina GetByDoctorIdAsync + GetAvailableForQueueAsync em memória leve
    /// (apenas IDs + status, depois busca a página completa).
    /// </summary>
    Task<(List<MedicalRequest> Items, int TotalCount)> GetDoctorQueuePagedAsync(
        Guid doctorId,
        string? status = null,
        string? type = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default);
}
