using System.Text.Json.Serialization;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de banco de horas de consulta via Supabase.
/// </summary>
public class ConsultationTimeBankRepository(SupabaseClient supabase) : IConsultationTimeBankRepository
{
    private const string BankTable = "consultation_time_bank";
    private const string TxTable = "consultation_time_bank_transactions";

    public async Task<int> GetBalanceSecondsAsync(Guid patientId, string consultationType, CancellationToken ct = default)
    {
        var model = await supabase.GetSingleAsync<TimeBankModel>(
            BankTable,
            filter: $"patient_id=eq.{patientId}&consultation_type=eq.{consultationType}",
            cancellationToken: ct);

        return model?.BalanceSeconds ?? 0;
    }

    public async Task CreditAsync(Guid patientId, string consultationType, int seconds, Guid? requestId, string reason, CancellationToken ct = default)
    {
        if (seconds <= 0) return;

        var existing = await supabase.GetSingleAsync<TimeBankModel>(
            BankTable,
            filter: $"patient_id=eq.{patientId}&consultation_type=eq.{consultationType}",
            cancellationToken: ct);

        if (existing == null)
        {
            var newRecord = new TimeBankModel
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                ConsultationType = consultationType,
                BalanceSeconds = seconds,
                LastUpdatedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };
            await supabase.InsertAsync<TimeBankModel>(BankTable, newRecord, ct);
        }
        else
        {
            var updatePayload = new TimeBankUpdatePayload
            {
                BalanceSeconds = existing.BalanceSeconds + seconds,
                LastUpdatedAt = DateTime.UtcNow
            };
            await supabase.UpdateAsync<TimeBankModel>(
                BankTable,
                $"patient_id=eq.{patientId}&consultation_type=eq.{consultationType}",
                updatePayload,
                ct);
        }

        await RecordTransactionAsync(patientId, consultationType, seconds, requestId, reason, ct);
    }

    public async Task<int> DebitAsync(Guid patientId, string consultationType, int seconds, Guid? requestId, CancellationToken ct = default)
    {
        if (seconds <= 0) return 0;

        var existing = await supabase.GetSingleAsync<TimeBankModel>(
            BankTable,
            filter: $"patient_id=eq.{patientId}&consultation_type=eq.{consultationType}",
            cancellationToken: ct);

        if (existing == null || existing.BalanceSeconds <= 0) return 0;

        var debited = Math.Min(seconds, existing.BalanceSeconds);
        var updatePayload = new TimeBankUpdatePayload
        {
            BalanceSeconds = existing.BalanceSeconds - debited,
            LastUpdatedAt = DateTime.UtcNow
        };
        await supabase.UpdateAsync<TimeBankModel>(
            BankTable,
            $"patient_id=eq.{patientId}&consultation_type=eq.{consultationType}",
            updatePayload,
            ct);

        await RecordTransactionAsync(patientId, consultationType, -debited, requestId, "used_for_consultation", ct);

        return debited;
    }

    private async Task RecordTransactionAsync(Guid patientId, string consultationType, int deltaSeconds, Guid? requestId, string reason, CancellationToken ct)
    {
        var tx = new TimeBankTransactionModel
        {
            Id = Guid.NewGuid(),
            PatientId = patientId,
            RequestId = requestId,
            ConsultationType = consultationType,
            DeltaSeconds = deltaSeconds,
            Reason = reason,
            CreatedAt = DateTime.UtcNow
        };
        await supabase.InsertAsync<TimeBankTransactionModel>(TxTable, tx, ct);
    }

    private class TimeBankModel
    {
        public Guid Id { get; set; }
        [JsonPropertyName("patient_id")]
        public Guid PatientId { get; set; }
        [JsonPropertyName("consultation_type")]
        public string ConsultationType { get; set; } = string.Empty;
        [JsonPropertyName("balance_seconds")]
        public int BalanceSeconds { get; set; }
        [JsonPropertyName("last_updated_at")]
        public DateTime LastUpdatedAt { get; set; }
        [JsonPropertyName("created_at")]
        public DateTime CreatedAt { get; set; }
    }

    private class TimeBankUpdatePayload
    {
        [JsonPropertyName("balance_seconds")]
        public int BalanceSeconds { get; set; }
        [JsonPropertyName("last_updated_at")]
        public DateTime LastUpdatedAt { get; set; }
    }

    private class TimeBankTransactionModel
    {
        public Guid Id { get; set; }
        [JsonPropertyName("patient_id")]
        public Guid PatientId { get; set; }
        [JsonPropertyName("request_id")]
        public Guid? RequestId { get; set; }
        [JsonPropertyName("consultation_type")]
        public string ConsultationType { get; set; } = string.Empty;
        [JsonPropertyName("delta_seconds")]
        public int DeltaSeconds { get; set; }
        public string Reason { get; set; } = string.Empty;
        [JsonPropertyName("created_at")]
        public DateTime CreatedAt { get; set; }
    }
}
