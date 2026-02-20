using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

/// <summary>
/// Repositório de anamnese de consulta (transcrição + anamnese + sugestões IA).
/// </summary>
public interface IConsultationAnamnesisRepository
{
    Task<ConsultationAnamnesis?> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default);
    Task<ConsultationAnamnesis> CreateAsync(ConsultationAnamnesis entity, CancellationToken cancellationToken = default);
    Task<ConsultationAnamnesis> UpdateAsync(ConsultationAnamnesis entity, CancellationToken cancellationToken = default);
}
