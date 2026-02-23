using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Registra e atualiza linhas na tabela 'prescriptions' do Supabase para o fluxo Verify v2.
/// Usa upsert (merge-duplicates) para ser idempotente em caso de retry.
/// </summary>
public class PrescriptionVerifyRepository(
    SupabaseClient supabase,
    ILogger<PrescriptionVerifyRepository> logger) : IPrescriptionVerifyRepository
{
    private const string TableName = "prescriptions";

    public async Task UpsertAsync(PrescriptionVerifyRecord record, CancellationToken ct = default)
    {
        var model = new PrescriptionVerifyModel
        {
            Id = record.Id,
            Status = record.Status,
            IssuedAt = record.IssuedAt,
            IssuedDateStr = record.IssuedDateStr,
            PatientInitials = record.PatientInitials,
            PrescriberCrmUf = record.PrescriberCrmUf,
            PrescriberCrmLast4 = record.PrescriberCrmLast4,
            VerifyCodeHash = record.VerifyCodeHash,
            PdfStoragePath = record.PdfStoragePath,
        };

        try
        {
            await supabase.UpsertAsync(TableName, model, ct);
            logger.LogInformation("Prescrição {Id} registrada na tabela verify (path: {Path})", record.Id, record.PdfStoragePath);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Falha ao registrar prescrição {Id} na tabela verify", record.Id);
            throw;
        }
    }

    public async Task<bool> ValidateVerifyCodeAsync(Guid requestId, string code, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code) || (code.Length != 4 && code.Length != 6))
            return false;

        var row = await supabase.GetSingleAsync<PrescriptionVerifyRow>(
            TableName,
            "verify_code_hash",
            $"id=eq.{requestId}",
            ct);

        if (row?.VerifyCodeHash == null)
            return false;

        var codeHash = await Task.Run(() => Sha256Hex(code.Trim()), ct);
        return string.Equals(codeHash, row.VerifyCodeHash, StringComparison.OrdinalIgnoreCase);
    }

    private static string Sha256Hex(string input)
    {
        var bytes = Encoding.UTF8.GetBytes(input);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private sealed class PrescriptionVerifyRow
    {
        [JsonPropertyName("verify_code_hash")]
        public string? VerifyCodeHash { get; init; }
    }

    private sealed class PrescriptionVerifyModel
    {
        [JsonPropertyName("id")]
        public Guid Id { get; init; }

        [JsonPropertyName("status")]
        public string Status { get; init; } = "active";

        [JsonPropertyName("issued_at")]
        public DateTime IssuedAt { get; init; }

        [JsonPropertyName("issued_date_str")]
        public string IssuedDateStr { get; init; } = "";

        [JsonPropertyName("patient_initials")]
        public string PatientInitials { get; init; } = "";

        [JsonPropertyName("prescriber_crm_uf")]
        public string PrescriberCrmUf { get; init; } = "";

        [JsonPropertyName("prescriber_crm_last4")]
        public string PrescriberCrmLast4 { get; init; } = "";

        [JsonPropertyName("verify_code_hash")]
        public string VerifyCodeHash { get; init; } = "";

        [JsonPropertyName("pdf_storage_path")]
        public string PdfStoragePath { get; init; } = "";
    }
}
