using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.DTOs.Video;
using RenoveJa.Application.Helpers;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Application.Services.Requests;

/// <summary>
/// Métodos utilitários estáticos compartilhados entre os serviços de Request.
/// Extraídos do RequestService para permitir reutilização sem duplicação.
/// </summary>
internal static class RequestHelpers
{
    internal static readonly HashSet<string> NameConjunctions =
        new(StringComparer.OrdinalIgnoreCase) { "da", "de", "do", "dos", "das", "e" };

    internal static readonly HashSet<RequestStatus> CancellableStatuses =
    [
        RequestStatus.Submitted,
        RequestStatus.InReview,
        RequestStatus.ApprovedPendingPayment,
#pragma warning disable CS0618 // Status legado: permitir cancelamento de pedidos antigos
        RequestStatus.PendingPayment,
#pragma warning restore CS0618
        RequestStatus.SearchingDoctor
    ];

    /// <summary>Converte string da API (simples, controlado, azul ou simple, controlled, blue) para enum.</summary>
    internal static PrescriptionType ParsePrescriptionType(string? value)
    {
        var v = value?.Trim().ToLowerInvariant() ?? "";
        return v switch
        {
            "simples" => PrescriptionType.Simple,
            "controlado" => PrescriptionType.Controlled,
            "azul" => PrescriptionType.Blue,
            "simple" => PrescriptionType.Simple,
            "controlled" => PrescriptionType.Controlled,
            "blue" => PrescriptionType.Blue,
            _ => throw new ArgumentException($"Tipo de receita inválido: '{value}'. Use: simples, controlado ou azul.", nameof(value))
        };
    }

    /// <summary>Extrai código CID-10 da anamnese JSON — usa a primeira hipótese do diagnostico_diferencial com probabilidade mais alta. Retorna até 10 caracteres.</summary>
    internal static string? ExtractIcd10FromAnamnesis(string? anamnesisJson, ILogger? logger = null)
    {
        if (string.IsNullOrWhiteSpace(anamnesisJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(anamnesisJson);
            var root = doc.RootElement;

            // Extrair do primeiro item do diagnostico_diferencial (ordenado por probabilidade pela IA)
            if (root.TryGetProperty("diagnostico_diferencial", out var ddEl) && ddEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var dd in ddEl.EnumerateArray())
                {
                    if (dd.TryGetProperty("cid", out var cidProp) && cidProp.ValueKind == JsonValueKind.String)
                    {
                        var cidStr = cidProp.GetString()?.Trim();
                        if (string.IsNullOrEmpty(cidStr)) continue;
                        var code = cidStr.Split(new[] { ' ', '-', '—' }, 2, StringSplitOptions.RemoveEmptyEntries)[0];
                        return code.Length > 10 ? code[..10] : code;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger?.LogDebug(ex, "ExtractIcd10FromAnamnesis: JSON inválido ou sem diagnostico_diferencial");
        }
        return null;
    }

    /// <summary>
    /// Monta o conteúdo .txt da transcrição. Garante que a transcrição saia inteira:
    /// 1) Sempre inclui o texto completo (TranscriptText) como fonte de verdade.
    /// 2) Se houver segmentos com tempo, acrescenta a versão "por tempo" para referência.
    /// Usa consultation_started_at como baseline; se null, usa o primeiro segmento.
    /// </summary>
    internal static string? BuildTranscriptTxtContent(ConsultationSessionData sessionData, DateTime? consultationStartedAt)
    {
        var fullText = sessionData.TranscriptText?.Trim();
        var segments = sessionData.TranscriptSegments;

        if (segments == null || segments.Count == 0)
            return string.IsNullOrEmpty(fullText) ? null : fullText;

        var sb = new StringBuilder();
        sb.Append("=== TRANSCRIÇÃO COMPLETA ===\n\n");
        sb.AppendLine(string.IsNullOrEmpty(fullText) ? "(sem texto)" : fullText);

        var baseline = consultationStartedAt?.ToUniversalTime()
            ?? segments[0].ReceivedAtUtc;
        sb.Append("\n\n=== POR TEMPO (referência) ===\n\n");
        foreach (var seg in segments)
        {
            double elapsedSeconds;
            if (seg.StartTimeSeconds.HasValue && seg.StartTimeSeconds.Value >= 0)
                elapsedSeconds = seg.StartTimeSeconds.Value;
            else
                elapsedSeconds = Math.Max(0, (seg.ReceivedAtUtc - baseline).TotalSeconds);
            var minutes = (int)(elapsedSeconds / 60);
            var seconds = (int)(elapsedSeconds % 60);
            sb.AppendLine($"{seg.Speaker} minuto {minutes} segundo {seconds} {seg.Text}");
        }
        return sb.ToString().TrimEnd();
    }

    /// <summary>Retorna a data/hora atual em horário de Brasília (America/Sao_Paulo), com fallback para UTC.</summary>
    internal static DateTime GetBrazilNow() => BrazilDateTime.Now;

    internal static string GenerateAutoObservation(
        RequestType requestType,
        PrescriptionType? prescriptionType = null,
        string? examType = null)
    {
        return (requestType, prescriptionType?.ToString()?.ToLowerInvariant(), examType?.ToLowerInvariant()) switch
        {
            (RequestType.Prescription, "controlled", _) =>
                "Paciente orientado sobre a importância do retorno regular ao médico que acompanha o tratamento de medicação controlada. A renovação digital é um recurso de conveniência e não substitui a avaliação presencial periódica, obrigatória para medicamentos com controle especial.",
            (RequestType.Prescription, "blue", _) =>
                "Solicitação de renovação de medicação de alta vigilância (receita azul). Paciente orientado sobre o acompanhamento rigoroso necessário com o médico prescritor. Renovação digital não substitui avaliação clínica presencial — a continuidade do tratamento deve ser avaliada periodicamente.",
            (RequestType.Prescription, _, _) =>
                "Paciente orientado sobre a importância do retorno ao médico que acompanha o tratamento. A renovação digital é conveniência — não substitui o seguimento clínico contínuo. Recomenda-se retorno médico para reavaliação.",
            (RequestType.Exam, _, "imagem") =>
                "Solicitação de exame de imagem para complementação diagnóstica. Paciente orientado a retornar ao médico solicitante com o resultado para definição de conduta. Exames de imagem requerem interpretação clínica especializada.",
            (RequestType.Exam, _, _) =>
                "Solicitação de exames para complementação ou investigação diagnóstica. Paciente orientado sobre a importância de retornar ao médico solicitante com os resultados, garantindo a segurança e a continuidade do cuidado.",
            (RequestType.Consultation, _, _) =>
                "Teleconsulta realizada para orientação, esclarecimento de dúvidas e suporte ao cuidado. Paciente orientado de que a consulta digital complementa, mas não substitui, o acompanhamento presencial com o médico de referência quando indicado.",
            _ => "Paciente orientado a manter acompanhamento regular com seu médico de referência.",
        };
    }

    /// <summary>Monta o endereço do paciente para o PDF (rua, número, complemento - bairro, cidade - UF).</summary>
    internal static string? FormatPatientAddress(User? user)
    {
        if (user == null) return null;
        if (!string.IsNullOrWhiteSpace(user.Street) || !string.IsNullOrWhiteSpace(user.Number) || !string.IsNullOrWhiteSpace(user.Neighborhood))
        {
            var logradouro = new List<string>();
            if (!string.IsNullOrWhiteSpace(user.Street)) logradouro.Add(user.Street.Trim());
            if (!string.IsNullOrWhiteSpace(user.Number)) logradouro.Add(user.Number.Trim());
            if (!string.IsNullOrWhiteSpace(user.Complement)) logradouro.Add(user.Complement.Trim());
            var linha1 = string.Join(", ", logradouro);
            var resto = new List<string>();
            if (!string.IsNullOrWhiteSpace(user.Neighborhood)) resto.Add(user.Neighborhood.Trim());
            if (!string.IsNullOrWhiteSpace(user.City)) resto.Add(user.City.Trim());
            if (!string.IsNullOrWhiteSpace(user.State)) resto.Add(user.State.Trim().ToUpperInvariant());
            var s = string.IsNullOrEmpty(linha1) ? string.Join(", ", resto) : resto.Count > 0 ? $"{linha1} - {string.Join(", ", resto)}" : linha1;
            return string.IsNullOrWhiteSpace(s) ? null : s;
        }
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(user.Address)) parts.Add(user.Address.Trim());
        if (!string.IsNullOrWhiteSpace(user.City)) parts.Add(user.City.Trim());
        if (!string.IsNullOrWhiteSpace(user.State)) parts.Add(user.State.Trim().ToUpperInvariant());
        if (parts.Count == 0) return null;
        if (parts.Count == 1) return parts[0];
        if (parts.Count == 2) return $"{parts[0]}, {parts[1]}";
        return $"{parts[0]}, {parts[1]} - {parts[2]}";
    }

    internal static string? PrescriptionTypeToDisplay(PrescriptionType? type) => type switch
    {
        PrescriptionType.Simple => "simples",
        PrescriptionType.Controlled => "controlado",
        PrescriptionType.Blue => "azul",
        _ => null
    };

    /// <summary>Label amigável do tipo para mensagem de rejeição (ex: "de controle especial").</summary>
    internal static string PrescriptionTypeToRejectionLabel(string? type) => type?.ToLowerInvariant() switch
    {
        "simples" => "simples",
        "controlado" => "de controle especial",
        "azul" => "azul/antimicrobiana",
        _ => type ?? "desconhecido"
    };

    /// <summary>Verifica se o nome do documento corresponde ao nome cadastrado (primeiro e último nome devem bater).</summary>
    internal static bool PatientNamesMatch(string? registeredName, string? documentName)
    {
        if (string.IsNullOrWhiteSpace(registeredName) || string.IsNullOrWhiteSpace(documentName))
            return true;
        var regWords = GetSignificantNameWords(registeredName);
        var docWords = GetSignificantNameWords(documentName);
        if (regWords.Count == 0 || docWords.Count == 0)
            return true;
        var firstReg = regWords[0];
        var lastReg = regWords[^1];
        var firstDoc = docWords[0];
        var lastDoc = docWords[^1];
        return string.Equals(firstReg, firstDoc, StringComparison.OrdinalIgnoreCase) &&
               string.Equals(lastReg, lastDoc, StringComparison.OrdinalIgnoreCase);
    }

    internal static List<string> GetSignificantNameWords(string name)
    {
        var normalized = RemoveAccents(name.Trim().ToLowerInvariant());
        return normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => !NameConjunctions.Contains(w) && w.Length >= 2)
            .ToList();
    }

    internal static string RemoveAccents(string text)
    {
        var formD = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in formD)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    internal static string GenerateAccessCode(Guid requestId)
    {
        var bytes = SHA256.HashData(requestId.ToByteArray());
        var value = BitConverter.ToUInt32(bytes, 0) % 1_000_000;
        return value.ToString("D6");
    }

    internal static string ComputeSha256(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    internal static string GetInitials(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "??";
        var parts = name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 1) return parts[0][..Math.Min(2, parts[0].Length)].ToUpperInvariant();
        return $"{parts[0][0]}{parts[^1][0]}".ToUpperInvariant();
    }

    internal static string GetLast4(string? crm)
    {
        if (string.IsNullOrWhiteSpace(crm)) return "0000";
        var digits = new string(crm.Where(char.IsDigit).ToArray());
        return digits.Length >= 4 ? digits[^4..] : digits.PadLeft(4, '0');
    }

    internal static PrescriptionKind? ParsePrescriptionKind(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var v = value.Trim().Replace("-", "_");
        try
        {
            return EnumHelper.ParseSnakeCase<PrescriptionKind>(v);
        }
        catch
        {
            return null;
        }
    }

    internal static string? MaskCpf(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return null;
        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        if (digits.Length != 11) return null;
        return $"***.***.***-{digits[^2]}{digits[^1]}";
    }

    /// <summary>Extrai medicamentos do JSON extraído pela IA (extracted.medications).</summary>
    internal static List<string> ParseMedicationsFromAiJson(string aiExtractedJson, ILogger? logger = null)
    {
        var result = new List<string>();
        try
        {
            using var doc = JsonDocument.Parse(aiExtractedJson);
            var root = doc.RootElement;
            if (root.TryGetProperty("medications", out var meds) && meds.ValueKind == JsonValueKind.Array)
            {
                foreach (var m in meds.EnumerateArray())
                {
                    var s = m.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(s))
                        result.Add(s);
                }
            }
        }
        catch (Exception ex)
        {
            logger?.LogDebug(ex, "ParseMedicationsFromAiJson: JSON inválido ou sem medications array");
        }
        return result;
    }

    internal static VideoRoomResponseDto MapVideoRoomToDto(VideoRoom room)
    {
        return new VideoRoomResponseDto(
            room.Id,
            room.RequestId,
            room.RoomName,
            room.RoomUrl,
            EnumHelper.ToSnakeCase(room.Status),
            room.StartedAt,
            room.EndedAt,
            room.DurationSeconds,
            room.CreatedAt);
    }

    /// <summary>
    /// Mapeia MedicalRequest para RequestResponseDto, gerando URLs proxy para imagens e documento assinado.
    /// </summary>
    internal static RequestResponseDto MapRequestToDto(
        MedicalRequest request,
        string apiBaseUrl,
        IDocumentTokenService documentTokenService,
        string? consultationTranscript = null,
        string? consultationAnamnesis = null,
        string? consultationAiSuggestions = null,
        string? consultationEvidence = null,
        string? consultationSoapNotes = null,
        bool consultationHasRecording = false,
        DateTime? patientBirthDate = null,
        string? patientGender = null,
        IReadOnlyList<ExamQuickPackageDto>? examQuickPackages = null)
    {
        var signedUrl = request.SignedDocumentUrl;
        if (!string.IsNullOrWhiteSpace(apiBaseUrl) && !string.IsNullOrWhiteSpace(signedUrl))
        {
            var baseUrl = $"{apiBaseUrl.TrimEnd('/')}/api/requests/{request.Id}/document";
            var docToken = documentTokenService.GenerateDocumentToken(request.Id, 15);
            if (!string.IsNullOrEmpty(docToken))
                signedUrl = $"{baseUrl}?token={Uri.EscapeDataString(docToken)}";
        }

        var prescriptionImages = ToProxyImageUrls(request.Id, request.PrescriptionImages, "prescription", apiBaseUrl, documentTokenService);
        var examImages = ToProxyImageUrls(request.Id, request.ExamImages, "exam", apiBaseUrl, documentTokenService);

        return new RequestResponseDto(
            request.Id,
            request.PatientId,
            request.PatientName,
            request.DoctorId,
            request.DoctorName,
            EnumHelper.ToSnakeCase(request.RequestType),
            EnumHelper.ToSnakeCase(request.Status),
            PrescriptionTypeToDisplay(request.PrescriptionType),
            request.PrescriptionKind.HasValue ? EnumHelper.ToSnakeCase(request.PrescriptionKind.Value) : null,
            request.Medications.Count > 0 ? request.Medications : null,
            prescriptionImages.Count > 0 ? prescriptionImages : null,
            request.ExamType,
            request.Exams.Count > 0 ? request.Exams : null,
            examImages.Count > 0 ? examImages : null,
            request.Symptoms,
            request.Notes,
            request.RejectionReason,
            request.AccessCode,
            request.SignedAt,
            signedUrl,
            request.SignatureId,
            request.CreatedAt,
            request.UpdatedAt,
            request.AiSummaryForDoctor,
            request.AiExtractedJson,
            request.AiRiskLevel,
            request.AiUrgency,
            request.AiReadabilityOk,
            request.AiMessageToUser,
            consultationTranscript,
            consultationAnamnesis,
            consultationAiSuggestions,
            consultationEvidence,
            consultationSoapNotes,
            consultationHasRecording,
            request.ConsultationType,
            request.ContractedMinutes,
            request.ConsultationStartedAt,
            request.AutoObservation,
            request.DoctorConductNotes,
            request.IncludeConductInPdf,
            request.AiConductSuggestion,
            request.AiSuggestedExams,
            request.ConductUpdatedAt,
            request.ConductUpdatedBy,
            patientBirthDate,
            patientGender,
            examQuickPackages);
    }

    internal static List<string> ToProxyImageUrls(Guid requestId, List<string> urls, string imageType, string apiBaseUrl, IDocumentTokenService documentTokenService)
    {
        if (urls == null || urls.Count == 0)
            return new List<string>();
        if (string.IsNullOrWhiteSpace(apiBaseUrl))
            return urls;
        var docToken = documentTokenService.GenerateDocumentToken(requestId, 60);
        if (string.IsNullOrEmpty(docToken))
            return urls;
        var baseUrl = $"{apiBaseUrl.TrimEnd('/')}/api/requests/{requestId}/{imageType}-image";
        var result = new List<string>(urls.Count);
        for (var i = 0; i < urls.Count; i++)
            result.Add($"{baseUrl}/{i}?token={Uri.EscapeDataString(docToken)}");
        return result;
    }
}
