namespace RenoveJa.Domain.Entities;

/// <summary>
/// Cartão salvo do paciente (Mercado Pago Customers).
/// </summary>
public class SavedCard : Entity
{
    public Guid UserId { get; private set; }
    public string MpCustomerId { get; private set; } = string.Empty;
    public string MpCardId { get; private set; } = string.Empty;
    public string LastFour { get; private set; } = string.Empty;
    public string Brand { get; private set; } = string.Empty;

    private SavedCard() { }

    public static SavedCard Create(Guid userId, string mpCustomerId, string mpCardId, string lastFour, string brand)
    {
        return new SavedCard
        {
            Id = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UserId = userId,
            MpCustomerId = mpCustomerId ?? throw new ArgumentNullException(nameof(mpCustomerId)),
            MpCardId = mpCardId ?? throw new ArgumentNullException(nameof(mpCardId)),
            LastFour = lastFour ?? throw new ArgumentNullException(nameof(lastFour)),
            Brand = brand ?? throw new ArgumentNullException(nameof(brand))
        };
    }

    public static SavedCard Reconstitute(Guid id, DateTime createdAt, Guid userId, string mpCustomerId, string mpCardId, string lastFour, string brand)
    {
        return new SavedCard
        {
            Id = id,
            CreatedAt = createdAt,
            UserId = userId,
            MpCustomerId = mpCustomerId,
            MpCardId = mpCardId,
            LastFour = lastFour,
            Brand = brand
        };
    }
}
