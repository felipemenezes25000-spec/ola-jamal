namespace RenoveJa.Domain.Interfaces;

/// <summary>
/// Repositório de banco de horas de consultas por paciente.
/// </summary>
public interface IConsultationTimeBankRepository
{
    /// <summary>Retorna o saldo em segundos do paciente para o tipo de consulta especificado.</summary>
    Task<int> GetBalanceSecondsAsync(Guid patientId, string consultationType, CancellationToken ct = default);

    /// <summary>
    /// Credita segundos ao saldo do paciente. Cria o registro se não existir.
    /// Registra movimentação na tabela de transações.
    /// </summary>
    Task CreditAsync(Guid patientId, string consultationType, int seconds, Guid? requestId, string reason, CancellationToken ct = default);

    /// <summary>
    /// Debita segundos do saldo do paciente. Retorna quantos segundos foram efetivamente debitados.
    /// Registra movimentação na tabela de transações.
    /// </summary>
    Task<int> DebitAsync(Guid patientId, string consultationType, int seconds, Guid? requestId, CancellationToken ct = default);
}
