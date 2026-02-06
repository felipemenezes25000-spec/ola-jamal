namespace RenoveJa.Domain.Entities;

/// <summary>
/// Classe base para entidades do domínio com identificador e data de criação.
/// </summary>
public abstract class Entity
{
    /// <summary>Identificador único da entidade.</summary>
    public Guid Id { get; protected set; }
    /// <summary>Data de criação do registro.</summary>
    public DateTime CreatedAt { get; protected set; }

    /// <summary>
    /// Construtor padrão que gera novo Id e CreatedAt.
    /// </summary>
    protected Entity()
    {
        Id = Guid.NewGuid();
        CreatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Construtor para reconstituição (ex.: leitura do banco).
    /// </summary>
    protected Entity(Guid id, DateTime createdAt)
    {
        Id = id;
        CreatedAt = createdAt;
    }

    public override bool Equals(object? obj)
    {
        if (obj is not Entity other)
            return false;

        if (ReferenceEquals(this, other))
            return true;

        if (GetType() != other.GetType())
            return false;

        return Id == other.Id;
    }

    public override int GetHashCode() => Id.GetHashCode();

    public static bool operator ==(Entity? a, Entity? b)
    {
        if (a is null && b is null)
            return true;

        if (a is null || b is null)
            return false;

        return a.Equals(b);
    }

    public static bool operator !=(Entity? a, Entity? b) => !(a == b);
}
