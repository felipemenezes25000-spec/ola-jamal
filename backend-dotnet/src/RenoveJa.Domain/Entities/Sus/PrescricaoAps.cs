namespace RenoveJa.Domain.Entities.Sus;

/// <summary>
/// Prescrição gerada durante atendimento APS.
/// </summary>
public class PrescricaoAps : AggregateRoot
{
    public Guid AtendimentoId { get; private set; }
    public Guid CidadaoId { get; private set; }
    public Guid ProfissionalId { get; private set; }
    public Guid UnidadeSaudeId { get; private set; }

    public string Medicamento { get; private set; } = string.Empty;
    public string? Posologia { get; private set; }
    public string? Dose { get; private set; }
    public string? Frequencia { get; private set; }
    public string? Duracao { get; private set; }
    public string? ViaAdministracao { get; private set; }
    public string? Orientacoes { get; private set; }
    public int Quantidade { get; private set; } = 1;
    public bool UsoContínuo { get; private set; }

    public new DateTime CreatedAt { get; private set; }

    private PrescricaoAps() : base() { }

    public static PrescricaoAps Create(
        Guid atendimentoId, Guid cidadaoId, Guid profissionalId, Guid unidadeSaudeId,
        string medicamento, string? posologia, string? dose, string? frequencia,
        string? duracao, string? viaAdministracao, string? orientacoes,
        int quantidade = 1, bool usoContinuo = false)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(medicamento);

        return new PrescricaoAps
        {
            Id = Guid.NewGuid(),
            AtendimentoId = atendimentoId,
            CidadaoId = cidadaoId,
            ProfissionalId = profissionalId,
            UnidadeSaudeId = unidadeSaudeId,
            Medicamento = medicamento.Trim(),
            Posologia = posologia?.Trim(),
            Dose = dose?.Trim(),
            Frequencia = frequencia?.Trim(),
            Duracao = duracao?.Trim(),
            ViaAdministracao = viaAdministracao?.Trim(),
            Orientacoes = orientacoes?.Trim(),
            Quantidade = quantidade,
            UsoContínuo = usoContinuo,
            CreatedAt = DateTime.UtcNow,
        };
    }
}
