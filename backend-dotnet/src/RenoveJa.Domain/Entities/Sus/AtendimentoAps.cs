namespace RenoveJa.Domain.Entities.Sus;

/// <summary>
/// Atendimento na Atenção Primária — modelo SOAP.
/// Vinculado a um cidadão, profissional e UBS.
/// </summary>
public class AtendimentoAps : AggregateRoot
{
    public Guid CidadaoId { get; private set; }
    public string? CidadaoNome { get; private set; }
    public Guid ProfissionalId { get; private set; }
    public string? ProfissionalNome { get; private set; }
    public Guid UnidadeSaudeId { get; private set; }
    public Guid? AgendaId { get; private set; }

    // SOAP
    public string? Subjetivo { get; private set; }
    public string? Objetivo { get; private set; }
    public string? Avaliacao { get; private set; }
    public string? Plano { get; private set; }

    // Sinais vitais
    public string? PressaoArterial { get; private set; }
    public decimal? Temperatura { get; private set; }
    public int? FrequenciaCardiaca { get; private set; }
    public int? FrequenciaRespiratoria { get; private set; }
    public decimal? Peso { get; private set; }
    public decimal? Altura { get; private set; }
    public decimal? Imc { get; private set; }
    public int? SaturacaoO2 { get; private set; }
    public decimal? Glicemia { get; private set; }

    // Classificação
    public string? Cid10Principal { get; private set; }
    public string? Cid10Secundario { get; private set; }
    public string? Ciap2 { get; private set; }
    public string? TipoAtendimento { get; private set; }
    public string? Procedimentos { get; private set; }

    // Encaminhamento
    public string? Encaminhamento { get; private set; }
    public string? Observacoes { get; private set; }

    // Exportação e-SUS
    public bool ExportadoEsus { get; private set; }
    public DateTime? ExportadoEsusAt { get; private set; }
    public string? LediUuid { get; private set; }

    public DateTime DataAtendimento { get; private set; }
    public new DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private AtendimentoAps() : base() { }

    public static AtendimentoAps Create(
        Guid cidadaoId, string? cidadaoNome,
        Guid profissionalId, string? profissionalNome,
        Guid unidadeSaudeId, Guid? agendaId = null)
    {
        return new AtendimentoAps
        {
            Id = Guid.NewGuid(),
            CidadaoId = cidadaoId,
            CidadaoNome = cidadaoNome?.Trim(),
            ProfissionalId = profissionalId,
            ProfissionalNome = profissionalNome?.Trim(),
            UnidadeSaudeId = unidadeSaudeId,
            AgendaId = agendaId,
            DataAtendimento = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    public void UpdateSoap(string? subjetivo, string? objetivo, string? avaliacao, string? plano)
    {
        Subjetivo = subjetivo?.Trim();
        Objetivo = objetivo?.Trim();
        Avaliacao = avaliacao?.Trim();
        Plano = plano?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateSinaisVitais(string? pa, decimal? temp, int? fc, int? fr,
        decimal? peso, decimal? altura, int? satO2, decimal? glicemia)
    {
        PressaoArterial = pa?.Trim();
        Temperatura = temp;
        FrequenciaCardiaca = fc;
        FrequenciaRespiratoria = fr;
        Peso = peso;
        Altura = altura;
        Imc = (peso.HasValue && altura.HasValue && altura.Value > 0)
            ? Math.Round(peso.Value / (altura.Value * altura.Value), 2)
            : null;
        SaturacaoO2 = satO2;
        Glicemia = glicemia;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateClassificacao(string? cid10, string? cid10Sec, string? ciap2,
        string? tipoAtendimento, string? procedimentos)
    {
        Cid10Principal = cid10?.Trim();
        Cid10Secundario = cid10Sec?.Trim();
        Ciap2 = ciap2?.Trim();
        TipoAtendimento = tipoAtendimento?.Trim();
        Procedimentos = procedimentos?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarcarExportado(string lediUuid)
    {
        ExportadoEsus = true;
        ExportadoEsusAt = DateTime.UtcNow;
        LediUuid = lediUuid;
        UpdatedAt = DateTime.UtcNow;
    }
}
