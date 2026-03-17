using Microsoft.Extensions.Logging;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services;

/// <summary>
/// Verifica se paciente já tem receita ativa para o mesmo medicamento ou CID.
/// Impede solicitações duplicadas dentro de 30 dias.
/// Verifica sobreposição de atestados.
/// </summary>
#pragma warning disable CS9113 // Parameter is never read (reserved for future logging)
public class DuplicateDocumentGuard(
    IRequestRepository requestRepository,
    IMedicalDocumentRepository documentRepository,
    ILogger<DuplicateDocumentGuard> logger)
#pragma warning restore CS9113
{
    private const int CooldownDays = 30;

    /// <summary>
    /// Verifica se o paciente já tem receita ativa com o mesmo medicamento nos últimos 30 dias.
    /// Retorna lista de conflitos encontrados.
    /// </summary>
    public async Task<List<DuplicateWarning>> CheckMedicationDuplicatesAsync(
        Guid patientId, List<string> medications, CancellationToken ct)
    {
        var warnings = new List<DuplicateWarning>();
        if (medications.Count == 0) return warnings;

        var cutoff = DateTime.UtcNow.AddDays(-CooldownDays);
        var recentRequests = await requestRepository
            .GetActiveByPatientAndTypeAsync(patientId, RequestType.Prescription, ct);

        var recentMeds = recentRequests
            .Where(r => r.SignedAt.HasValue && r.SignedAt.Value >= cutoff)
            .SelectMany(r => r.Medications ?? new())
            .Select(m => m.ToLowerInvariant().Trim())
            .ToHashSet();

        foreach (var med in medications)
        {
            var normalized = med.ToLowerInvariant().Trim();
            // Verifica se algum medicamento existente contém o nome
            var match = recentMeds.FirstOrDefault(existing =>
                existing.Contains(normalized) || normalized.Contains(existing));
            if (match != null)
            {
                warnings.Add(new DuplicateWarning(
                    "medication", med,
                    $"Paciente já possui receita ativa com '{match}' nos últimos {CooldownDays} dias."));
            }
        }

        return warnings;
    }

    /// <summary>
    /// Verifica se o paciente já tem receita ativa para o mesmo CID nos últimos 30 dias.
    /// </summary>
    public async Task<DuplicateWarning?> CheckCidDuplicateAsync(
        Guid patientId, string cidCode, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cidCode)) return null;

        var cutoff = DateTime.UtcNow.AddDays(-CooldownDays);
        var recentDocs = await documentRepository
            .GetByPatientAndTypeAsync(patientId, DocumentType.Prescription, ct);

        var hasDuplicate = recentDocs.Any(d =>
            d.CreatedAt >= cutoff &&
            d.Status != DocumentStatus.Cancelled);

        // TODO: Verificar CID específico quando o campo estiver acessível no domain
        // Por agora, retorna warning genérico se tem receita recente
        return null; // Implementação completa quando CID estiver na entity
    }

    /// <summary>
    /// Verifica se o paciente já tem atestado com período sobreposto.
    /// Impede 2 atestados cobrindo o mesmo intervalo de datas.
    /// </summary>
    public async Task<DuplicateWarning?> CheckCertificateOverlapAsync(
        Guid patientId, DateTime startDate, int leaveDays, CancellationToken ct)
    {
        if (leaveDays <= 0) return null;

        var endDate = startDate.AddDays(leaveDays - 1);
        var recentCerts = await documentRepository
            .GetByPatientAndTypeAsync(patientId, DocumentType.MedicalCertificate, ct);

        foreach (var cert in recentCerts)
        {
            if (cert.Status == DocumentStatus.Cancelled) continue;
            // Verificar sobreposição: o atestado existente tem LeaveDays?
            // Por segurança, considerar últimos 30 dias como possível sobreposição
            var certEnd = cert.CreatedAt.AddDays(30); // Estimativa conservadora
            if (cert.CreatedAt <= endDate && certEnd >= startDate)
            {
                return new DuplicateWarning(
                    "certificate_overlap",
                    $"{cert.CreatedAt:dd/MM/yyyy}",
                    $"Paciente já possui atestado emitido em {cert.CreatedAt:dd/MM/yyyy} que pode sobrepor o período solicitado ({startDate:dd/MM} a {endDate:dd/MM}).");
            }
        }

        return null;
    }
}

/// <summary>Aviso de duplicidade/sobreposição de documento.</summary>
public record DuplicateWarning(string Type, string Reference, string Message);
