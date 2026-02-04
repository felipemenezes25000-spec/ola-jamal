namespace RenoveJa.Domain.Entities;

/// <summary>
/// Marca a raiz de um agregado DDD.
/// Agregados são clusters de entidades e value objects com fronteiras de consistência.
/// Apenas a raiz do agregado é referenciada externamente; alterações passam por ela.
/// </summary>
public abstract class AggregateRoot : Entity
{
    protected AggregateRoot() : base() { }

    protected AggregateRoot(Guid id, DateTime createdAt) : base(id, createdAt) { }
}
