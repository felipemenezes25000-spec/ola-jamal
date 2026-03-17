namespace RenoveJa.Domain.Entities.Sus;

/// <summary>
/// Unidade de Saúde (UBS, UPA, CAPS, etc.) vinculada ao município.
/// </summary>
public class UnidadeSaude : AggregateRoot
{
    public string Nome { get; private set; } = string.Empty;
    public string Cnes { get; private set; } = string.Empty;
    public string? Tipo { get; private set; }
    public string? Telefone { get; private set; }
    public string? Email { get; private set; }

    // Endereço
    public string? Logradouro { get; private set; }
    public string? Numero { get; private set; }
    public string? Bairro { get; private set; }
    public string? Cidade { get; private set; }
    public string? Estado { get; private set; }
    public string? Cep { get; private set; }

    public bool Ativo { get; private set; } = true;
    public new DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private UnidadeSaude() : base() { }

    public static UnidadeSaude Create(string nome, string cnes, string? tipo = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(nome);
        ArgumentException.ThrowIfNullOrWhiteSpace(cnes);

        return new UnidadeSaude
        {
            Id = Guid.NewGuid(),
            Nome = nome.Trim(),
            Cnes = cnes.Trim(),
            Tipo = tipo?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    public void Update(string nome, string cnes, string? tipo, string? telefone, string? email,
        string? logradouro, string? numero, string? bairro, string? cidade, string? estado, string? cep)
    {
        Nome = nome.Trim();
        Cnes = cnes.Trim();
        Tipo = tipo?.Trim();
        Telefone = telefone?.Trim();
        Email = email?.Trim();
        Logradouro = logradouro?.Trim();
        Numero = numero?.Trim();
        Bairro = bairro?.Trim();
        Cidade = cidade?.Trim();
        Estado = estado?.Trim();
        Cep = cep?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void Desativar() { Ativo = false; UpdatedAt = DateTime.UtcNow; }
    public void Ativar() { Ativo = true; UpdatedAt = DateTime.UtcNow; }
}
