using RenoveJa.Domain.Enums;

namespace RenoveJa.Domain.Entities.Sus;

/// <summary>
/// Agendamento de atendimento em UBS.
/// </summary>
public class AgendaUbs : AggregateRoot
{
    public Guid CidadaoId { get; private set; }
    public string? CidadaoNome { get; private set; }
    public Guid ProfissionalId { get; private set; }
    public string? ProfissionalNome { get; private set; }
    public Guid UnidadeSaudeId { get; private set; }

    public DateTime DataHora { get; private set; }
    public AgendaStatus Status { get; private set; } = AgendaStatus.Agendado;
    public string? TipoAtendimento { get; private set; }
    public string? Observacoes { get; private set; }

    public DateTime? CheckInAt { get; private set; }
    public DateTime? ChamadaAt { get; private set; }
    public DateTime? InicioAt { get; private set; }
    public DateTime? FimAt { get; private set; }

    public new DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private AgendaUbs() : base() { }

    public static AgendaUbs Create(Guid cidadaoId, string? cidadaoNome,
        Guid profissionalId, string? profissionalNome,
        Guid unidadeSaudeId, DateTime dataHora, string? tipoAtendimento = null)
    {
        return new AgendaUbs
        {
            Id = Guid.NewGuid(),
            CidadaoId = cidadaoId,
            CidadaoNome = cidadaoNome?.Trim(),
            ProfissionalId = profissionalId,
            ProfissionalNome = profissionalNome?.Trim(),
            UnidadeSaudeId = unidadeSaudeId,
            DataHora = dataHora,
            TipoAtendimento = tipoAtendimento?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    public void CheckIn()
    {
        Status = AgendaStatus.Aguardando;
        CheckInAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Chamar()
    {
        Status = AgendaStatus.Chamado;
        ChamadaAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void IniciarAtendimento()
    {
        Status = AgendaStatus.EmAtendimento;
        InicioAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Finalizar()
    {
        Status = AgendaStatus.Finalizado;
        FimAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancelar()
    {
        Status = AgendaStatus.Cancelado;
        UpdatedAt = DateTime.UtcNow;
    }

    public void NaoCompareceu()
    {
        Status = AgendaStatus.NaoCompareceu;
        UpdatedAt = DateTime.UtcNow;
    }
}
