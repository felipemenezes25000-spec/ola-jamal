using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Log de verificações e downloads de receitas (anti-fraude, auditoria LGPD).
/// </summary>
public class PrescriptionVerificationLogRepository(
    PostgresClient db,
    ILogger<PrescriptionVerificationLogRepository> logger) : IPrescriptionVerificationLogRepository
{
    private const string TableName = "prescription_verification_logs";

    public async Task LogAsync(Guid prescriptionId, string action, string outcome, string? ipAddress, string? userAgent, CancellationToken ct = default)
    {
        try
        {
            var model = new VerificationLogModel
            {
                Id = Guid.NewGuid(),
                PrescriptionId = prescriptionId,
                Action = action,
                Outcome = outcome,
                IpAddress = ipAddress != null && ipAddress.Length > 256 ? ipAddress[..256] : ipAddress,
                UserAgent = userAgent != null && userAgent.Length > 512 ? userAgent[..512] : userAgent,
                CreatedAt = DateTime.UtcNow,
            };
            await db.InsertAsync<VerificationLogModel>(TableName, model, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falha ao registrar log de verificação prescriptionId={PrescriptionId} action={Action}", prescriptionId, action);
        }
    }

    public async Task<int> GetDownloadCountAsync(Guid prescriptionId, CancellationToken ct = default)
    {
        var filter = $"prescription_id=eq.{prescriptionId}&action=eq.download&outcome=eq.success";
        return await db.CountAsync(TableName, filter, ct);
    }

    private sealed class VerificationLogModel
    {
        [JsonPropertyName("id")]
        public Guid Id { get; init; }

        [JsonPropertyName("prescription_id")]
        public Guid PrescriptionId { get; init; }

        [JsonPropertyName("action")]
        public string Action { get; init; } = "";

        [JsonPropertyName("outcome")]
        public string Outcome { get; init; } = "";

        [JsonPropertyName("ip_address")]
        public string? IpAddress { get; init; }

        [JsonPropertyName("user_agent")]
        public string? UserAgent { get; init; }

        [JsonPropertyName("created_at")]
        public DateTime CreatedAt { get; init; }
    }
}
