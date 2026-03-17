namespace RenoveJa.Domain.Entities.Sus;

/// <summary>
/// Cidadão cadastrado no SUS — paciente vinculado a uma UBS de referência.
/// </summary>
public class Cidadao : AggregateRoot
{
    public string NomeCompleto { get; private set; } = string.Empty;
    public string? Cpf { get; private set; }
    public string? Cns { get; private set; }
    public DateTime? DataNascimento { get; private set; }
    public string? Sexo { get; private set; }
    public string? Telefone { get; private set; }
    public string? Email { get; private set; }
    public string? NomeMae { get; private set; }
    public string? NomePai { get; private set; }

    // Endereço
    public string? Logradouro { get; private set; }
    public string? Numero { get; private set; }
    public string? Complemento { get; private set; }
    public string? Bairro { get; private set; }
    public string? Cidade { get; private set; }
    public string? Estado { get; private set; }
    public string? Cep { get; private set; }

    // Território
    public string? Microarea { get; private set; }
    public string? CodigoFamilia { get; private set; }

    // UBS de referência
    public Guid? UnidadeSaudeId { get; private set; }

    public bool Ativo { get; private set; } = true;
    public new DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private Cidadao() : base() { }

    public static Cidadao Create(string nomeCompleto, string? cpf, string? cns, Guid? unidadeSaudeId = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(nomeCompleto);

        return new Cidadao
        {
            Id = Guid.NewGuid(),
            NomeCompleto = nomeCompleto.Trim(),
            Cpf = cpf?.Trim(),
            Cns = cns?.Trim(),
            UnidadeSaudeId = unidadeSaudeId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    public void Update(string nomeCompleto, string? cpf, string? cns, DateTime? dataNascimento,
        string? sexo, string? telefone, string? email, string? nomeMae, string? nomePai,
        string? logradouro, string? numero, string? complemento, string? bairro,
        string? cidade, string? estado, string? cep, string? microarea, string? codigoFamilia,
        Guid? unidadeSaudeId)
    {
        NomeCompleto = nomeCompleto.Trim();
        Cpf = cpf?.Trim();
        Cns = cns?.Trim();
        DataNascimento = dataNascimento;
        Sexo = sexo?.Trim();
        Telefone = telefone?.Trim();
        Email = email?.Trim();
        NomeMae = nomeMae?.Trim();
        NomePai = nomePai?.Trim();
        Logradouro = logradouro?.Trim();
        Numero = numero?.Trim();
        Complemento = complemento?.Trim();
        Bairro = bairro?.Trim();
        Cidade = cidade?.Trim();
        Estado = estado?.Trim();
        Cep = cep?.Trim();
        Microarea = microarea?.Trim();
        CodigoFamilia = codigoFamilia?.Trim();
        UnidadeSaudeId = unidadeSaudeId;
        UpdatedAt = DateTime.UtcNow;
    }
}
