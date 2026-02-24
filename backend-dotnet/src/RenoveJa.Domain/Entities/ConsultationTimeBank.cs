namespace RenoveJa.Domain.Entities;

/// <summary>
/// Banco de horas de consulta por paciente e tipo de consulta.
/// Acumula segundos não utilizados de consultas anteriores para uso futuro gratuito.
/// </summary>
public class ConsultationTimeBank : AggregateRoot
{
    public Guid PatientId { get; private set; }
    public string ConsultationType { get; private set; } = string.Empty;
    public int BalanceSeconds { get; private set; }
    public DateTime LastUpdatedAt { get; private set; }

    private ConsultationTimeBank() : base() { }

    private ConsultationTimeBank(Guid id, Guid patientId, string consultationType, int balanceSeconds, DateTime lastUpdatedAt, DateTime createdAt)
        : base(id, createdAt)
    {
        PatientId = patientId;
        ConsultationType = consultationType;
        BalanceSeconds = balanceSeconds;
        LastUpdatedAt = lastUpdatedAt;
    }

    public static ConsultationTimeBank Create(Guid patientId, string consultationType)
    {
        return new ConsultationTimeBank(
            Guid.NewGuid(),
            patientId,
            consultationType,
            0,
            DateTime.UtcNow,
            DateTime.UtcNow);
    }

    public static ConsultationTimeBank Reconstitute(Guid id, Guid patientId, string consultationType, int balanceSeconds, DateTime lastUpdatedAt, DateTime createdAt)
    {
        return new ConsultationTimeBank(id, patientId, consultationType, balanceSeconds, lastUpdatedAt, createdAt);
    }

    public void Credit(int seconds)
    {
        if (seconds <= 0) return;
        BalanceSeconds += seconds;
        LastUpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Debita segundos do saldo. Retorna quantos segundos foram efetivamente debitados.</summary>
    public int Debit(int seconds)
    {
        if (seconds <= 0) return 0;
        var debited = Math.Min(seconds, BalanceSeconds);
        BalanceSeconds -= debited;
        LastUpdatedAt = DateTime.UtcNow;
        return debited;
    }

    public int BalanceMinutes => BalanceSeconds / 60;
}

