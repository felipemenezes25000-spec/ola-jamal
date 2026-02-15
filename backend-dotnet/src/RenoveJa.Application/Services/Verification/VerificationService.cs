using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.DTOs.Verification;
using RenoveJa.Application.Helpers;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Verification;

/// <summary>
/// Implementação do serviço de verificação pública de receitas.
/// Mascara dados sensíveis e valida código de acesso.
/// </summary>
public class VerificationService(
    IRequestRepository requestRepository,
    IDoctorRepository doctorRepository,
    IUserRepository userRepository,
    ILogger<VerificationService> logger) : IVerificationService
{
    private const string ItiVerificationUrl = "https://validar.iti.gov.br";

    /// <summary>
    /// Obtém dados públicos da receita para verificação.
    /// Mascara dados sensíveis (nome parcial do paciente, sem CPF).
    /// </summary>
    public async Task<VerificationPublicDto?> GetPublicVerificationAsync(
        Guid requestId,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null)
            return null;

        var (doctorCrm, doctorCrmState, doctorSpecialty) = await GetDoctorInfoAsync(request.DoctorId, cancellationToken);

        var maskedPatientName = MaskPatientName(request.PatientName);
        var prescriptionTypeDisplay = PrescriptionTypeToDisplay(request.PrescriptionType);
        var statusDisplay = StatusToDisplay(request.Status);
        var signatureInfo = BuildSignatureInfo(request);

        return new VerificationPublicDto(
            RequestId: request.Id,
            DoctorName: request.DoctorName,
            DoctorCrm: doctorCrm,
            DoctorCrmState: doctorCrmState,
            DoctorSpecialty: doctorSpecialty,
            PatientName: maskedPatientName,
            PrescriptionType: prescriptionTypeDisplay,
            Medications: request.Medications.Count > 0 ? request.Medications : null,
            EmissionDate: request.CreatedAt,
            Status: statusDisplay,
            SignedAt: request.SignedAt,
            SignatureInfo: signatureInfo,
            VerificationUrl: ItiVerificationUrl,
            AccessCodeRequired: true
        );
    }

    /// <summary>
    /// Obtém dados completos da receita após validar o código de acesso.
    /// Retorna null se a receita não existir, e lança exceção se o código for inválido.
    /// </summary>
    public async Task<VerificationFullDto?> GetFullVerificationAsync(
        Guid requestId,
        string accessCode,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null)
            return null;

        // Verifica AccessCode: primeiro tenta o código salvo na request, depois fallback determinístico
        var codeValid = !string.IsNullOrWhiteSpace(request.AccessCode)
            ? ValidateAccessCode(request.AccessCode, accessCode)
            : ValidateAccessCode(requestId, accessCode);

        if (!codeValid)
        {
            logger.LogWarning("Código de acesso inválido para receita {RequestId}", requestId);
            throw new UnauthorizedAccessException("Código de acesso inválido.");
        }

        var (doctorCrm, doctorCrmState, doctorSpecialty) = await GetDoctorInfoAsync(request.DoctorId, cancellationToken);
        var maskedCpf = await GetMaskedPatientCpfAsync(request.PatientId, cancellationToken);
        var prescriptionTypeDisplay = PrescriptionTypeToDisplay(request.PrescriptionType);
        var statusDisplay = StatusToDisplay(request.Status);
        var signatureInfo = BuildSignatureInfo(request);

        return new VerificationFullDto(
            RequestId: request.Id,
            DoctorName: request.DoctorName,
            DoctorCrm: doctorCrm,
            DoctorCrmState: doctorCrmState,
            DoctorSpecialty: doctorSpecialty,
            PatientFullName: request.PatientName,
            PatientCpfMasked: maskedCpf,
            PrescriptionType: prescriptionTypeDisplay,
            Medications: request.Medications.Count > 0 ? request.Medications : null,
            Notes: request.Notes,
            EmissionDate: request.CreatedAt,
            Status: statusDisplay,
            SignedAt: request.SignedAt,
            SignatureInfo: signatureInfo,
            SignedDocumentUrl: request.SignedDocumentUrl,
            VerificationUrl: ItiVerificationUrl,
            AiExtractedJson: request.AiExtractedJson
        );
    }

    /// <summary>
    /// Valida o código de acesso para uma receita.
    /// Primeiro tenta comparar com o AccessCode salvo na entidade MedicalRequest.
    /// Fallback: gera deterministicamente a partir do requestId (retrocompatibilidade).
    /// </summary>
    public bool ValidateAccessCode(Guid requestId, string accessCode)
    {
        if (string.IsNullOrWhiteSpace(accessCode))
            return false;

        var expectedCode = GenerateAccessCode(requestId);
        return string.Equals(accessCode.Trim(), expectedCode, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Valida o código de acesso comparando com o código armazenado na request.
    /// </summary>
    public static bool ValidateAccessCode(string? storedCode, string accessCode)
    {
        if (string.IsNullOrWhiteSpace(storedCode) || string.IsNullOrWhiteSpace(accessCode))
            return false;

        return string.Equals(accessCode.Trim(), storedCode.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Gera o código de acesso de 4 dígitos baseado no hash SHA256 do requestId.
    /// Determinístico: mesmo ID sempre gera o mesmo código. Usado como fallback para requests sem AccessCode salvo.
    /// </summary>
    public static string GenerateAccessCode(Guid requestId)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(requestId.ToString()));
        // Pega os últimos 2 bytes do hash e converte para 4 dígitos
        var numericValue = BitConverter.ToUInt16(hash, hash.Length - 2);
        return (numericValue % 10000).ToString("D4");
    }

    /// <summary>
    /// Mascara o nome do paciente: retorna apenas primeiro nome + último sobrenome.
    /// Ex.: "João Silva de Oliveira" → "João Oliveira"
    /// </summary>
    internal static string? MaskPatientName(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            return null;

        var parts = fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length <= 1)
            return parts[0];

        return $"{parts[0]} {parts[^1]}";
    }

    /// <summary>
    /// Mascara o CPF: "41012345616" → "410.***.***-16"
    /// </summary>
    internal static string? MaskCpf(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf))
            return null;

        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        if (digits.Length != 11)
            return "***.***.***-**";

        return $"{digits[..3]}.***.***-{digits[9..]}";
    }

    private async Task<(string? crm, string? crmState, string? specialty)> GetDoctorInfoAsync(
        Guid? doctorId,
        CancellationToken cancellationToken)
    {
        if (!doctorId.HasValue)
            return (null, null, null);

        try
        {
            var doctorProfile = await doctorRepository.GetByUserIdAsync(doctorId.Value, cancellationToken);
            if (doctorProfile != null)
                return (doctorProfile.Crm, doctorProfile.CrmState, doctorProfile.Specialty);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Erro ao buscar perfil do médico {DoctorId}", doctorId);
        }

        return (null, null, null);
    }

    private async Task<string?> GetMaskedPatientCpfAsync(Guid patientId, CancellationToken cancellationToken)
    {
        try
        {
            var user = await userRepository.GetByIdAsync(patientId, cancellationToken);
            return MaskCpf(user?.Cpf);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Erro ao buscar CPF do paciente {PatientId}", patientId);
            return null;
        }
    }

    private static string? PrescriptionTypeToDisplay(PrescriptionType? type) => type switch
    {
        PrescriptionType.Simple => "simples",
        PrescriptionType.Controlled => "controlado",
        PrescriptionType.Blue => "azul",
        _ => null
    };

    private static string StatusToDisplay(RequestStatus status) => EnumHelper.ToSnakeCase(status);

    private static string? BuildSignatureInfo(MedicalRequest request)
    {
        if (request.SignedAt == null)
            return null;

        var info = $"Assinado digitalmente em {request.SignedAt:dd/MM/yyyy HH:mm} UTC";
        if (!string.IsNullOrWhiteSpace(request.SignatureId))
            info += $" — ID da assinatura: {request.SignatureId}";

        return info;
    }
}
