namespace RenoveJa.Domain.Entities.Sus;

/// <summary>
/// Profissional de saúde vinculado a uma UBS (médico, enfermeiro, ACS, etc.).
/// </summary>
public class ProfissionalSus : AggregateRoot
{
    public string NomeCompleto { get; private set; } = string.Empty;
    public string? Cpf { get; private set; }
    public string? Cns { get; private set; }
    public string? Cbo { get; private set; }
    public string? ConselhoNumero { get; private set; }
    public string? ConselhoUf { get; private set; }
    public string? ConselhoTipo { get; private set; }
    public string? Especialidade { get; private set; }
    public string? Telefone { get; private set; }
    public string? Email { get; private set; }

    /// <summary>UBS principal de lotação.</summary>
    public Guid UnidadeSaudeId { get; private set; }

    /// <summary>ID do usuário no sistema (se tiver login).</summary>
    public Guid? UserId { get; private set; }

    public bool Ativo { get; private set; } = true;
    public new DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private ProfissionalSus() : base() { }

    public static ProfissionalSus Create(string nomeCompleto, Guid unidadeSaudeId, string? cbo = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(nomeCompleto);

        return new ProfissionalSus
        {
            Id = Guid.NewGuid(),
            NomeCompleto = nomeCompleto.Trim(),
            UnidadeSaudeId = unidadeSaudeId,
            Cbo = cbo?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    public void Update(string nomeCompleto, string? cpf, string? cns, string? cbo,
        string? conselhoNumero, string? conselhoUf, string? conselhoTipo,
        string? especialidade, string? telefone, string? email,
        Guid unidadeSaudeId, Guid? userId)
    {
        NomeCompleto = nomeCompleto.Trim();
        Cpf = cpf?.Trim();
        Cns = cns?.Trim();
        Cbo = cbo?.Trim();
        ConselhoNumero = conselhoNumero?.Trim();
        ConselhoUf = conselhoUf?.Trim();
        ConselhoTipo = conselhoTipo?.Trim();
        Especialidade = especialidade?.Trim();
        Telefone = telefone?.Trim();
        Email = email?.Trim();
        UnidadeSaudeId = unidadeSaudeId;
        UserId = userId;
        UpdatedAt = DateTime.UtcNow;
    }
}
