using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using System.Security.Cryptography;
using System.Text;

namespace RenoveJa.Application.Services;

/// <summary>
/// Controle antifraude de documentos médicos:
/// - Cálculo automático de validade (expires_at)
/// - Dispensação (marcar como usado na farmácia)
/// - Verificação universal (receitas, atestados, exames)
/// - Log de acesso (auditoria LGPD)
/// </summary>
public class DocumentSecurityService(
    IDocumentAccessLogRepository accessLogRepository,
    IMedicalDocumentRepository medicalDocumentRepository,
    ILogger<DocumentSecurityService> logger)
    : IDocumentSecurityService
{
    /// <summary>
    /// Calcula a data de validade baseada no tipo de documento.
    /// Receita simples: 6 meses. Controlada: 30 dias. Antimicrobiana: 10 dias.
    /// Atestado: data de emissão (não expira). Exame: 6 meses.
    /// </summary>
    public DateTime CalculateExpiresAt(DocumentType docType, string? prescriptionKind, DateTime issuedAt)
    {
        return (docType, prescriptionKind?.ToLowerInvariant()) switch
        {
            (DocumentType.Prescription, "controlled_special" or "controlado") => issuedAt.AddDays(30),
            (DocumentType.Prescription, "antimicrobial" or "antimicrobiano") => issuedAt.AddDays(10),
            (DocumentType.Prescription, _) => issuedAt.AddMonths(6),
            (DocumentType.ExamOrder, _) => issuedAt.AddMonths(6),
            (DocumentType.MedicalCertificate, _) => issuedAt.AddYears(5), // Atestado não "expira" mas tem retenção
            (DocumentType.MedicalReport, _) => issuedAt.AddYears(5),
            _ => issuedAt.AddMonths(6)
        };
    }

    /// <summary>
    /// Calcula max_dispenses baseado no tipo.
    /// Controlada/antimicrobiana: 1 uso. Simples: 1 uso (padrão brasileiro).
    /// </summary>
    public int CalculateMaxDispenses(DocumentType docType, string? prescriptionKind)
    {
        return (docType, prescriptionKind?.ToLowerInvariant()) switch
        {
            (DocumentType.Prescription, "controlled_special" or "controlado") => 1,
            (DocumentType.Prescription, "antimicrobial" or "antimicrobiano") => 1,
            (DocumentType.Prescription, _) => 1, // Receita simples: uso único (padrão ANVISA)
            (DocumentType.MedicalCertificate, _) => 1,
            _ => 1
        };
    }

    /// <summary>
    /// Gera código de acesso de 6 dígitos + hash para verificação.
    /// </summary>
    public (string code, string hash) GenerateVerifyCode()
    {
        // FIX B25: Use cryptographic RNG instead of Random.Shared for security-sensitive verification codes
        var code = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code))).ToLowerInvariant();
        return (code, hash);
    }

    /// <summary>
    /// Valida código de verificação contra o hash armazenado.
    /// </summary>
    public bool ValidateVerifyCode(string code, string storedHash)
    {
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(storedHash)) return false;
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code.Trim()))).ToLowerInvariant();
        // FIX B26: Use constant-time comparison to prevent timing attacks
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(hash),
            Encoding.UTF8.GetBytes(storedHash.ToLowerInvariant()));
    }

    /// <summary>
    /// Registra dispensação do documento (farmacêutico verificou + dispensou).
    /// Retorna erro se já atingiu max_dispenses.
    /// </summary>
    public async Task<(bool success, string? error)> RecordDispensationAsync(
        Guid documentId, string dispensedBy, string? pharmacistName, string? pharmacistCrf, string? ip, CancellationToken ct)
    {
        var securityFields = await medicalDocumentRepository.GetSecurityFieldsAsync(documentId, ct);
        if (securityFields != null)
        {
            var (_, _, _, dispensedCount, maxDispenses) = securityFields.Value;
            if (dispensedCount >= maxDispenses)
            {
                logger.LogWarning("Document {DocumentId} already dispensed {Count}/{Max} times",
                    documentId, dispensedCount, maxDispenses);
                return (false, $"Documento j\u00e1 foi dispensado o n\u00famero m\u00e1ximo de vezes ({maxDispenses}).");
            }
        }

        await accessLogRepository.LogAccessAsync(DocumentAccessEntry.Create(
            documentId: documentId,
            requestId: null,
            userId: null,
            action: "dispensed",
            actorType: "pharmacist",
            ipAddress: ip,
            metadata: System.Text.Json.JsonSerializer.Serialize(new
            {
                dispensed_by = dispensedBy,
                pharmacist_name = pharmacistName,
                pharmacist_crf = pharmacistCrf
            })
        ), ct);

        logger.LogInformation("Document {DocumentId} dispensed by {Pharmacy} (pharmacist: {Pharmacist}, CRF: {Crf})",
            documentId, dispensedBy, pharmacistName ?? "N/A", pharmacistCrf ?? "N/A");
        return (true, null);
    }

    /// <summary>
    /// Loga acesso a documento (download, visualização, verificação).
    /// </summary>
    public async Task LogAccessAsync(
        Guid? documentId, Guid? requestId, Guid? userId,
        string action, string actorType, string? ip, string? userAgent,
        CancellationToken ct)
    {
        await accessLogRepository.LogAccessAsync(DocumentAccessEntry.Create(
            documentId: documentId,
            requestId: requestId,
            userId: userId,
            action: action,
            actorType: actorType,
            ipAddress: ip,
            userAgent: userAgent
        ), ct);
    }
}
