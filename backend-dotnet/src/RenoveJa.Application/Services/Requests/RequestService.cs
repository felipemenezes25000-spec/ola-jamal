using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.DTOs.Video;
using RenoveJa.Application.Exceptions;
using RenoveJa.Application.Helpers;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Application.Validators;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Requests;

/// <summary>
/// Serviço de solicitações médicas: receita, exame, consulta, aprovação, rejeição, assinatura e sala de vídeo.
/// </summary>
public class RequestService(
    IRequestRepository requestRepository,
    IProductPriceRepository productPriceRepository,
    IUserRepository userRepository,
    IDoctorRepository doctorRepository,
    IVideoRoomRepository videoRoomRepository,
    IConsultationAnamnesisRepository consultationAnamnesisRepository,
    IConsultationSessionStore consultationSessionStore,
    INotificationRepository notificationRepository,
    IPushNotificationSender pushNotificationSender,
    IPushNotificationDispatcher pushDispatcher,
    IAiReadingService aiReadingService,
    IAiPrescriptionGeneratorService aiPrescriptionGenerator,
    IPrescriptionPdfService prescriptionPdfService,
    IDigitalCertificateService digitalCertificateService,
    IPrescriptionVerifyRepository prescriptionVerifyRepository,
    IHttpClientFactory httpClientFactory,
    IOptions<ApiConfig> apiConfig,
    IDocumentTokenService documentTokenService,
    IStorageService storageService,
    IConsultationTimeBankRepository consultationTimeBankRepository,
    IAiConductSuggestionService aiConductSuggestionService,
    IRequestEventsPublisher requestEventsPublisher,
    INewRequestBatchService newRequestBatchService,
    ISignedRequestClinicalSyncService signedRequestClinicalSync,
    IConsultationEncounterService consultationEncounterService,
    IPaymentRepository paymentRepository,
    IAuditService auditService,
    ILogger<RequestService> logger) : IRequestService
{
    private readonly string _apiBaseUrl = (apiConfig?.Value?.BaseUrl ?? "").Trim();

    private Task PublishRequestUpdatedAsync(MedicalRequest request, string? message = null, CancellationToken cancellationToken = default)
        => requestEventsPublisher.NotifyRequestUpdatedAsync(
            request.Id,
            request.PatientId,
            request.DoctorId,
            EnumHelper.ToSnakeCase(request.Status),
            message,
            cancellationToken);

    /// <summary>Converte string da API (simples, controlado, azul ou simple, controlled, blue) para enum.</summary>
    private static PrescriptionType ParsePrescriptionType(string? value)
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

    /// <summary>Extrai código CID-10 da anamnese JSON (cid_sugerido, cid, cidPrincipal). Retorna até 10 caracteres.</summary>
    private static string? ExtractIcd10FromAnamnesis(string? anamnesisJson)
    {
        if (string.IsNullOrWhiteSpace(anamnesisJson)) return null;
        try
        {
            var doc = JsonDocument.Parse(anamnesisJson);
            var root = doc.RootElement;
            foreach (var key in new[] { "cid_sugerido", "cid", "cidPrincipal" })
            {
                if (root.TryGetProperty(key, out var p) && p.ValueKind == JsonValueKind.String)
                {
                    var v = p.GetString()?.Trim();
                    if (string.IsNullOrEmpty(v)) continue;
                    // Extrair código (ex: "J06.9" de "J06.9 - Infecção aguda...")
                    var code = v.Split(new[] { ' ', '-', '—' }, 2, StringSplitOptions.RemoveEmptyEntries)[0];
                    return code.Length > 10 ? code[..10] : code;
                }
            }
        }
        catch { /* ignore */ }
        return null;
    }

    /// <summary>
    /// Monta o conteúdo .txt da transcrição no formato:
    /// Paciente minuto X segundo Y fala
    /// Médico minuto X segundo Y fala
    /// Usa consultation_started_at como baseline; se null, usa o primeiro segmento.
    /// </summary>
    private static string? BuildTranscriptTxtContent(ConsultationSessionData sessionData, DateTime? consultationStartedAt)
    {
        var segments = sessionData.TranscriptSegments;
        if (segments == null || segments.Count == 0)
            return sessionData.TranscriptText; // Fallback: texto bruto se não houver segmentos

        var baseline = consultationStartedAt?.ToUniversalTime()
            ?? segments[0].ReceivedAtUtc;

        var sb = new StringBuilder();
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
    private static DateTime GetBrazilNow()
    {
        try
        {
            var timeZoneId = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
                ? "E. South America Standard Time"
                : "America/Sao_Paulo";

            var tz = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        }
        catch
        {
            return DateTime.UtcNow;
        }
    }

    private static string GenerateAutoObservation(
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
    private static string? FormatPatientAddress(User? user)
    {
        if (user == null) return null;
        // Campos separados (rua, número, bairro, complemento)
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
        // Fallback: Address legado + cidade - UF
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(user.Address)) parts.Add(user.Address.Trim());
        if (!string.IsNullOrWhiteSpace(user.City)) parts.Add(user.City.Trim());
        if (!string.IsNullOrWhiteSpace(user.State)) parts.Add(user.State.Trim().ToUpperInvariant());
        if (parts.Count == 0) return null;
        if (parts.Count == 1) return parts[0];
        if (parts.Count == 2) return $"{parts[0]}, {parts[1]}";
        return $"{parts[0]}, {parts[1]} - {parts[2]}";
    }

    private static string? PrescriptionTypeToDisplay(PrescriptionType? type) => type switch
    {
        PrescriptionType.Simple => "simples",
        PrescriptionType.Controlled => "controlado",
        PrescriptionType.Blue => "azul",
        _ => null
    };

    /// <summary>Label amigável do tipo para mensagem de rejeição (ex: "de controle especial").</summary>
    private static string PrescriptionTypeToRejectionLabel(string? type) => type?.ToLowerInvariant() switch
    {
        "simples" => "simples",
        "controlado" => "de controle especial",
        "azul" => "azul/antimicrobiana",
        _ => type ?? "desconhecido"
    };

    /// <summary>Verifica se o nome do documento corresponde ao nome cadastrado (primeiro e último nome devem bater).</summary>
    private static bool PatientNamesMatch(string? registeredName, string? documentName)
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

    private static readonly HashSet<string> NameConjunctions = new(StringComparer.OrdinalIgnoreCase) { "da", "de", "do", "dos", "das", "e" };

    private static List<string> GetSignificantNameWords(string name)
    {
        var normalized = RemoveAccents(name.Trim().ToLowerInvariant());
        return normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => !NameConjunctions.Contains(w) && w.Length >= 2)
            .ToList();
    }

    private static string RemoveAccents(string text)
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

    private static string GenerateAccessCode(Guid requestId)
    {
        // Usa SHA256 do requestId como fallback determinístico — mais seguro que GetHashCode()
        // (GetHashCode não é estável entre processos e é trivialmente reversível)
        var bytes = SHA256.HashData(requestId.ToByteArray());
        var value = BitConverter.ToUInt32(bytes, 0) % 1_000_000;
        return value.ToString("D6");
    }

    private static string ComputeSha256(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string GetInitials(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "??";
        var parts = name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 1) return parts[0][..Math.Min(2, parts[0].Length)].ToUpperInvariant();
        return $"{parts[0][0]}{parts[^1][0]}".ToUpperInvariant();
    }

    private static string GetLast4(string? crm)
    {
        if (string.IsNullOrWhiteSpace(crm)) return "0000";
        var digits = new string(crm.Where(char.IsDigit).ToArray());
        return digits.Length >= 4 ? digits[^4..] : digits.PadLeft(4, '0');
    }

    private static PrescriptionKind? ParsePrescriptionKind(string? value)
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

    /// <summary>
    /// Cria uma solicitação de receita médica (tipo + foto + medicamentos). Status Submitted.
    /// O pagamento só é criado quando o médico aprovar (POST /approve); então o paciente paga e o médico assina.
    /// </summary>
    public async Task<(RequestResponseDto Request, PaymentResponseDto? Payment)> CreatePrescriptionAsync(
        CreatePrescriptionRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        if (user == null)
            throw new InvalidOperationException("User not found");

        var prescriptionType = ParsePrescriptionType(request.PrescriptionType);
        var prescriptionKind = ParsePrescriptionKind(request.PrescriptionKind);

        var medications = request.Medications ?? new List<string>();
        var controlledDuplicateWarning = await BuildControlledDuplicateWarningAsync(userId, prescriptionKind, medications, cancellationToken);

        var medicalRequest = MedicalRequest.CreatePrescription(
            userId,
            user.Name,
            prescriptionType,
            medications,
            request.PrescriptionImages,
            prescriptionKind);

        medicalRequest = await requestRepository.CreateAsync(medicalRequest, cancellationToken) ?? medicalRequest;

        // AutoObservation em update separado — sem transação no Supabase HTTP.
        // Falha aqui não deve abortar a criação do pedido (o médico pode processar mesmo sem ela).
        try
        {
            var autoObs = GenerateAutoObservation(RequestType.Prescription, prescriptionType);
            if (!string.IsNullOrWhiteSpace(controlledDuplicateWarning))
                autoObs = string.IsNullOrWhiteSpace(autoObs) ? controlledDuplicateWarning : $"{autoObs}\n\n{controlledDuplicateWarning}";

            medicalRequest.SetAutoObservation(autoObs);
            medicalRequest = await requestRepository.UpdateAsync(medicalRequest, cancellationToken) ?? medicalRequest;
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Falha ao salvar AutoObservation para receita {RequestId}. Pedido criado sem ela.", medicalRequest.Id);
        }

        try
        {
            await RunPrescriptionAiAndUpdateAsync(medicalRequest, cancellationToken);
        }
        catch (Exception ex)
        {
            if (logger != null)
                logger.LogError(ex, "IA receita: falha inesperada para request {RequestId}. Solicitação criada, mas sem análise. O médico pode usar Reanalisar.", medicalRequest?.Id ?? Guid.Empty);
            // Não relança - a solicitação foi criada com sucesso; o médico pode clicar em "Reanalisar com IA"
        }

        var latest = await requestRepository.GetByIdAsync(medicalRequest!.Id, cancellationToken);
        var req = latest ?? medicalRequest;

        if (req != null && req.Status != RequestStatus.Rejected)
        {
            // Paciente acabou de enviar — push "Pedido enviado" desnecessário
            // await pushDispatcher.SendAsync(PushNotificationRules.Submitted(userId, req.Id, RequestType.Prescription), cancellationToken);
            await NotifyAvailableDoctorsOfNewRequestAsync("receita", req, cancellationToken);
            await requestEventsPublisher.NotifyNewRequestToDoctorsAsync(req.Id, "submitted", "Nova receita na fila", cancellationToken);
        }

        return (MapRequestToDto(req!), null);
    }

    /// <summary>
    /// Cria uma solicitação de exame. Status Submitted. Pagamento criado na aprovação pelo médico.
    /// </summary>
    public async Task<(RequestResponseDto Request, PaymentResponseDto? Payment)> CreateExamAsync(
        CreateExamRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        if (user == null)
            throw new InvalidOperationException("User not found");

        var medicalRequest = MedicalRequest.CreateExam(
            userId,
            user.Name,
            request.ExamType ?? "geral",
            request.Exams ?? new List<string>(),
            request.Symptoms,
            request.ExamImages);

        medicalRequest = await requestRepository.CreateAsync(medicalRequest, cancellationToken) ?? medicalRequest;

        // AutoObservation em update separado — sem transação no Supabase HTTP.
        try
        {
            var autoObs = GenerateAutoObservation(RequestType.Exam, examType: request.ExamType);
            medicalRequest.SetAutoObservation(autoObs);
            medicalRequest = await requestRepository.UpdateAsync(medicalRequest, cancellationToken) ?? medicalRequest;
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Falha ao salvar AutoObservation para exame {RequestId}. Pedido criado sem ela.", medicalRequest.Id);
        }

        try
        {
            await RunExamAiAndUpdateAsync(medicalRequest, cancellationToken);
        }
        catch (Exception ex)
        {
            if (logger != null)
                logger.LogError(ex, "IA exame: falha inesperada para request {RequestId}. Solicitação criada, mas sem análise. O médico pode usar Reanalisar.", medicalRequest?.Id ?? Guid.Empty);
        }

        var latest = await requestRepository.GetByIdAsync(medicalRequest!.Id, cancellationToken);
        var req = latest ?? medicalRequest;

        if (req != null && req.Status != RequestStatus.Rejected)
        {
            // Paciente acabou de enviar — push "Pedido enviado" desnecessário
            // await pushDispatcher.SendAsync(PushNotificationRules.Submitted(userId, req.Id, RequestType.Exam), cancellationToken);
            await NotifyAvailableDoctorsOfNewRequestAsync("exame", req, cancellationToken);
            await requestEventsPublisher.NotifyNewRequestToDoctorsAsync(req.Id, "submitted", "Novo exame na fila", cancellationToken);
        }

        return (MapRequestToDto(req!), null);
    }

    /// <summary>
    /// Cria uma solicitação de consulta. Status SearchingDoctor. Pagamento/valor conforme fluxo de consulta.
    /// </summary>
    public async Task<(RequestResponseDto Request, PaymentResponseDto? Payment)> CreateConsultationAsync(
        CreateConsultationRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        if (user == null)
            throw new InvalidOperationException("User not found");

        var consultationType = string.IsNullOrWhiteSpace(request.ConsultationType)
            ? "medico_clinico"
            : request.ConsultationType;
        var durationMinutes = request.DurationMinutes > 0 ? request.DurationMinutes : 15;

        // Busca preço por minuto da tabela product_prices
        var pricePerMinute = await productPriceRepository.GetPriceAsync("consultation", consultationType, cancellationToken)
                             ?? 6.99m;

        // Verifica saldo no banco de horas
        var balanceSeconds = await consultationTimeBankRepository.GetBalanceSecondsAsync(userId, consultationType, cancellationToken);
        var balanceMinutes = balanceSeconds / 60;

        decimal totalPrice;
        int freeMinutes = 0;
        int paidMinutes = durationMinutes;

        if (balanceMinutes >= durationMinutes)
        {
            // Consulta completamente gratuita pelo banco de horas
            freeMinutes = durationMinutes;
            paidMinutes = 0;
            totalPrice = 0m;
        }
        else if (balanceMinutes > 0)
        {
            // Desconto parcial
            freeMinutes = balanceMinutes;
            paidMinutes = durationMinutes - freeMinutes;
            totalPrice = paidMinutes * pricePerMinute;
        }
        else
        {
            totalPrice = durationMinutes * pricePerMinute;
        }

        var medicalRequest = MedicalRequest.CreateConsultation(
            userId,
            user.Name,
            request.Symptoms,
            consultationType,
            durationMinutes,
            pricePerMinute);

        medicalRequest = await requestRepository.CreateAsync(medicalRequest, cancellationToken) ?? medicalRequest;

        // AutoObservation em update separado — sem transação no Supabase HTTP.
        try
        {
            var autoObs = GenerateAutoObservation(RequestType.Consultation);
            medicalRequest.SetAutoObservation(autoObs);
            medicalRequest = await requestRepository.UpdateAsync(medicalRequest, cancellationToken) ?? medicalRequest;
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Falha ao salvar AutoObservation para consulta {RequestId}. Pedido criado sem ela.", medicalRequest.Id);
        }

        // Debitar minutos gratuitos do banco de horas
        if (freeMinutes > 0)
        {
            await consultationTimeBankRepository.DebitAsync(
                userId, consultationType, freeMinutes * 60, medicalRequest.Id, cancellationToken);
        }

        // Persistir o preço efetivo para ser usado na aceitação pelo médico
        if (totalPrice >= 0)
        {
            medicalRequest.SetEffectivePrice(totalPrice);
            medicalRequest = await requestRepository.UpdateAsync(medicalRequest, cancellationToken) ?? medicalRequest;
        }

        // Paciente acabou de enviar — push "Pedido enviado" desnecessário
        // await pushDispatcher.SendAsync(PushNotificationRules.Submitted(userId, medicalRequest.Id, RequestType.Consultation), cancellationToken);

        await NotifyAvailableDoctorsOfNewRequestAsync("consulta", medicalRequest, cancellationToken);
        await requestEventsPublisher.NotifyNewRequestToDoctorsAsync(medicalRequest.Id, "submitted", "Nova consulta na fila", cancellationToken);

        return (MapRequestToDto(medicalRequest), null);
    }

    /// <summary>
    /// Lista solicitações do usuário (paciente ou médico) com filtros opcionais por status e tipo.
    /// Se o usuário é médico, retorna requests atribuídas a ele + requests disponíveis (sem médico, status paid/submitted).
    /// </summary>
    public async Task<List<RequestResponseDto>> GetUserRequestsAsync(
        Guid userId,
        string? status = null,
        string? type = null,
        CancellationToken cancellationToken = default)
    {
        logger.LogInformation("[GetUserRequests] userId={UserId}", userId);
        Console.WriteLine($"[GetUserRequests] userId={userId}");

        // Check if user is a doctor
        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        logger.LogInformation("[GetUserRequests] user from DB: Id={UserId}, Role={Role}, Email={Email}",
            user?.Id, user?.Role.ToString(), user?.Email ?? "(null)");
        Console.WriteLine($"[GetUserRequests] user from DB: Id={user?.Id}, Role={user?.Role}, Email={user?.Email ?? "(null)"}");

        List<MedicalRequest> requests;

        if (user?.Role == UserRole.Doctor)
        {
            logger.LogInformation("[GetUserRequests] branch: Doctor - fetching assigned + available (1 query for queue)");
            Console.WriteLine("[GetUserRequests] branch: Doctor - fetching assigned + available");

            var doctorRequests = await requestRepository.GetByDoctorIdAsync(userId, cancellationToken);
            var available = await requestRepository.GetAvailableForQueueAsync(cancellationToken);

            logger.LogInformation("[GetUserRequests] doctor: assignedCount={Assigned}, availableInQueue={Available}",
                doctorRequests.Count, available.Count);
            Console.WriteLine($"[GetUserRequests] doctor: assigned={doctorRequests.Count}, available={available.Count}");

            requests = doctorRequests.Concat(available)
                .DistinctBy(r => r.Id)
                .OrderByDescending(r => r.CreatedAt)
                .ToList();

            logger.LogInformation("[GetUserRequests] doctor: totalRequests={Total}", requests.Count);
        }
        else
        {
            logger.LogInformation("[GetUserRequests] branch: Patient (or user not found) - fetching by patient_id");
            Console.WriteLine("[GetUserRequests] branch: Patient (or user not found)");
            requests = await requestRepository.GetByPatientIdAsync(userId, cancellationToken);
            logger.LogInformation("[GetUserRequests] patient: totalRequests={Total}", requests.Count);
            Console.WriteLine($"[GetUserRequests] patient: totalRequests={requests.Count}");
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusEnum = EnumHelper.ParseSnakeCase<RequestStatus>(status);
            requests = requests.Where(r => r.Status == statusEnum).ToList();
        }

        if (!string.IsNullOrWhiteSpace(type))
        {
            var typeEnum = EnumHelper.ParseSnakeCase<RequestType>(type);
            requests = requests.Where(r => r.RequestType == typeEnum).ToList();
        }

        var consultationIds = requests.Where(r => r.RequestType == RequestType.Consultation).Select(r => r.Id).ToList();
        var anamnesisByRequest = consultationIds.Count > 0
            ? await consultationAnamnesisRepository.GetByRequestIdsAsync(consultationIds, cancellationToken)
            : new Dictionary<Guid, ConsultationAnamnesis>();

        var result = new List<RequestResponseDto>();
        foreach (var r in requests)
        {
            string? ct = null, ca = null, cs = null, ce = null;
            // Transcrição/anamnese/resumo pós-consulta só para o médico atribuído (nunca para o paciente).
            if (r.RequestType == RequestType.Consultation && r.DoctorId == userId && anamnesisByRequest.TryGetValue(r.Id, out var a))
            {
                ct = a.TranscriptText; ca = a.AnamnesisJson; cs = a.AiSuggestionsJson; ce = a.EvidenceJson;
            }
            result.Add(MapRequestToDto(r, ct, ca, cs, ce));
        }
        logger.LogInformation("[GetUserRequests] final count after filters: {Count}", result.Count);
        return result;
    }

    /// <summary>
    /// Médico obtém histórico de solicitações do paciente (prontuário).
    /// Retorna solicitações em que o médico está atribuído ou que estão disponíveis na fila.
    /// </summary>
    public async Task<List<RequestResponseDto>> GetPatientRequestsAsync(
        Guid doctorId,
        Guid patientId,
        CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(doctorId, cancellationToken);
        if (user?.Role != UserRole.Doctor)
            throw new UnauthorizedAccessException("Apenas médicos podem acessar o prontuário do paciente.");

        var requests = await requestRepository.GetByPatientIdAsync(patientId, cancellationToken);
        requests = requests
            .Where(r => r.DoctorId == null || r.DoctorId == Guid.Empty || r.DoctorId == doctorId)
            .OrderByDescending(r => r.CreatedAt)
            .ToList();

        var consultationIds = requests.Where(r => r.RequestType == RequestType.Consultation).Select(r => r.Id).ToList();
        var anamnesisByRequest = consultationIds.Count > 0
            ? await consultationAnamnesisRepository.GetByRequestIdsAsync(consultationIds, cancellationToken)
            : new Dictionary<Guid, ConsultationAnamnesis>();

        var dtos = new List<RequestResponseDto>();
        foreach (var r in requests)
        {
            string? ct = null, ca = null, cs = null, ce = null;
            if (r.RequestType == RequestType.Consultation && anamnesisByRequest.TryGetValue(r.Id, out var a))
            {
                ct = a.TranscriptText; ca = a.AnamnesisJson; cs = a.AiSuggestionsJson; ce = a.EvidenceJson;
            }
            dtos.Add(MapRequestToDto(r, ct, ca, cs, ce));
        }
        return dtos;
    }

    /// <summary>
    /// Médico obtém perfil do paciente para identificação. Só retorna se o médico tiver acesso ao prontuário.
    /// </summary>
    public async Task<PatientProfileForDoctorDto?> GetPatientProfileForDoctorAsync(
        Guid doctorId,
        Guid patientId,
        CancellationToken cancellationToken = default)
    {
        var doctor = await userRepository.GetByIdAsync(doctorId, cancellationToken);
        if (doctor?.Role != UserRole.Doctor)
            return null;

        var requests = await requestRepository.GetByPatientIdAsync(patientId, cancellationToken);
        var hasAccess = requests.Any(r => r.DoctorId == null || r.DoctorId == Guid.Empty || r.DoctorId == doctorId);
        if (!hasAccess)
            return null;

        var user = await userRepository.GetByIdAsync(patientId, cancellationToken);
        if (user == null || user.Role != UserRole.Patient)
            return null;

        var cpfMasked = MaskCpf(user.Cpf);

        return new PatientProfileForDoctorDto(
            user.Name,
            user.Email.Value,
            user.Phone?.Value,
            user.BirthDate,
            cpfMasked,
            user.Gender,
            user.Street,
            user.Number,
            user.Neighborhood,
            user.Complement,
            user.City,
            user.State,
            user.PostalCode,
            user.AvatarUrl
        );
    }

    private static string? MaskCpf(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return null;
        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        if (digits.Length != 11) return null;
        return $"***.***.***-{digits[^2]}{digits[^1]}";
    }

    /// <summary>
    /// Lista solicitações do paciente com paginação e filtros opcionais.
    /// </summary>
    public async Task<PagedResponse<RequestResponseDto>> GetUserRequestsPagedAsync(
        Guid userId,
        string? status = null,
        string? type = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var allRequests = await GetUserRequestsAsync(userId, status, type, cancellationToken);
        var totalCount = allRequests.Count;
        var offset = (page - 1) * pageSize;
        var items = allRequests.Skip(offset).Take(pageSize).ToList();

        return new PagedResponse<RequestResponseDto>(items, totalCount, page, pageSize);
    }

    /// <summary>
    /// Obtém uma solicitação pelo ID. Valida que o usuário é o paciente, o médico atribuído,
    /// ou um médico visualizando solicitação disponível na fila (sem médico atribuído).
    /// </summary>
    public async Task<RequestResponseDto> GetRequestByIdAsync(
        Guid id,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        var isPatient = request.PatientId == userId;
        var isAssignedDoctor = request.DoctorId.HasValue && request.DoctorId == userId;
        var isAvailableForDoctor = !request.DoctorId.HasValue || request.DoctorId == Guid.Empty;

        User? user = null;
        if (!isPatient && !isAssignedDoctor && isAvailableForDoctor)
        {
            user = await userRepository.GetByIdAsync(userId, cancellationToken);
        }

        var canAccess = isPatient
            || isAssignedDoctor
            || (isAvailableForDoctor && user?.Role == UserRole.Doctor);

        if (!canAccess)
            throw new KeyNotFoundException("Request not found");

        // Transcrição, anamnese e resumo pós-consulta só aparecem para o médico atribuído (nunca para o paciente).
        string? ct = null, ca = null, cs = null, ce = null;
        if (isAssignedDoctor)
        {
            var consultationData = await GetConsultationAnamnesisIfAnyAsync(request.Id, request.RequestType, cancellationToken);
            ct = consultationData.Transcript;
            ca = consultationData.AnamnesisJson;
            cs = consultationData.SuggestionsJson;
            ce = consultationData.EvidenceJson;
        }
        return MapRequestToDto(request, ct, ca, cs, ce);
    }

    private async Task<(string? Transcript, string? AnamnesisJson, string? SuggestionsJson, string? EvidenceJson)> GetConsultationAnamnesisIfAnyAsync(
        Guid requestId,
        RequestType requestType,
        CancellationToken cancellationToken)
    {
        if (requestType != RequestType.Consultation) return (null, null, null, null);
        var a = await consultationAnamnesisRepository.GetByRequestIdAsync(requestId, cancellationToken);
        if (a == null) return (null, null, null, null);
        return (a.TranscriptText, a.AnamnesisJson, a.AiSuggestionsJson, a.EvidenceJson);
    }

    /// <summary>
    /// Atualiza o status de uma solicitação.
    /// </summary>
    public async Task<RequestResponseDto> UpdateStatusAsync(
        Guid id,
        UpdateRequestStatusDto dto,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        var newStatus = EnumHelper.ParseSnakeCase<RequestStatus>(dto.Status);
        request.UpdateStatus(newStatus);

        if (!string.IsNullOrWhiteSpace(dto.RejectionReason))
        {
            request.Reject(dto.RejectionReason);
        }

        request = await requestRepository.UpdateAsync(request, cancellationToken);

        await CreateNotificationAsync(
            request.PatientId,
            "Status Atualizado",
            $"Sua solicitação foi atualizada para: {dto.Status}",
            cancellationToken,
            new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });

        await PublishRequestUpdatedAsync(request, "Status atualizado", cancellationToken);
        return MapRequestToDto(request);
    }

    /// <summary>
    /// Aprova uma solicitação (médico). O valor é consultado na tabela product_prices — não é informado pelo médico.
    /// O pagamento é criado pelo paciente ao chamar POST /api/payments (PIX ou outro método via Mercado Pago).
    /// </summary>
    public async Task<RequestResponseDto> ApproveAsync(
        Guid id,
        ApproveRequestDto dto,
        Guid doctorId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var request = await requestRepository.GetByIdAsync(id, cancellationToken);
            if (request == null)
                throw new KeyNotFoundException("Request not found");

            var doctor = await userRepository.GetByIdAsync(doctorId, cancellationToken);
            if (doctor == null || !doctor.IsDoctor())
                throw new InvalidOperationException("Doctor not found");

            if (request.DoctorId == null)
                request.AssignDoctor(doctorId, doctor.Name);

            var (productType, subtype) = GetProductTypeAndSubtype(request);
            var priceFromDb = await productPriceRepository.GetPriceAsync(productType, subtype, cancellationToken);
            if (!priceFromDb.HasValue || priceFromDb.Value <= 0)
                throw new InvalidOperationException(
                    $"Preço não encontrado para {productType}/{subtype}. Verifique a tabela product_prices.");

            var price = priceFromDb.Value;
            request.Approve(price, dto.Notes, dto.Medications, dto.Exams);
            request = await requestRepository.UpdateAsync(request, cancellationToken);

            _ = Task.Run(async () =>
            {
                try { await GenerateAndSetConductSuggestionAsync(request.Id, cancellationToken); }
                catch (Exception ex) { logger.LogWarning(ex, "AI conduct suggestion failed for {RequestId}", request.Id); }
            }, cancellationToken);

            await PublishRequestUpdatedAsync(request, "Solicitação aprovada", cancellationToken);
            await pushDispatcher.SendAsync(PushNotificationRules.ApprovedPendingPayment(request.PatientId, request.Id, request.RequestType), cancellationToken);

            return MapRequestToDto(request);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Erro ao aprovar solicitação {RequestId}", id);
            throw;
        }
    }

    private static (string productType, string subtype) GetProductTypeAndSubtype(MedicalRequest request)
    {
        var productType = request.RequestType.ToString().ToLowerInvariant();
        var subtype = "default";

        if (request.RequestType == RequestType.Prescription && request.PrescriptionType.HasValue)
            subtype = PrescriptionTypeToDisplay(request.PrescriptionType.Value) ?? "simples";
        // Para exame e consulta usamos "default" (preço fixo na tabela product_prices)

        return (productType, subtype);
    }

    /// <summary>
    /// Rejeita uma solicitação com motivo.
    /// </summary>
    public async Task<RequestResponseDto> RejectAsync(
        Guid id,
        RejectRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        request.Reject(dto.RejectionReason);
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        await pushDispatcher.SendAsync(PushNotificationRules.Rejected(request.PatientId, request.Id, request.RequestType, dto.RejectionReason), cancellationToken);

        return MapRequestToDto(request);
    }

    /// <summary>
    /// Atribui a solicitação ao primeiro médico disponível na fila.
    /// </summary>
    public async Task<RequestResponseDto> AssignToQueueAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        // Get available doctors (simple queue logic)
        var doctors = await doctorRepository.GetAvailableAsync(null, cancellationToken);
        if (doctors.Count == 0)
            throw new InvalidOperationException("No available doctors");

        var selectedDoctor = doctors.First();
        var doctorUser = await userRepository.GetByIdAsync(selectedDoctor.UserId, cancellationToken);
        
        if (doctorUser != null)
        {
            request.AssignDoctor(doctorUser.Id, doctorUser.Name);
            request = await requestRepository.UpdateAsync(request, cancellationToken);

            // "Seu pedido está em análise" — push informativo desnecessário (paciente já vê na tela)
            // await pushDispatcher.SendAsync(PushNotificationRules.InReview(request.PatientId, request.Id, request.RequestType), cancellationToken);
            await pushDispatcher.SendAsync(PushNotificationRules.RequestAssigned(doctorUser.Id, request.Id, request.RequestType), cancellationToken);
        }

        return MapRequestToDto(request);
    }

    /// <summary>
    /// Aceita a consulta, cria sala de vídeo e notifica o paciente.
    /// </summary>
    public async Task<(RequestResponseDto Request, VideoRoomResponseDto VideoRoom)> AcceptConsultationAsync(
        Guid id,
        Guid doctorId,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        if (request.RequestType != RequestType.Consultation)
            throw new InvalidOperationException("Only consultation requests can create video rooms");

        if (request.Status != RequestStatus.SearchingDoctor)
            throw new InvalidOperationException($"Consulta só pode ser aceita quando está em 'searching_doctor'. Status atual: {request.Status}");

        var doctor = await userRepository.GetByIdAsync(doctorId, cancellationToken);
        if (doctor == null || !doctor.IsDoctor())
            throw new InvalidOperationException("Doctor not found");

        decimal effectivePrice;
        if (request.ContractedMinutes.HasValue && request.PricePerMinute.HasValue)
        {
            // Preço por minuto: usa o preço já calculado (armazenado no Price) ou recalcula
            effectivePrice = request.Price?.Amount ?? (request.ContractedMinutes.Value * request.PricePerMinute.Value);
        }
        else
        {
            var (_, subtype) = GetProductTypeAndSubtype(request);
            var priceFromDb = await productPriceRepository.GetPriceAsync("consultation", subtype, cancellationToken);
            if (!priceFromDb.HasValue || priceFromDb.Value <= 0)
                throw new InvalidOperationException("Preço de consulta não configurado. Verifique a tabela product_prices (product_type=consultation, subtype=default).");
            effectivePrice = priceFromDb.Value;
        }

        request.AssignDoctor(doctorId, doctor.Name);
        request.Approve(effectivePrice > 0 ? effectivePrice : 1m);
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        var roomName = $"consultation-{request.Id}";
        var videoRoom = VideoRoom.Create(request.Id, roomName);
        videoRoom = await videoRoomRepository.CreateAsync(videoRoom, cancellationToken);

        await PublishRequestUpdatedAsync(request, "Médico aceitou — efetue o pagamento", cancellationToken);
        await pushDispatcher.SendAsync(PushNotificationRules.ApprovedPendingPayment(request.PatientId, request.Id, RequestType.Consultation), cancellationToken);

        return (MapRequestToDto(request), MapVideoRoomToDto(videoRoom));
    }

    /// <summary>
    /// Médico inicia a consulta (status Paid → InConsultation).
    /// </summary>
    public async Task<RequestResponseDto> StartConsultationAsync(Guid id, Guid doctorId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        if (request.RequestType != RequestType.Consultation)
            throw new InvalidOperationException("Only consultation requests can be started");

        if (request.DoctorId.HasValue && request.DoctorId != doctorId)
            throw new UnauthorizedAccessException("Only the assigned doctor can start this consultation");

        if (!request.DoctorId.HasValue || request.DoctorId == Guid.Empty)
        {
            var doctor = await userRepository.GetByIdAsync(doctorId, cancellationToken);
            if (doctor == null || !doctor.IsDoctor())
                throw new UnauthorizedAccessException("User is not a doctor");
            request.AssignDoctor(doctorId, doctor.Name);
            request = await requestRepository.UpdateAsync(request, cancellationToken);
        }

        if (request.Status != RequestStatus.Paid)
        {
            // Cura dessincronia: webhook/confirm pode ter falhado mas o pagamento já estar aprovado no banco.
            var payment = await paymentRepository.GetByRequestIdAsync(id, cancellationToken);
            if (payment != null && payment.IsApproved())
            {
#pragma warning disable CS0618 // Status legado: aceitar PendingPayment para dados antigos
                if (request.Status == RequestStatus.ApprovedPendingPayment || request.Status == RequestStatus.PendingPayment)
#pragma warning restore CS0618
                {
                    request.MarkAsPaid();
                    request = await requestRepository.UpdateAsync(request, cancellationToken);
                    logger.LogInformation("[START-CONSULTATION] Request {RequestId} estava com pagamento aprovado e status desatualizado; corrigido para paid.", id);
                }
                else
                    throw new InvalidOperationException($"Consultation can only be started after payment is confirmed. Current status: {request.Status}.");
            }
            else
                throw new InvalidOperationException($"Consultation can only be started after payment is confirmed. Current status: {request.Status}.");
        }

        request.StartConsultation();
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        var videoRoom = await videoRoomRepository.GetByRequestIdAsync(id, cancellationToken);
        if (videoRoom != null && videoRoom.Status == VideoRoomStatus.Waiting)
        {
            videoRoom.Start();
            await videoRoomRepository.UpdateAsync(videoRoom, cancellationToken);
        }

        await PublishRequestUpdatedAsync(request, "Médico na sala", cancellationToken);
        await pushDispatcher.SendAsync(PushNotificationRules.DoctorReady(request.PatientId, request.Id), cancellationToken);

        return MapRequestToDto(request);
    }

    /// <summary>
    /// Médico ou paciente reporta WebRTC conectado. Quando ambos tiverem reportado, ConsultationStartedAt é definido e ambos recebem push "Chamada conectada".
    /// </summary>
    public async Task<RequestResponseDto> ReportCallConnectedAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        if (request.RequestType != RequestType.Consultation)
            throw new InvalidOperationException("Only consultation requests support call connected");

        if (request.PatientId != userId && request.DoctorId != userId)
            throw new UnauthorizedAccessException("Only the doctor or patient of this consultation can report call connected");

        var hadStarted = request.ConsultationStartedAt.HasValue;
        var applied = request.ReportCallConnected(userId);
        if (!applied)
            return MapRequestToDto(request);

        request = await requestRepository.UpdateAsync(request, cancellationToken);

        if (!hadStarted && request.ConsultationStartedAt.HasValue)
        {
            // B1: Criar Encounter no prontuário quando médico e paciente conectam
            if (request.DoctorId.HasValue)
            {
                try
                {
                    await consultationEncounterService.StartEncounterForConsultationAsync(
                        request.Id,
                        request.PatientId,
                        request.DoctorId.Value,
                        request.Symptoms,
                        cancellationToken);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "[ReportCallConnected] Falha ao criar Encounter para request {RequestId}", request.Id);
                }
            }

            // Paciente e médico já estão na chamada — não enviar push redundante.
            // Enviar RequestUpdated para que paciente e médico atualizem o timer imediatamente (consultationStartedAt)
            await PublishRequestUpdatedAsync(request, "Chamada conectada", cancellationToken);
        }

        return MapRequestToDto(request);
    }

    /// <summary>
    /// Médico encerra a consulta: persiste notas, deleta sala Daily e notifica paciente.
    /// </summary>
    public async Task<RequestResponseDto> FinishConsultationAsync(Guid id, Guid doctorId, FinishConsultationDto? dto, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        if (request.RequestType != RequestType.Consultation)
            throw new InvalidOperationException("Only consultation requests can be finished");

        if (request.DoctorId.HasValue && request.DoctorId != doctorId)
            throw new UnauthorizedAccessException("Only the assigned doctor can finish this consultation");

        var canFinish = request.Status == RequestStatus.InConsultation
            || request.Status == RequestStatus.Paid;
        if (!canFinish)
            throw new InvalidOperationException("Consultation must be in progress to be finished");

        request.FinishConsultation(dto?.ClinicalNotes);
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        var videoRoom = await videoRoomRepository.GetByRequestIdAsync(id, cancellationToken);
        if (videoRoom != null && videoRoom.Status == VideoRoomStatus.Active)
        {
            videoRoom.End();
            await videoRoomRepository.UpdateAsync(videoRoom, cancellationToken);
        }

        // Creditar minutos não utilizados ao banco de horas
        if (request.ContractedMinutes.HasValue && !string.IsNullOrWhiteSpace(request.ConsultationType))
        {
            try
            {
                var contractedSeconds = request.ContractedMinutes.Value * 60;
                var usedSeconds = videoRoom?.DurationSeconds ?? 0;
                var unusedSeconds = contractedSeconds - usedSeconds;

                if (unusedSeconds > 0)
                {
                    await consultationTimeBankRepository.CreditAsync(
                        request.PatientId,
                        request.ConsultationType,
                        unusedSeconds,
                        request.Id,
                        "refund_unused",
                        cancellationToken);

                    logger.LogInformation(
                        "[FinishConsultation] Creditado {Seconds}s ao banco de horas de {PatientId} ({Type})",
                        unusedSeconds, request.PatientId, request.ConsultationType);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Falha ao creditar banco de horas para request {RequestId}", id);
            }
        }

        // Persistir transcrição e anamnese da consulta no prontuário
        var sessionData = consultationSessionStore.GetAndRemove(id);
        if (sessionData != null)
        {
            string? transcriptFileUrl = null;
            var contentToSave = BuildTranscriptTxtContent(sessionData, request.ConsultationStartedAt);
            if (!string.IsNullOrWhiteSpace(contentToSave))
            {
                try
                {
                    var path = $"transcripts/{id}.txt";
                    var bytes = Encoding.UTF8.GetBytes(contentToSave);
                    var result = await storageService.UploadAsync(path, bytes, "text/plain", cancellationToken);
                    if (result.Success && !string.IsNullOrEmpty(result.Url))
                    {
                        transcriptFileUrl = result.Url;
                        logger.LogInformation("[FinishConsultation] Transcrição salva em Storage: RequestId={RequestId} Path={Path}", id, path);
                    }
                    else
                    {
                        logger.LogWarning("[FinishConsultation] Falha ao fazer upload da transcrição: RequestId={RequestId} Error={Error}", id, result.ErrorMessage);
                    }
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "[FinishConsultation] Exceção ao fazer upload da transcrição para Storage: RequestId={RequestId}", id);
                }
            }
            else
            {
                logger.LogInformation("[FinishConsultation] Transcrição vazia — não salvando .txt. RequestId={RequestId} hasTranscript={Has} hasSegments={Segments}",
                    id, !string.IsNullOrWhiteSpace(sessionData.TranscriptText), sessionData.TranscriptSegments?.Count ?? 0);
            }

            try
            {
                var existing = await consultationAnamnesisRepository.GetByRequestIdAsync(id, cancellationToken);
                if (existing != null)
                {
                    var oldValues = new Dictionary<string, object?>
                    {
                        ["transcript"] = existing.TranscriptText,
                        ["transcript_file_url"] = existing.TranscriptFileUrl,
                        ["anamnesis_json"] = existing.AnamnesisJson,
                        ["ai_suggestions_json"] = existing.AiSuggestionsJson,
                        ["evidence_json"] = existing.EvidenceJson
                    };
                    existing.Update(sessionData.TranscriptText, transcriptFileUrl, sessionData.AnamnesisJson, sessionData.AiSuggestionsJson, sessionData.EvidenceJson);
                    await consultationAnamnesisRepository.UpdateAsync(existing, cancellationToken);
                    var newValues = new Dictionary<string, object?>
                    {
                        ["transcript"] = existing.TranscriptText,
                        ["transcript_file_url"] = existing.TranscriptFileUrl,
                        ["anamnesis_json"] = existing.AnamnesisJson,
                        ["ai_suggestions_json"] = existing.AiSuggestionsJson,
                        ["evidence_json"] = existing.EvidenceJson
                    };
                    await auditService.LogModificationAsync(doctorId, "Update", "ConsultationAnamnesis", existing.Id, oldValues, newValues, cancellationToken: cancellationToken);
                }
                else
                {
                    var entity = Domain.Entities.ConsultationAnamnesis.Create(
                        id,
                        sessionData.PatientId,
                        sessionData.TranscriptText,
                        transcriptFileUrl,
                        sessionData.AnamnesisJson,
                        sessionData.AiSuggestionsJson,
                        sessionData.EvidenceJson);
                    await consultationAnamnesisRepository.CreateAsync(entity, cancellationToken);
                    var newValues = new Dictionary<string, object?>
                    {
                        ["request_id"] = id,
                        ["transcript"] = entity.TranscriptText,
                        ["transcript_file_url"] = entity.TranscriptFileUrl,
                        ["anamnesis_json"] = entity.AnamnesisJson,
                        ["ai_suggestions_json"] = entity.AiSuggestionsJson,
                        ["evidence_json"] = entity.EvidenceJson
                    };
                    await auditService.LogModificationAsync(doctorId, "Create", "ConsultationAnamnesis", entity.Id, oldValues: null, newValues: newValues, cancellationToken: cancellationToken);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to persist consultation anamnesis for request {RequestId}", id);
            }
        }
        else
        {
            logger.LogInformation("[FinishConsultation] Sem dados de sessão para persistir: RequestId={RequestId} (transcrição pode não ter sido enviada via transcribe-text)", id);
        }

        // B1: Finalizar Encounter no prontuário com anamnese e plano
        try
        {
            var anamnesisJson = sessionData?.AnamnesisJson;
            var plan = dto?.ClinicalNotes ?? request.Notes;
            var icd10 = ExtractIcd10FromAnamnesis(anamnesisJson);
            await consultationEncounterService.FinalizeEncounterForConsultationAsync(
                id,
                anamnesisJson,
                plan,
                icd10,
                cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[FinishConsultation] Falha ao finalizar Encounter para request {RequestId}", id);
        }

        await PublishRequestUpdatedAsync(request, "Consulta finalizada", cancellationToken);
        await pushDispatcher.SendAsync(PushNotificationRules.ConsultationFinished(request.PatientId, request.Id), cancellationToken);

        return MapRequestToDto(request);
    }

    /// <inheritdoc />
    public async Task<string?> GetTranscriptDownloadUrlAsync(Guid id, Guid userId, int expiresInSeconds = 3600, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) return null;
        if (request.RequestType != RequestType.Consultation) return null;

        var isDoctor = request.DoctorId == userId;
        var isPatient = request.PatientId == userId;
        if (!isDoctor && !isPatient) return null;

        var anamnesis = await consultationAnamnesisRepository.GetByRequestIdAsync(id, cancellationToken);
        if (anamnesis?.TranscriptFileUrl == null) return null;

        var path = storageService.ExtractPathFromStorageUrl(anamnesis.TranscriptFileUrl)
            ?? $"transcripts/{id}.txt";
        return await storageService.CreateSignedUrlAsync(path, expiresInSeconds, cancellationToken);
    }

    /// <summary>
    /// Assina digitalmente a receita/documento. Fluxo completo:
    /// 1. Verifica se o médico tem certificado válido
    /// 2. Gera PDF da receita
    /// 3. Assina o PDF com certificado digital do médico
    /// 4. Upload do PDF assinado
    /// 5. Atualiza request com signedDocumentUrl e signatureId
    /// </summary>
    public async Task<RequestResponseDto> SignAsync(
        Guid id,
        SignRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        // Só permite assinar se o pagamento foi confirmado
        if (request.Status != RequestStatus.Paid)
        {
            throw new InvalidOperationException(
                "Apenas solicitações com pagamento confirmado podem ser assinadas. O paciente deve efetuar o pagamento (PIX ou cartão) antes da assinatura.");
        }

        // Se o médico está atribuído, tentar fluxo completo de geração + assinatura
        if (request.DoctorId.HasValue)
        {
            var doctorProfile = await doctorRepository.GetByUserIdAsync(request.DoctorId.Value, cancellationToken);

            if (doctorProfile == null)
                throw new InvalidOperationException("Perfil de médico não encontrado. Complete o cadastro como médico.");

            // 1. Verificar se médico tem certificado válido
            var hasCertificate = await digitalCertificateService.HasValidCertificateAsync(doctorProfile.Id, cancellationToken);
            if (!hasCertificate)
                throw new InvalidOperationException("Certificado digital não encontrado ou inválido. Cadastre um certificado em Configurações.");

            {
                // Senha do PFX obrigatória no fluxo automático de assinatura
                    if (string.IsNullOrWhiteSpace(dto.PfxPassword))
                    {
                        throw new InvalidOperationException(
                            "Senha do certificado digital é obrigatória para assinar. Envie o campo 'pfxPassword' no corpo da requisição.");
                    }

                    var doctorUser = await userRepository.GetByIdAsync(request.DoctorId.Value, cancellationToken);
                    var patientUser = await userRepository.GetByIdAsync(request.PatientId, cancellationToken);
                    var normalizedPfxPassword = dto.PfxPassword?.Trim();

                    byte[]? pdfBytes = null;
                    string? pdfFileName = null;

                    if (request.RequestType == Domain.Enums.RequestType.Prescription)
                    {
                        var medications = request.Medications?.Where(m => !string.IsNullOrWhiteSpace(m)).ToList() ?? new List<string>();
                        if (medications.Count == 0 && !string.IsNullOrWhiteSpace(request.AiExtractedJson))
                            medications = ParseMedicationsFromAiJson(request.AiExtractedJson);
                        if (medications.Count == 0)
                        {
                            throw new InvalidOperationException(
                                "A receita deve ter ao menos um medicamento informado para gerar o PDF. Copie a análise da IA e adicione os medicamentos ao aprovar, ou use o botão Reanalisar com IA.");
                        }

                        var kind = request.PrescriptionKind ?? PrescriptionKind.Simple;
                        var validationResult = PrescriptionComplianceValidator.Validate(
                            kind,
                            request.PatientName,
                            patientUser?.Cpf,
                            patientUser?.Address,
                            patientUser?.Gender,
                            patientUser?.BirthDate,
                            medications,
                            doctorUser?.Name ?? request.DoctorName,
                            doctorProfile.Crm,
                            doctorProfile.CrmState,
                            doctorProfile.ProfessionalAddress,
                            doctorProfile.ProfessionalPhone);
                        if (!validationResult.IsValid)
                            throw new PrescriptionValidationException(validationResult.MissingFields, validationResult.Messages);

                        List<PrescriptionMedicationItem>? aiMedItems = null;
                        if (medications.Count == 0 || medications.All(m => m.Trim().Length < 5))
                        {
                            var aiInput = new AiPrescriptionGeneratorInput(
                                PatientName: request.PatientName ?? "Paciente",
                                PatientBirthDate: patientUser?.BirthDate,
                                PatientGender: patientUser?.Gender,
                                Symptoms: request.Symptoms,
                                AiSummaryForDoctor: request.AiSummaryForDoctor,
                                AiExtractedJson: request.AiExtractedJson,
                                DoctorNotes: request.Notes,
                                Kind: kind);
                            aiMedItems = await aiPrescriptionGenerator.GenerateMedicationsAsync(aiInput, cancellationToken);
                        }

                        var pdfData = new PrescriptionPdfData(
                            RequestId: request.Id,
                            PatientName: request.PatientName ?? "Paciente",
                            PatientCpf: patientUser?.Cpf,
                            DoctorName: doctorUser?.Name ?? request.DoctorName ?? "Médico",
                            DoctorCrm: doctorProfile.Crm,
                            DoctorCrmState: doctorProfile.CrmState,
                            DoctorSpecialty: doctorProfile.Specialty,
                            Medications: medications,
                            PrescriptionType: PrescriptionTypeToDisplay(request.PrescriptionType) ?? "simples",
                            EmissionDate: GetBrazilNow(),
                            AccessCode: request.AccessCode,
                            PrescriptionKind: kind,
                            PatientGender: patientUser?.Gender,
                            PatientPhone: patientUser?.Phone?.Value,
                            PatientAddress: FormatPatientAddress(patientUser),
                            PatientBirthDate: patientUser?.BirthDate,
                            MedicationItems: aiMedItems,
                            DoctorAddress: doctorProfile.ProfessionalAddress,
                            DoctorPhone: doctorProfile.ProfessionalPhone,
                            AutoObservation: request.AutoObservation,
                            DoctorConductNotes: request.DoctorConductNotes,
                            IncludeConductInPdf: request.IncludeConductInPdf);

                        var pdfResult = await prescriptionPdfService.GenerateAsync(pdfData, cancellationToken);
                        if (pdfResult.Success && pdfResult.PdfBytes != null)
                        {
                            pdfBytes = pdfResult.PdfBytes;
                            pdfFileName = $"receita-assinada-{request.Id}-{DateTime.UtcNow:yyyyMMddHHmmssfff}.pdf";
                        }
                        else
                            throw new InvalidOperationException("Falha ao gerar PDF da receita. " + (pdfResult.ErrorMessage ?? "Verifique os dados da receita e tente novamente."));
                    }
                    else if (request.RequestType == Domain.Enums.RequestType.Exam)
                    {
                        if (string.IsNullOrWhiteSpace(patientUser?.Cpf))
                            throw new InvalidOperationException(
                                "CPF do paciente é obrigatório em todas as solicitações de exame. O paciente deve completar o cadastro com CPF antes da assinatura.");

                        var exams = request.Exams?.Where(e => !string.IsNullOrWhiteSpace(e)).ToList() ?? new List<string>();
                        if (exams.Count == 0)
                            exams = new List<string> { "Exames conforme solicitação médica" };

                        var examPdfData = new ExamPdfData(
                            RequestId: request.Id,
                            PatientName: request.PatientName ?? "Paciente",
                            PatientCpf: patientUser?.Cpf,
                            DoctorName: doctorUser?.Name ?? request.DoctorName ?? "Médico",
                            DoctorCrm: doctorProfile.Crm,
                            DoctorCrmState: doctorProfile.CrmState,
                            DoctorSpecialty: doctorProfile.Specialty,
                            Exams: exams,
                            Notes: request.Notes,
                            EmissionDate: GetBrazilNow(),
                            AccessCode: request.AccessCode,
                            PatientBirthDate: patientUser?.BirthDate,
                            PatientPhone: patientUser?.Phone?.Value,
                            PatientAddress: FormatPatientAddress(patientUser),
                            DoctorAddress: doctorProfile.ProfessionalAddress,
                            DoctorPhone: doctorProfile.ProfessionalPhone,
                            ClinicalIndication: request.Symptoms,
                            AutoObservation: request.AutoObservation,
                            DoctorConductNotes: request.DoctorConductNotes,
                            IncludeConductInPdf: request.IncludeConductInPdf);

                        var pdfResult = await prescriptionPdfService.GenerateExamRequestAsync(examPdfData, cancellationToken);
                        if (pdfResult.Success && pdfResult.PdfBytes != null)
                        {
                            pdfBytes = pdfResult.PdfBytes;
                            pdfFileName = $"pedido-exame-assinado-{request.Id}-{DateTime.UtcNow:yyyyMMddHHmmssfff}.pdf";
                        }
                        else
                            throw new InvalidOperationException("Falha ao gerar PDF do exame. " + (pdfResult.ErrorMessage ?? "Verifique os dados do pedido e tente novamente."));
                    }

                    if (pdfBytes == null || string.IsNullOrEmpty(pdfFileName))
                        throw new InvalidOperationException(request.RequestType == Domain.Enums.RequestType.Prescription
                            ? "Não foi possível gerar o PDF da receita. Verifique se há ao menos um medicamento informado."
                            : "Não foi possível gerar o PDF do exame. Verifique se há ao menos um exame informado.");

                    var certInfo = await digitalCertificateService.GetActiveCertificateAsync(doctorProfile.Id, cancellationToken);
                    if (certInfo == null)
                        throw new InvalidOperationException("Certificado ativo não encontrado. Cadastre ou reative um certificado em Configurações.");

                    var documentTypeHint = request.RequestType == Domain.Enums.RequestType.Exam ? "exam" : "prescription";
                    var signResult = await digitalCertificateService.SignPdfAsync(
                                certInfo.Id,
                                pdfBytes,
                                pdfFileName,
                                normalizedPfxPassword,
                                documentTypeHint,
                                cancellationToken);

                            if (signResult.Success)
                            {
                                request.Sign(signResult.SignedDocumentUrl!, signResult.SignatureId!);
                                request = await requestRepository.UpdateAsync(request, cancellationToken);

                                // Registra na tabela 'prescriptions' para o fluxo Verify v2 (QR Code)
                                if (request.RequestType == Domain.Enums.RequestType.Prescription ||
                                    request.RequestType == Domain.Enums.RequestType.Exam)
                                {
                                    try
                                    {
                                        var accessCode = request.AccessCode ?? GenerateAccessCode(request.Id);
                                        var pdfPath = $"signed/{pdfFileName}";
                                        var emissionDate = DateTime.UtcNow;
                                        var verifyRecord = new PrescriptionVerifyRecord(
                                            Id: request.Id,
                                            VerifyCodeHash: ComputeSha256(accessCode),
                                            PdfStoragePath: pdfPath,
                                            PatientInitials: GetInitials(request.PatientName),
                                            PrescriberCrmUf: doctorProfile.CrmState,
                                            PrescriberCrmLast4: GetLast4(doctorProfile.Crm),
                                            IssuedAt: emissionDate,
                                            IssuedDateStr: emissionDate.ToString("dd/MM/yyyy"),
                                            PdfHash: signResult.SignedPdfHash);
                                        await prescriptionVerifyRepository.UpsertAsync(verifyRecord, cancellationToken);
                                    }
                                    catch (Exception ex)
                                    {
                                        logger.LogError(ex, "Falha ao registrar documento {RequestId} no verify (não bloqueia a resposta)", request.Id);
                                    }
                                }

                                await pushDispatcher.SendAsync(PushNotificationRules.Signed(request.PatientId, request.Id, request.RequestType), cancellationToken);
                                await PublishRequestUpdatedAsync(request, "Documento assinado", cancellationToken);

                                await signedRequestClinicalSync.SyncSignedRequestAsync(
                                    request,
                                    signResult.SignedDocumentUrl!,
                                    signResult.SignatureId!,
                                    signResult.SignedAt ?? DateTime.UtcNow,
                                    certInfo.Id,
                                    certInfo.SubjectName,
                                    cancellationToken);

                                return MapRequestToDto(request);
                            }

                    // Propaga a mensagem amigável vinda do serviço de certificado sem duplicar prefixos.
                    var signErrorMessage = signResult.ErrorMessage;
                    if (string.IsNullOrWhiteSpace(signErrorMessage))
                    {
                        signErrorMessage = "Não foi possível assinar o PDF. Verifique a senha do certificado digital e tente novamente.";
                    }

                    throw new InvalidOperationException(signErrorMessage);
                }
            }

        // Fallback: aceitar URL externa apenas se o médico fornecer explicitamente
        if (string.IsNullOrWhiteSpace(dto.SignedDocumentUrl))
        {
            var msg = request.RequestType == Domain.Enums.RequestType.Prescription
                ? "Não foi possível gerar/assinar o PDF. Verifique: (1) médico tem certificado digital válido, (2) receita tem ao menos um medicamento informado."
                : request.RequestType == Domain.Enums.RequestType.Exam
                    ? "Não foi possível gerar/assinar o PDF. Verifique: (1) médico tem certificado digital válido, (2) pedido de exame tem ao menos um exame informado."
                    : "Assinatura requer fluxo específico. Entre em contato com o suporte.";
            throw new InvalidOperationException(msg);
        }

        var signedDocumentUrl = dto.SignedDocumentUrl.Trim();
        var signatureId = !string.IsNullOrWhiteSpace(dto.SignatureData) ? dto.SignatureData : Guid.NewGuid().ToString();

        request.Sign(signedDocumentUrl, signatureId);
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        await pushDispatcher.SendAsync(PushNotificationRules.Signed(request.PatientId, request.Id, request.RequestType), cancellationToken);
        await PublishRequestUpdatedAsync(request, "Documento assinado", cancellationToken);
        return MapRequestToDto(request);
    }

    public async Task<RequestResponseDto> ReanalyzePrescriptionAsync(Guid id, ReanalyzePrescriptionDto dto, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) throw new KeyNotFoundException("Solicitação não encontrada");
        if (request.RequestType != RequestType.Prescription) throw new InvalidOperationException("Apenas solicitações de receita podem ser reanalisadas.");
        if (request.PatientId != userId) throw new UnauthorizedAccessException("Somente o paciente da solicitação pode solicitar reanálise.");
        if (dto.PrescriptionImageUrls == null || dto.PrescriptionImageUrls.Count == 0)
            throw new ArgumentException("Envie pelo menos uma URL de imagem da receita.");
        var urls = dto.PrescriptionImageUrls.ToList();
        try
        {
            logger.LogInformation("IA reanálise receita (paciente): request {RequestId}, {UrlCount} URL(s)", id, urls.Count);
            var result = await aiReadingService.AnalyzePrescriptionAsync(urls, cancellationToken);
            if (!result.ReadabilityOk)
            {
                var msg = result.MessageToUser ?? "As imagens não parecem ser de receita médica. Envie apenas fotos do documento.";
                request.Reject(msg);
                request = await requestRepository.UpdateAsync(request, cancellationToken);
                logger.LogInformation("IA reanálise receita: request {RequestId} REJEITADO - imagens inválidas", id);
            }
            else if (result.HasDoubts == true)
            {
                request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, true, null);
                request = await requestRepository.UpdateAsync(request, cancellationToken);
                logger.LogInformation("IA reanálise receita: request {RequestId} encaminhado ao médico com dúvidas documentadas", id);
                if (request.DoctorId.HasValue)
                {
                    await CreateNotificationAsync(
                        request.DoctorId.Value,
                        "Reanálise Solicitada",
                        "O paciente solicitou reanálise da receita. Nova análise da IA disponível (com dúvidas para sua avaliação).",
                        cancellationToken,
                        new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
                }
            }
            else if (result.SignsOfTampering == true)
            {
                var msg = "O documento enviado apresenta sinais de adulteração, edição ou recorte para ocultar informações. Envie uma foto completa e original da receita, sem alterações.";
                request.Reject(msg);
                request = await requestRepository.UpdateAsync(request, cancellationToken);
                logger.LogInformation("IA reanálise receita: request {RequestId} REJEITADO - adulteração detectada", id);
            }
            else if (result.PatientNameVisible == false)
            {
                var msg = "O nome do paciente não está visível na receita (recortado, em branco ou ilegível). Envie uma foto completa do documento onde o nome do paciente esteja claramente legível.";
                request.Reject(msg);
                request = await requestRepository.UpdateAsync(request, cancellationToken);
                logger.LogInformation("IA reanálise receita: request {RequestId} REJEITADO - nome não visível", id);
            }
            else if (result.PrescriptionTypeVisible == false)
            {
                var msg = "O tipo da receita não está visível no documento (recortado ou oculto). Envie uma foto completa onde o cabeçalho da receita esteja visível.";
                request.Reject(msg);
                request = await requestRepository.UpdateAsync(request, cancellationToken);
                logger.LogInformation("IA reanálise receita: request {RequestId} REJEITADO - tipo não visível", id);
            }
            else
            {
                var userType = PrescriptionTypeToDisplay(request.PrescriptionType);
                if (!string.IsNullOrEmpty(result.ExtractedPrescriptionType) && !string.IsNullOrEmpty(userType) &&
                    !string.Equals(result.ExtractedPrescriptionType, userType, StringComparison.OrdinalIgnoreCase))
                {
                    var docLabel = PrescriptionTypeToRejectionLabel(result.ExtractedPrescriptionType);
                    var msg = $"O documento enviado é uma receita {docLabel}, mas você selecionou receita {PrescriptionTypeToRejectionLabel(userType)}. O tipo da receita enviada deve corresponder ao tipo selecionado. Por favor, crie uma nova solicitação escolhendo o tipo correto.";
                    request.Reject(msg);
                    request = await requestRepository.UpdateAsync(request, cancellationToken);
                    logger.LogInformation("IA reanálise receita: request {RequestId} REJEITADO - tipo incorreto. Documento={Doc}, Selecionado={Sel}", id, result.ExtractedPrescriptionType, userType);
                }
                else if (!string.IsNullOrEmpty(result.ExtractedPatientName) && !PatientNamesMatch(request.PatientName, result.ExtractedPatientName))
                {
                    var msg = $"O nome do paciente na receita ({result.ExtractedPatientName}) não corresponde ao nome cadastrado no app ({request.PatientName ?? "cadastro"}). A receita deve ser do próprio titular da conta. Verifique se o nome no seu cadastro está correto ou envie uma receita em seu nome.";
                    request.Reject(msg);
                    request = await requestRepository.UpdateAsync(request, cancellationToken);
                    logger.LogInformation("IA reanálise receita: request {RequestId} REJEITADO - nome do paciente não confere. Documento={Doc}, Cadastro={Cad}", id, result.ExtractedPatientName, request.PatientName);
                }
                else
                {
                    request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, true, null);
                    request = await requestRepository.UpdateAsync(request, cancellationToken);
                    logger.LogInformation("IA reanálise receita: sucesso para request {RequestId}", id);
                    if (request.DoctorId.HasValue)
                    {
                        await CreateNotificationAsync(
                            request.DoctorId.Value,
                            "Reanálise Solicitada",
                            "O paciente solicitou reanálise da receita. Nova análise da IA disponível.",
                            cancellationToken,
                            new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "IA reanálise receita (paciente): falhou para request {RequestId}. {Message}", id, ex.Message);
            request.SetAiAnalysis("[Reanálise por IA indisponível.]", null, null, null, null, null);
            request = await requestRepository.UpdateAsync(request, cancellationToken);
            await CreateNotificationAsync(
                request.PatientId,
                "Reanálise não concluída",
                "Não foi possível concluir a reanálise da IA. Tente novamente ou entre em contato com o suporte.",
                cancellationToken,
                new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
        }
        return MapRequestToDto(request);
    }

    public async Task<RequestResponseDto> ReanalyzeAsDoctorAsync(Guid id, Guid doctorId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) throw new KeyNotFoundException("Solicitação não encontrada");
        if (request.DoctorId != doctorId) throw new UnauthorizedAccessException("Somente o médico atribuído pode reanalisar.");

        if (request.RequestType == RequestType.Prescription)
        {
            if (request.PrescriptionImages.Count == 0)
                throw new InvalidOperationException("Não há imagens de receita para analisar.");
            try
            {
                logger.LogInformation("IA reanálise receita (médico): request {RequestId}, {ImageCount} imagem(ns)", id, request.PrescriptionImages.Count);
                var result = await aiReadingService.AnalyzePrescriptionAsync(request.PrescriptionImages, cancellationToken);
                if (result.ReadabilityOk)
                {
                    if (result.HasDoubts == true)
                    {
                        request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, true, null);
                        logger.LogInformation("IA reanálise receita (médico): request {RequestId} - dúvidas documentadas no resumo para avaliação", id);
                    }
                    else if (result.SignsOfTampering == true)
                    {
                        var msg = "O documento enviado apresenta sinais de adulteração, edição ou recorte para ocultar informações. Envie uma foto completa e original da receita, sem alterações.";
                        request.Reject(msg);
                        logger.LogInformation("IA reanálise receita (médico): request {RequestId} REJEITADO - adulteração detectada", id);
                    }
                    else if (result.PatientNameVisible == false)
                    {
                        var msg = "O nome do paciente não está visível na receita (recortado, em branco ou ilegível). Envie uma foto completa onde o nome esteja legível.";
                        request.Reject(msg);
                        logger.LogInformation("IA reanálise receita (médico): request {RequestId} REJEITADO - nome não visível", id);
                    }
                    else if (result.PrescriptionTypeVisible == false)
                    {
                        var msg = "O tipo da receita não está visível no documento (recortado ou oculto). Envie uma foto completa onde o cabeçalho esteja visível.";
                        request.Reject(msg);
                        logger.LogInformation("IA reanálise receita (médico): request {RequestId} REJEITADO - tipo não visível", id);
                    }
                    else
                    {
                        var userType = PrescriptionTypeToDisplay(request.PrescriptionType);
                        if (!string.IsNullOrEmpty(result.ExtractedPrescriptionType) && !string.IsNullOrEmpty(userType) &&
                            !string.Equals(result.ExtractedPrescriptionType, userType, StringComparison.OrdinalIgnoreCase))
                        {
                            var docLabel = PrescriptionTypeToRejectionLabel(result.ExtractedPrescriptionType);
                            var msg = $"O documento enviado é uma receita {docLabel}, mas a solicitação foi criada como receita {PrescriptionTypeToRejectionLabel(userType)}. O tipo da receita enviada deve corresponder ao tipo selecionado.";
                            request.Reject(msg);
                            logger.LogInformation("IA reanálise receita (médico): request {RequestId} REJEITADO - tipo incorreto. Documento={Doc}, Selecionado={Sel}", id, result.ExtractedPrescriptionType, userType);
                        }
                        else if (!string.IsNullOrEmpty(result.ExtractedPatientName) && !PatientNamesMatch(request.PatientName, result.ExtractedPatientName))
                        {
                            var msg = $"O nome do paciente na receita ({result.ExtractedPatientName}) não corresponde ao nome cadastrado no app ({request.PatientName ?? "cadastro"}). A receita deve ser do próprio titular da conta.";
                            request.Reject(msg);
                            logger.LogInformation("IA reanálise receita (médico): request {RequestId} REJEITADO - nome do paciente não confere. Documento={Doc}, Cadastro={Cad}", id, result.ExtractedPatientName, request.PatientName);
                        }
                        else
                        {
                            request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, true, null);
                            logger.LogInformation("IA reanálise receita (médico): sucesso para request {RequestId}", id);
                        }
                    }
                }
                else
                {
                    request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, false, result.MessageToUser);
                    logger.LogInformation("IA reanálise receita (médico): legibilidade falhou para request {RequestId}", id);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "IA reanálise receita (médico): falhou para request {RequestId}. {Message}", id, ex.Message);
                request.SetAiAnalysis("[Reanálise por IA indisponível. Verifique a chave OpenAI e as URLs das imagens.]", null, null, null, null, null);
            }
        }
        else if (request.RequestType == RequestType.Exam)
        {
            var textDescription = !string.IsNullOrEmpty(request.Symptoms) ? request.Symptoms : null;
            var imageUrls = request.ExamImages.Count > 0 ? request.ExamImages : null;
            if ((imageUrls == null || imageUrls.Count == 0) && string.IsNullOrWhiteSpace(textDescription))
                throw new InvalidOperationException("Não há imagens ou texto de exame para analisar.");
            try
            {
                logger.LogInformation("IA reanálise exame (médico): request {RequestId}", id);
                var result = await aiReadingService.AnalyzeExamAsync(imageUrls, textDescription, cancellationToken);
                var hasImages = imageUrls != null && imageUrls.Count > 0;
                if (hasImages && !result.ReadabilityOk)
                {
                    var msg = result.MessageToUser ?? "A imagem não parece ser de pedido de exame.";
                    request.Reject(msg);
                    logger.LogInformation("IA reanálise exame (médico): request {RequestId} REJEITADO - imagens inválidas", id);
                }
                else if (hasImages && result.HasDoubts == true)
                {
                    request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, true, null);
                    logger.LogInformation("IA reanálise exame (médico): request {RequestId} - dúvidas documentadas para avaliação", id);
                }
                else if (hasImages && result.SignsOfTampering == true)
                {
                    var msg = "O documento apresenta sinais de adulteração. Envie uma foto completa e original do pedido de exame.";
                    request.Reject(msg);
                    logger.LogInformation("IA reanálise exame (médico): request {RequestId} REJEITADO - adulteração", id);
                }
                else if (hasImages && result.PatientNameVisible == false)
                {
                    var msg = "O nome do paciente não está visível no documento. Envie uma foto completa onde o nome esteja legível.";
                    request.Reject(msg);
                    logger.LogInformation("IA reanálise exame (médico): request {RequestId} REJEITADO - nome não visível", id);
                }
                else if (hasImages && !string.IsNullOrEmpty(result.ExtractedPatientName) && !PatientNamesMatch(request.PatientName, result.ExtractedPatientName))
                {
                    var msg = $"O nome no documento ({result.ExtractedPatientName}) não corresponde ao cadastro ({request.PatientName ?? "cadastro"}).";
                    request.Reject(msg);
                    logger.LogInformation("IA reanálise exame (médico): request {RequestId} REJEITADO - nome não confere", id);
                }
                else
                {
                    request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, result.ReadabilityOk, result.MessageToUser);
                    logger.LogInformation("IA reanálise exame (médico): sucesso para request {RequestId}", id);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "IA reanálise exame (médico): falhou para request {RequestId}. {Message}", id, ex.Message);
                request.SetAiAnalysis("[Reanálise por IA indisponível.]", null, null, null, null, null);
            }
        }
        else
            throw new InvalidOperationException("Apenas receitas e exames podem ser reanalisados pela IA.");

        request = await requestRepository.UpdateAsync(request, cancellationToken);
        await CreateNotificationAsync(
            doctorId,
            "Reanálise concluída",
            "A reanálise da IA foi concluída. A nova análise está disponível.",
            cancellationToken,
            new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
        return MapRequestToDto(request);
    }

    public async Task<RequestResponseDto> ReanalyzeExamAsync(Guid id, ReanalyzeExamDto dto, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) throw new KeyNotFoundException("Solicitação não encontrada");
        if (request.RequestType != RequestType.Exam) throw new InvalidOperationException("Apenas solicitações de exame podem ser reanalisadas.");
        if (request.PatientId != userId) throw new UnauthorizedAccessException("Somente o paciente da solicitação pode solicitar reanálise.");
        var imageUrls = dto.ExamImageUrls?.ToList() ?? new List<string>();
        var textDescription = dto.TextDescription?.Trim();
        if (imageUrls.Count == 0 && string.IsNullOrWhiteSpace(textDescription))
            throw new ArgumentException("Envie imagens do pedido de exame e/ou texto para reanalisar.");
        try
        {
            logger.LogInformation("IA reanálise exame (paciente): request {RequestId}, Imagens={ImageCount}, TextoLen={TextLen}", id, imageUrls.Count, textDescription?.Length ?? 0);
            var result = await aiReadingService.AnalyzeExamAsync(imageUrls, textDescription, cancellationToken);
            var hasImages = imageUrls.Count > 0;
            if (hasImages && !result.ReadabilityOk)
            {
                var msg = result.MessageToUser ?? "As imagens não parecem ser de pedido de exame. Envie apenas imagens do documento médico.";
                request.Reject(msg);
                request = await requestRepository.UpdateAsync(request, cancellationToken);
                logger.LogInformation("IA reanálise exame: request {RequestId} REJEITADO - imagens inválidas", id);
            }
            else if (hasImages && result.HasDoubts == true)
            {
                request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, true, null);
                request = await requestRepository.UpdateAsync(request, cancellationToken);
                logger.LogInformation("IA reanálise exame: request {RequestId} encaminhado ao médico com dúvidas", id);
                if (request.DoctorId.HasValue)
                {
                    await CreateNotificationAsync(
                        request.DoctorId.Value,
                        "Reanálise Solicitada",
                        "O paciente solicitou reanálise do pedido de exame. Nova análise da IA disponível (com dúvidas para sua avaliação).",
                        cancellationToken,
                        new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
                }
            }
            else if (hasImages && result.SignsOfTampering == true)
            {
                var msg = "O documento apresenta sinais de adulteração ou recorte. Envie uma foto completa e original do pedido de exame.";
                request.Reject(msg);
                request = await requestRepository.UpdateAsync(request, cancellationToken);
                logger.LogInformation("IA reanálise exame: request {RequestId} REJEITADO - adulteração", id);
            }
            else if (hasImages && result.PatientNameVisible == false)
            {
                var msg = "O nome do paciente não está visível no documento. Envie uma foto completa onde o nome esteja legível.";
                request.Reject(msg);
                request = await requestRepository.UpdateAsync(request, cancellationToken);
                logger.LogInformation("IA reanálise exame: request {RequestId} REJEITADO - nome não visível", id);
            }
            else if (hasImages && !string.IsNullOrEmpty(result.ExtractedPatientName) && !PatientNamesMatch(request.PatientName, result.ExtractedPatientName))
            {
                var msg = $"O nome no documento ({result.ExtractedPatientName}) não corresponde ao cadastro ({request.PatientName ?? "cadastro"}). O pedido deve ser do titular da conta.";
                request.Reject(msg);
                request = await requestRepository.UpdateAsync(request, cancellationToken);
                logger.LogInformation("IA reanálise exame: request {RequestId} REJEITADO - nome não confere", id);
            }
            else
            {
                request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, result.ReadabilityOk, result.MessageToUser);
                request = await requestRepository.UpdateAsync(request, cancellationToken);
                logger.LogInformation("IA reanálise exame (paciente): sucesso para request {RequestId}", id);
                if (request.DoctorId.HasValue)
                {
                    await CreateNotificationAsync(
                        request.DoctorId.Value,
                        "Reanálise Solicitada",
                        "O paciente solicitou reanálise do pedido de exame. Nova análise da IA disponível.",
                        cancellationToken,
                        new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "IA reanálise exame (paciente): falhou para request {RequestId}. {Message}", id, ex.Message);
            request.SetAiAnalysis("[Reanálise por IA indisponível.]", null, null, null, null, null);
            request = await requestRepository.UpdateAsync(request, cancellationToken);
            await CreateNotificationAsync(
                request.PatientId,
                "Reanálise não concluída",
                "Não foi possível concluir a reanálise da IA. Tente novamente ou entre em contato com o suporte.",
                cancellationToken,
                new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
        }
        return MapRequestToDto(request);
    }

    public async Task<RequestResponseDto> UpdatePrescriptionContentAsync(Guid id, List<string>? medications, string? notes, Guid doctorId, CancellationToken cancellationToken = default, string? prescriptionKind = null)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) throw new KeyNotFoundException("Solicitação não encontrada");
        if (request.DoctorId != doctorId) throw new UnauthorizedAccessException("Somente o médico atribuído pode atualizar.");
        if (request.RequestType != RequestType.Prescription) throw new InvalidOperationException("Apenas receitas podem ter medicamentos atualizados.");
        if (request.Status != RequestStatus.Paid)
            throw new InvalidOperationException("Só é possível editar medicamentos/notas após o pagamento. O paciente deve pagar antes de editar e assinar.");
        var oldValues = new Dictionary<string, object?>
        {
            ["medications"] = request.Medications,
            ["notes"] = request.Notes,
            ["prescription_kind"] = request.PrescriptionKind?.ToString()
        };
        var pk = prescriptionKind != null ? ParsePrescriptionKind(prescriptionKind) : null;
        request.UpdatePrescriptionContent(medications, notes, pk);
        request = await requestRepository.UpdateAsync(request, cancellationToken);
        var newValues = new Dictionary<string, object?>
        {
            ["medications"] = request.Medications,
            ["notes"] = request.Notes,
            ["prescription_kind"] = request.PrescriptionKind?.ToString()
        };
        await auditService.LogModificationAsync(doctorId, "Update", "Request", id, oldValues, newValues, cancellationToken: cancellationToken);
        await CreateNotificationAsync(
            request.PatientId,
            "Receita atualizada",
            "O médico atualizou sua receita. O documento está disponível para assinatura.",
            cancellationToken,
            new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
        return MapRequestToDto(request);
    }

    public async Task<RequestResponseDto> UpdateExamContentAsync(Guid id, List<string>? exams, string? notes, Guid doctorId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) throw new KeyNotFoundException("Solicitação não encontrada");
        if (request.DoctorId != doctorId) throw new UnauthorizedAccessException("Somente o médico atribuído pode atualizar.");
        if (request.RequestType != RequestType.Exam) throw new InvalidOperationException("Apenas pedidos de exame podem ter exames atualizados.");
        if (request.Status != RequestStatus.Paid)
            throw new InvalidOperationException("Só é possível editar exames/notas após o pagamento. O paciente deve pagar antes de editar e assinar.");
        var oldValues = new Dictionary<string, object?>
        {
            ["exams"] = request.Exams,
            ["notes"] = request.Notes
        };
        request.UpdateExamContent(exams, notes);
        request = await requestRepository.UpdateAsync(request, cancellationToken);
        var newValues = new Dictionary<string, object?>
        {
            ["exams"] = request.Exams,
            ["notes"] = request.Notes
        };
        await auditService.LogModificationAsync(doctorId, "Update", "Request", id, oldValues, newValues, cancellationToken: cancellationToken);
        await CreateNotificationAsync(
            request.PatientId,
            "Pedido de exame atualizado",
            "O médico atualizou seu pedido de exame. O documento está disponível para assinatura.",
            cancellationToken,
            new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
        return MapRequestToDto(request);
    }

    public async Task<(bool IsValid, IReadOnlyList<string> MissingFields, IReadOnlyList<string> Messages)> ValidatePrescriptionAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");
        if (request.RequestType != RequestType.Prescription && request.RequestType != RequestType.Exam)
            throw new InvalidOperationException("Apenas solicitações de receita ou exame podem ser validadas.");
        var isDoctor = request.DoctorId == userId;
        var isPatient = request.PatientId == userId;
        if (!isDoctor && !isPatient)
            throw new UnauthorizedAccessException("Somente o médico ou paciente podem validar a receita ou exame.");

        var doctorProfile = request.DoctorId.HasValue ? await doctorRepository.GetByUserIdAsync(request.DoctorId.Value, cancellationToken) : null;
        var doctorUser = request.DoctorId.HasValue ? await userRepository.GetByIdAsync(request.DoctorId.Value, cancellationToken) : null;
        var patientUser = await userRepository.GetByIdAsync(request.PatientId, cancellationToken);

        if (request.RequestType == RequestType.Prescription)
        {
            var medications = request.Medications?.Where(m => !string.IsNullOrWhiteSpace(m)).ToList() ?? new List<string>();
            if (medications.Count == 0 && !string.IsNullOrWhiteSpace(request.AiExtractedJson))
                medications = ParseMedicationsFromAiJson(request.AiExtractedJson);

            var kind = request.PrescriptionKind ?? PrescriptionKind.Simple;
            var result = PrescriptionComplianceValidator.Validate(
                kind,
                request.PatientName,
                patientUser?.Cpf,
                patientUser?.Address,
                patientUser?.Gender,
                patientUser?.BirthDate,
                medications,
                doctorUser?.Name ?? request.DoctorName,
                doctorProfile?.Crm,
                doctorProfile?.CrmState,
                doctorProfile?.ProfessionalAddress,
                doctorProfile?.ProfessionalPhone);
            return (result.IsValid, result.MissingFields, result.Messages);
        }

        var exams = request.Exams?.Where(e => !string.IsNullOrWhiteSpace(e)).ToList() ?? new List<string>();
        var examResult = PrescriptionComplianceValidator.ValidateExam(
            request.PatientName,
            patientUser?.Cpf,
            exams,
            doctorUser?.Name ?? request.DoctorName,
            doctorProfile?.Crm,
            doctorProfile?.CrmState,
            doctorProfile?.ProfessionalAddress,
            doctorProfile?.ProfessionalPhone);
        return (examResult.IsValid, examResult.MissingFields, examResult.Messages);
    }

    public async Task<byte[]?> GetPrescriptionPdfPreviewAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) return null;
        if (request.RequestType != RequestType.Prescription) return null;
        var isDoctor = request.DoctorId == userId;
        var isPatient = request.PatientId == userId;
        if (!isDoctor && !isPatient) return null;

        var medications = request.Medications?.Where(m => !string.IsNullOrWhiteSpace(m)).ToList() ?? new List<string>();
        if (medications.Count == 0 && !string.IsNullOrWhiteSpace(request.AiExtractedJson))
            medications = ParseMedicationsFromAiJson(request.AiExtractedJson);
        // Não retornar null quando não há medicamentos: o PrescriptionPdfService gera um PDF com placeholder
        // para o médico sempre ver o preview da receita na tela de edição.

        var doctorProfile = request.DoctorId.HasValue ? await doctorRepository.GetByUserIdAsync(request.DoctorId.Value, cancellationToken) : null;
        var doctorUser = request.DoctorId.HasValue ? await userRepository.GetByIdAsync(request.DoctorId.Value, cancellationToken) : null;
        var patientUser = await userRepository.GetByIdAsync(request.PatientId, cancellationToken);

        var kind = request.PrescriptionKind ?? PrescriptionKind.Simple;

        List<PrescriptionMedicationItem>? aiMedItems2 = null;
        if (medications.Count == 0 || medications.All(m => m.Trim().Length < 5))
        {
            var aiInput2 = new AiPrescriptionGeneratorInput(
                PatientName: request.PatientName ?? "Paciente",
                PatientBirthDate: patientUser?.BirthDate,
                PatientGender: patientUser?.Gender,
                Symptoms: request.Symptoms,
                AiSummaryForDoctor: request.AiSummaryForDoctor,
                AiExtractedJson: request.AiExtractedJson,
                DoctorNotes: request.Notes,
                Kind: kind);
            aiMedItems2 = await aiPrescriptionGenerator.GenerateMedicationsAsync(aiInput2, cancellationToken);
        }

        var pdfData = new PrescriptionPdfData(
            request.Id,
            request.PatientName ?? "Paciente",
            patientUser?.Cpf,
            doctorUser?.Name ?? request.DoctorName ?? "Médico",
            doctorProfile?.Crm ?? "CRM",
            doctorProfile?.CrmState ?? "SP",
            doctorProfile?.Specialty ?? "Clínica Geral",
            medications,
            PrescriptionTypeToDisplay(request.PrescriptionType) ?? "simples",
            DateTime.UtcNow,
            AdditionalNotes: request.Notes,
            PrescriptionKind: kind,
            PatientGender: patientUser?.Gender,
            PatientPhone: patientUser?.Phone?.Value,
            PatientAddress: FormatPatientAddress(patientUser),
            PatientBirthDate: patientUser?.BirthDate,
            MedicationItems: aiMedItems2,
            DoctorAddress: doctorProfile?.ProfessionalAddress,
            DoctorPhone: doctorProfile?.ProfessionalPhone,
            AutoObservation: request.AutoObservation,
            DoctorConductNotes: request.DoctorConductNotes,
            IncludeConductInPdf: request.IncludeConductInPdf);

        var result = await prescriptionPdfService.GenerateAsync(pdfData, cancellationToken);
        return result.Success ? result.PdfBytes : null;
    }

    /// <summary>
    /// Gera preview do PDF de pedido de exame para o médico visualizar antes de assinar.
    /// </summary>
    public async Task<byte[]?> GetExamPdfPreviewAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) return null;
        if (request.RequestType != RequestType.Exam) return null;
        var isDoctor = request.DoctorId == userId;
        var isPatient = request.PatientId == userId;
        if (!isDoctor && !isPatient) return null;

        var exams = request.Exams?.Where(e => !string.IsNullOrWhiteSpace(e)).ToList() ?? new List<string>();
        if (exams.Count == 0)
            exams = new List<string> { "Exames conforme solicitação médica" };

        var doctorProfile = request.DoctorId.HasValue ? await doctorRepository.GetByUserIdAsync(request.DoctorId.Value, cancellationToken) : null;
        var doctorUser = request.DoctorId.HasValue ? await userRepository.GetByIdAsync(request.DoctorId.Value, cancellationToken) : null;
        var patientUser = await userRepository.GetByIdAsync(request.PatientId, cancellationToken);

        var examPdfData = new ExamPdfData(
            RequestId: request.Id,
            PatientName: request.PatientName ?? "Paciente",
            PatientCpf: patientUser?.Cpf,
            DoctorName: doctorUser?.Name ?? request.DoctorName ?? "Médico",
            DoctorCrm: doctorProfile?.Crm ?? "CRM",
            DoctorCrmState: doctorProfile?.CrmState ?? "SP",
            DoctorSpecialty: doctorProfile?.Specialty ?? "Clínica Geral",
            Exams: exams,
            Notes: request.Notes,
            EmissionDate: DateTime.UtcNow,
            AccessCode: request.AccessCode,
            PatientBirthDate: patientUser?.BirthDate,
            PatientPhone: patientUser?.Phone?.Value,
            PatientAddress: FormatPatientAddress(patientUser),
            DoctorAddress: doctorProfile?.ProfessionalAddress,
            DoctorPhone: doctorProfile?.ProfessionalPhone,
            ClinicalIndication: request.Symptoms,
            AutoObservation: request.AutoObservation,
            DoctorConductNotes: request.DoctorConductNotes,
            IncludeConductInPdf: request.IncludeConductInPdf);

        var result = await prescriptionPdfService.GenerateExamRequestAsync(examPdfData, cancellationToken);
        return result.Success ? result.PdfBytes : null;
    }

    /// <summary>
    /// Paciente marca o documento como entregue (Signed → Delivered) ao baixar/abrir o PDF.
    /// </summary>
    public async Task<RequestResponseDto> MarkDeliveredAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        if (request.PatientId != userId)
            throw new UnauthorizedAccessException("Only the patient can mark the document as delivered");

        request.Deliver();
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        await PublishRequestUpdatedAsync(request, "Documento recebido", cancellationToken);
        // Notifica o médico que o paciente recebeu/baixou o documento
        if (request.DoctorId.HasValue)
        {
            var tipoDoc = request.RequestType == RequestType.Prescription ? "receita" : "pedido de exame";
            await CreateNotificationAsync(
                request.DoctorId.Value,
                "Documento Recebido",
                $"O paciente {request.PatientName ?? "paciente"} recebeu o {tipoDoc}.",
                cancellationToken,
                new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
        }

        return MapRequestToDto(request);
    }

    private static readonly HashSet<RequestStatus> CancellableStatuses =
    [
        RequestStatus.Submitted,
        RequestStatus.InReview,
        RequestStatus.ApprovedPendingPayment,
#pragma warning disable CS0618 // Status legado: permitir cancelamento de pedidos antigos
        RequestStatus.PendingPayment,
#pragma warning restore CS0618
        RequestStatus.SearchingDoctor
    ];

    /// <summary>
    /// Paciente cancela o pedido. Só é permitido antes do pagamento (submitted, in_review, approved_pending_payment, searching_doctor).
    /// </summary>
    public async Task<RequestResponseDto> CancelAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        if (request.PatientId != userId)
            throw new UnauthorizedAccessException("Only the patient can cancel this request");

        if (!CancellableStatuses.Contains(request.Status))
            throw new InvalidOperationException("Request can only be cancelled before payment is confirmed");

        request.Cancel();
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        await PublishRequestUpdatedAsync(request, "Pedido cancelado", cancellationToken);
        if (request.DoctorId.HasValue)
        {
            await CreateNotificationAsync(
                request.DoctorId.Value,
                "Pedido Cancelado",
                "O paciente cancelou o pedido.",
                cancellationToken,
                new Dictionary<string, object?> { ["requestId"] = request.Id.ToString() });
        }

        return MapRequestToDto(request);
    }

    /// <summary>
    /// Obtém bytes do PDF assinado. Paciente ou médico atribuído ao atendimento.
    /// </summary>
    public async Task<byte[]?> GetSignedDocumentAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null || string.IsNullOrWhiteSpace(request.SignedDocumentUrl))
            return null;

        var isPatient = request.PatientId == userId;
        var isDoctor = request.DoctorId.HasValue && request.DoctorId.Value == userId;
        if (!isPatient && !isDoctor)
            return null;

        try
        {
            return await DownloadSignedDocumentAsync(request.SignedDocumentUrl, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falha ao buscar PDF assinado para request {RequestId}", id);
            return null;
        }
    }

    /// <summary>
    /// Obtém bytes do PDF assinado via token temporário (para links abertos em navegador sem Bearer).
    /// </summary>
    public async Task<byte[]?> GetSignedDocumentByTokenAsync(Guid id, string? token, CancellationToken cancellationToken = default)
    {
        if (!documentTokenService.ValidateDocumentToken(token, id))
            return null;

        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null || string.IsNullOrWhiteSpace(request.SignedDocumentUrl))
            return null;

        try
        {
            return await DownloadSignedDocumentAsync(request.SignedDocumentUrl, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falha ao buscar PDF assinado (token) para request {RequestId}", id);
            return null;
        }
    }

    /// <summary>
    /// Baixa o PDF assinado: path (Storage) ou URL (legado/externo).
    /// Path: storageService.DownloadAsync. URL: DownloadFromStorageUrlAsync ou HTTP fallback.
    /// </summary>
    private async Task<byte[]?> DownloadSignedDocumentAsync(string refOrUrl, CancellationToken cancellationToken)
    {
        var trimmed = refOrUrl.Trim();

        // Caso novo: PATH (ex.: signed/abc.pdf) — bucket pode ser privado
        if (!trimmed.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            return await storageService.DownloadAsync(trimmed, cancellationToken);

        // Caso legado: URL — tenta nosso storage primeiro (service_role), senão HTTP
        var bytes = await storageService.DownloadFromStorageUrlAsync(trimmed, cancellationToken);
        if (bytes != null) return bytes;

        using var client = httpClientFactory.CreateClient();
        return await client.GetByteArrayAsync(trimmed, cancellationToken);
    }

    /// <summary>
    /// Obtém bytes de uma imagem de receita ou exame. Valida acesso via token ou Bearer.
    /// </summary>
    public async Task<byte[]?> GetRequestImageAsync(Guid id, string? token, Guid? userId, string imageType, int index, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            return null;

        if (!string.IsNullOrWhiteSpace(token))
        {
            if (!documentTokenService.ValidateDocumentToken(token, id))
                return null;
        }
        else if (userId.HasValue)
        {
            var isPatient = request.PatientId == userId.Value;
            var isAssignedDoctor = request.DoctorId.HasValue && request.DoctorId.Value == userId.Value;
            var isAvailableForDoctor = !request.DoctorId.HasValue || request.DoctorId == Guid.Empty;
            User? user = null;
            if (!isPatient && !isAssignedDoctor && isAvailableForDoctor)
                user = await userRepository.GetByIdAsync(userId.Value, cancellationToken);
            var canAccess = isPatient || isAssignedDoctor || (isAvailableForDoctor && user?.Role == UserRole.Doctor);
            if (!canAccess)
                return null;
        }
        else
        {
            return null;
        }

        List<string> urls;
        if (string.Equals(imageType, "prescription", StringComparison.OrdinalIgnoreCase))
            urls = request.PrescriptionImages;
        else if (string.Equals(imageType, "exam", StringComparison.OrdinalIgnoreCase))
            urls = request.ExamImages;
        else
            return null;

        if (urls == null || index < 0 || index >= urls.Count)
            return null;

        var storageUrl = urls[index];
        return await storageService.DownloadFromStorageUrlAsync(storageUrl, cancellationToken);
    }

    private async Task CreateNotificationAsync(
        Guid userId,
        string title,
        string message,
        CancellationToken cancellationToken,
        Dictionary<string, object?>? data = null)
    {
        var notification = Notification.Create(userId, title, message, NotificationType.Info, data);
        await notificationRepository.CreateAsync(notification, cancellationToken);
        await pushNotificationSender.SendAsync(userId, title, message, ct: cancellationToken);
    }

    /// <summary>
    /// Notifica médicos disponíveis sobre nova solicitação na fila. Usa batching: pedidos em 2 min viram "X novas solicitações".
    /// </summary>
    private async Task NotifyAvailableDoctorsOfNewRequestAsync(
        string tipoSolicitacao,
        MedicalRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var doctors = await doctorRepository.GetAvailableAsync(null, cancellationToken);
            foreach (var doc in doctors.Take(3))
                newRequestBatchService.AddToBatch(doc.UserId, tipoSolicitacao);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falha ao notificar médicos sobre nova solicitação {RequestId}", request.Id);
        }
    }

    private async Task RunPrescriptionAiAndUpdateAsync(MedicalRequest medicalRequest, CancellationToken cancellationToken)
    {
        if (medicalRequest.PrescriptionImages == null || medicalRequest.PrescriptionImages.Count == 0)
        {
            logger.LogInformation("IA receita: request {RequestId} sem imagens, pulando análise", medicalRequest.Id);
            return;
        }
        logger.LogInformation("IA receita: iniciando análise para request {RequestId} com {ImageCount} imagem(ns). URLs: {Urls}",
            medicalRequest.Id, medicalRequest.PrescriptionImages.Count, string.Join("; ", medicalRequest.PrescriptionImages.Take(3)));
        try
        {
            var result = await aiReadingService.AnalyzePrescriptionAsync(medicalRequest.PrescriptionImages, cancellationToken);
            if (!result.ReadabilityOk)
            {
                var msg = result.MessageToUser ?? "A imagem não parece ser de uma receita médica. Envie apenas fotos do documento da receita.";
                medicalRequest.Reject(msg);
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                logger.LogInformation("IA receita: request {RequestId} REJEITADO - imagens inválidas. Mensagem: {Msg}", medicalRequest.Id, msg);
                return;
            }
            if (result.HasDoubts == true)
            {
                medicalRequest.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, true, null);
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                logger.LogInformation("IA receita: request {RequestId} encaminhado ao médico com dúvidas documentadas no resumo", medicalRequest.Id);
                return;
            }
            if (result.SignsOfTampering == true)
            {
                var msg = "O documento enviado apresenta sinais de adulteração, edição ou recorte para ocultar informações. Envie uma foto completa e original da receita, sem alterações.";
                medicalRequest.Reject(msg);
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                logger.LogInformation("IA receita: request {RequestId} REJEITADO - adulteração detectada", medicalRequest.Id);
                return;
            }
            if (result.PatientNameVisible == false)
            {
                var msg = "O nome do paciente não está visível na receita (recortado, em branco ou ilegível). Envie uma foto completa do documento onde o nome do paciente esteja claramente legível.";
                medicalRequest.Reject(msg);
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                logger.LogInformation("IA receita: request {RequestId} REJEITADO - nome do paciente não visível", medicalRequest.Id);
                return;
            }
            if (result.PrescriptionTypeVisible == false)
            {
                var msg = "O tipo da receita (simples, controlada ou azul) não está visível no documento (recortado ou oculto). Envie uma foto completa onde o cabeçalho da receita esteja visível.";
                medicalRequest.Reject(msg);
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                logger.LogInformation("IA receita: request {RequestId} REJEITADO - tipo da receita não visível", medicalRequest.Id);
                return;
            }
            var userType = PrescriptionTypeToDisplay(medicalRequest.PrescriptionType);
            if (!string.IsNullOrEmpty(result.ExtractedPrescriptionType) && !string.IsNullOrEmpty(userType) &&
                !string.Equals(result.ExtractedPrescriptionType, userType, StringComparison.OrdinalIgnoreCase))
            {
                var docLabel = PrescriptionTypeToRejectionLabel(result.ExtractedPrescriptionType);
                var msg = $"O documento enviado é uma receita {docLabel}, mas você selecionou receita {PrescriptionTypeToRejectionLabel(userType)}. O tipo da receita enviada deve corresponder ao tipo selecionado. Por favor, crie uma nova solicitação escolhendo o tipo correto.";
                medicalRequest.Reject(msg);
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                logger.LogInformation("IA receita: request {RequestId} REJEITADO - tipo incorreto. Documento={Doc}, Selecionado={Sel}", medicalRequest.Id, result.ExtractedPrescriptionType, userType);
                return;
            }
            if (!string.IsNullOrEmpty(result.ExtractedPatientName) && !PatientNamesMatch(medicalRequest.PatientName, result.ExtractedPatientName))
            {
                var msg = $"O nome do paciente na receita ({result.ExtractedPatientName}) não corresponde ao nome cadastrado no app ({medicalRequest.PatientName ?? "cadastro"}). A receita deve ser do próprio titular da conta. Verifique se o nome no seu cadastro está correto ou envie uma receita em seu nome.";
                medicalRequest.Reject(msg);
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                logger.LogInformation("IA receita: request {RequestId} REJEITADO - nome do paciente não confere. Documento={Doc}, Cadastro={Cad}", medicalRequest.Id, result.ExtractedPatientName, medicalRequest.PatientName);
                return;
            }
            medicalRequest.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, true, null);
            await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
            logger.LogInformation("IA receita: análise concluída para request {RequestId}. SummaryLength={Len}", medicalRequest.Id, result.SummaryForDoctor?.Length ?? 0);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "IA receita: análise falhou para request {RequestId}. Mensagem: {Message}. Inner: {Inner}",
                medicalRequest.Id, ex.Message, ex.InnerException?.Message ?? "-");
            medicalRequest.SetAiAnalysis("[Análise por IA indisponível no momento. O médico pode clicar em Reanalisar com IA.]", null, null, null, null, null);
            try
            {
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
            }
            catch (Exception updateEx)
            {
                logger.LogError(updateEx, "IA receita: falha ao persistir fallback para request {RequestId}", medicalRequest.Id);
            }
        }
    }

    private async Task RunExamAiAndUpdateAsync(MedicalRequest medicalRequest, CancellationToken cancellationToken)
    {
        var parts = new List<string>();
        if (!string.IsNullOrEmpty(medicalRequest.ExamType)) parts.Add($"Tipo: {medicalRequest.ExamType}");
        if (medicalRequest.Exams?.Count > 0) parts.Add("Exames: " + string.Join(", ", medicalRequest.Exams));
        if (!string.IsNullOrEmpty(medicalRequest.Symptoms)) parts.Add(medicalRequest.Symptoms);
        var textDescription = parts.Count > 0 ? string.Join("\n", parts) : null;
        var imageUrls = medicalRequest.ExamImages?.Count > 0 ? medicalRequest.ExamImages : null;
        if (string.IsNullOrWhiteSpace(textDescription) && (imageUrls == null || imageUrls.Count == 0))
        {
            logger.LogInformation("IA exame: request {RequestId} sem texto nem imagens, pulando análise", medicalRequest.Id);
            return;
        }
        logger.LogInformation("IA exame: iniciando análise para request {RequestId}. Imagens={ImageCount}, TextoLen={TextLen}",
            medicalRequest.Id, imageUrls?.Count ?? 0, textDescription?.Length ?? 0);
        try
        {
            var result = await aiReadingService.AnalyzeExamAsync(imageUrls, textDescription, cancellationToken);
            var hasImages = imageUrls != null && imageUrls.Count > 0;
            if (hasImages && !result.ReadabilityOk)
            {
                var msg = result.MessageToUser ?? "A imagem não parece ser de pedido de exame ou documento médico. Envie apenas imagens do documento.";
                medicalRequest.Reject(msg);
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                logger.LogInformation("IA exame: request {RequestId} REJEITADO - imagens inválidas. Mensagem: {Msg}", medicalRequest.Id, msg);
                return;
            }
            if (hasImages && result.HasDoubts == true)
            {
                medicalRequest.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, true, null);
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                logger.LogInformation("IA exame: request {RequestId} encaminhado ao médico com dúvidas documentadas", medicalRequest.Id);
                return;
            }
            if (hasImages && result.SignsOfTampering == true)
            {
                var msg = "O documento enviado apresenta sinais de adulteração, edição ou recorte para ocultar informações. Envie uma foto completa e original do pedido de exame, sem alterações.";
                medicalRequest.Reject(msg);
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                logger.LogInformation("IA exame: request {RequestId} REJEITADO - adulteração detectada", medicalRequest.Id);
                return;
            }
            if (hasImages && result.PatientNameVisible == false)
            {
                var msg = "O nome do paciente não está visível no documento (recortado, em branco ou ilegível). Envie uma foto completa onde o nome do paciente esteja claramente legível.";
                medicalRequest.Reject(msg);
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                logger.LogInformation("IA exame: request {RequestId} REJEITADO - nome do paciente não visível", medicalRequest.Id);
                return;
            }
            if (hasImages && !string.IsNullOrEmpty(result.ExtractedPatientName) && !PatientNamesMatch(medicalRequest.PatientName, result.ExtractedPatientName))
            {
                var msg = $"O nome do paciente no documento ({result.ExtractedPatientName}) não corresponde ao nome cadastrado no app ({medicalRequest.PatientName ?? "cadastro"}). O pedido deve ser do próprio titular da conta.";
                medicalRequest.Reject(msg);
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
                logger.LogInformation("IA exame: request {RequestId} REJEITADO - nome do paciente não confere", medicalRequest.Id);
                return;
            }
            medicalRequest.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, result.ReadabilityOk, result.MessageToUser);
            await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
            logger.LogInformation("IA exame: análise concluída para request {RequestId}. SummaryLength={Len}", medicalRequest.Id, result.SummaryForDoctor?.Length ?? 0);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "IA exame: análise falhou para request {RequestId}. Mensagem: {Message}. Inner: {Inner}",
                medicalRequest.Id, ex.Message, ex.InnerException?.Message ?? "-");
            medicalRequest.SetAiAnalysis("[Análise por IA indisponível no momento. O médico pode clicar em Reanalisar com IA.]", null, null, null, null, null);
            try
            {
                await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
            }
            catch (Exception updateEx)
            {
                logger.LogError(updateEx, "IA exame: falha ao persistir fallback para request {RequestId}", medicalRequest.Id);
            }
        }
    }

    /// <summary>Extrai medicamentos do JSON extraído pela IA (extracted.medications).</summary>
    private static List<string> ParseMedicationsFromAiJson(string aiExtractedJson)
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
        catch { /* ignore */ }
        return result;
    }

    private async Task GenerateAndSetConductSuggestionAsync(Guid requestId, CancellationToken cancellationToken)
    {
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null) return;

        var patientUser = await userRepository.GetByIdAsync(request.PatientId, cancellationToken);

        var input = new AiConductSuggestionInput(
            RequestType: request.RequestType.ToString(),
            PrescriptionType: request.PrescriptionType?.ToString(),
            ExamType: request.ExamType,
            PatientName: request.PatientName,
            PatientBirthDate: patientUser?.BirthDate,
            PatientGender: patientUser?.Gender,
            Symptoms: request.Symptoms,
            Medications: request.Medications?.Count > 0 ? request.Medications : null,
            Exams: request.Exams?.Count > 0 ? request.Exams : null,
            AiSummaryForDoctor: request.AiSummaryForDoctor,
            AiExtractedJson: request.AiExtractedJson,
            DoctorNotes: request.Notes);

        var result = await aiConductSuggestionService.GenerateAsync(input, cancellationToken);
        if (result == null) return;

        var examsJson = result.SuggestedExams?.Count > 0
            ? JsonSerializer.Serialize(result.SuggestedExams)
            : null;

        request.SetAiConductSuggestion(result.ConductSuggestion, examsJson);
        await requestRepository.UpdateAsync(request, cancellationToken);

        logger.LogInformation("AI conduct suggestion generated for request {RequestId}", requestId);
    }

    public async Task<RequestResponseDto> UpdateConductAsync(
        Guid requestId,
        UpdateConductDto dto,
        Guid doctorId,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken)
            ?? throw new InvalidOperationException($"Request {requestId} not found.");

        if (request.DoctorId.HasValue && request.DoctorId.Value != doctorId)
            throw new UnauthorizedAccessException("Somente o médico responsável pode atualizar a conduta.");

        var oldValues = new Dictionary<string, object?>
        {
            ["doctor_conduct_notes"] = request.DoctorConductNotes,
            ["include_conduct_in_pdf"] = request.IncludeConductInPdf,
            ["auto_observation"] = request.AutoObservation,
            ["conduct_updated_at"] = request.ConductUpdatedAt,
            ["conduct_updated_by"] = request.ConductUpdatedBy
        };

        request.UpdateConduct(dto.ConductNotes, dto.IncludeConductInPdf, doctorId);

        if (dto.ApplyObservationOverride)
            request.OverrideAutoObservation(dto.AutoObservationOverride, doctorId);

        await requestRepository.UpdateAsync(request, cancellationToken);

        var newValues = new Dictionary<string, object?>
        {
            ["doctor_conduct_notes"] = request.DoctorConductNotes,
            ["include_conduct_in_pdf"] = request.IncludeConductInPdf,
            ["auto_observation"] = request.AutoObservation,
            ["conduct_updated_at"] = request.ConductUpdatedAt,
            ["conduct_updated_by"] = request.ConductUpdatedBy
        };

        await auditService.LogModificationAsync(
            doctorId,
            action: "Update",
            entityType: "Request",
            entityId: requestId,
            oldValues: oldValues,
            newValues: newValues,
            cancellationToken: cancellationToken);

        return MapRequestToDto(request);
    }

    private RequestResponseDto MapRequestToDto(
        MedicalRequest request,
        string? consultationTranscript = null,
        string? consultationAnamnesis = null,
        string? consultationAiSuggestions = null,
        string? consultationEvidence = null)
    {
        var signedUrl = request.SignedDocumentUrl;
        if (!string.IsNullOrWhiteSpace(_apiBaseUrl) && !string.IsNullOrWhiteSpace(signedUrl))
        {
            var baseUrl = $"{_apiBaseUrl.TrimEnd('/')}/api/requests/{request.Id}/document";
            var docToken = documentTokenService.GenerateDocumentToken(request.Id, 15);
            if (!string.IsNullOrEmpty(docToken))
                signedUrl = $"{baseUrl}?token={Uri.EscapeDataString(docToken)}";
            // Se Api__DocumentTokenSecret não estiver configurado, docToken é null e mantemos a URL original (ex.: Supabase signed URL) para o link abrir no navegador.
        }

        var prescriptionImages = ToProxyImageUrls(request.Id, request.PrescriptionImages, "prescription");
        var examImages = ToProxyImageUrls(request.Id, request.ExamImages, "exam");

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
            request.Price?.Amount,
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
            request.ConsultationType,
            request.ContractedMinutes,
            request.PricePerMinute,
            request.ConsultationStartedAt,
            request.AutoObservation,
            request.DoctorConductNotes,
            request.IncludeConductInPdf,
            request.AiConductSuggestion,
            request.AiSuggestedExams,
            request.ConductUpdatedAt,
            request.ConductUpdatedBy);
    }

    private List<string> ToProxyImageUrls(Guid requestId, List<string> urls, string imageType)
    {
        if (urls == null || urls.Count == 0)
            return new List<string>();
        if (string.IsNullOrWhiteSpace(_apiBaseUrl))
            return urls;
        var docToken = documentTokenService.GenerateDocumentToken(requestId, 60);
        if (string.IsNullOrEmpty(docToken))
            return urls;
        var baseUrl = $"{_apiBaseUrl.TrimEnd('/')}/api/requests/{requestId}/{imageType}-image";
        var result = new List<string>(urls.Count);
        for (var i = 0; i < urls.Count; i++)
            result.Add($"{baseUrl}/{i}?token={Uri.EscapeDataString(docToken)}");
        return result;
    }

    private async Task<string?> BuildControlledDuplicateWarningAsync(
        Guid patientUserId,
        PrescriptionKind? kind,
        IReadOnlyList<string> medications,
        CancellationToken cancellationToken)
    {
        if (kind != PrescriptionKind.ControlledSpecial || medications == null || medications.Count == 0)
            return null;

        var all = await requestRepository.GetByPatientIdAsync(patientUserId, cancellationToken);
        var fromDate = DateTime.UtcNow.AddDays(-30);
        var medsNormalized = medications
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Select(m => m.Trim().ToLowerInvariant())
            .ToList();

        var hasPotentialDuplicate = all.Any(r =>
            r.RequestType == RequestType.Prescription &&
            r.PrescriptionKind == PrescriptionKind.ControlledSpecial &&
            r.CreatedAt >= fromDate &&
            r.Status != RequestStatus.Rejected &&
            r.Status != RequestStatus.Cancelled &&
            (r.Medications?.Any(m => medsNormalized.Any(n => m != null && m.ToLowerInvariant().Contains(n))) ?? false));

        if (!hasPotentialDuplicate)
            return null;

        return "⚠️ Atenção: paciente com potencial prescrição controlada similar nos últimos 30 dias. Revisar histórico antes de assinar.";
    }

    private static VideoRoomResponseDto MapVideoRoomToDto(VideoRoom room)
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

    public async Task<RequestResponseDto> AutoFinishConsultationAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        if (request.RequestType != RequestType.Consultation)
            throw new InvalidOperationException("Only consultation requests can be auto-finished");

        if (request.PatientId != userId && request.DoctorId != userId)
            throw new UnauthorizedAccessException("Only the patient or assigned doctor can auto-finish this consultation");

        var canFinish = request.Status == RequestStatus.InConsultation
            || request.Status == RequestStatus.Paid;
        if (!canFinish)
            throw new InvalidOperationException($"Consultation is not in a state that can be finished (current: {request.Status})");

        // Delegar para FinishConsultationAsync usando o doctorId se disponível, ou simular com o userId
        var finisherDoctorId = request.DoctorId ?? userId;
        return await FinishConsultationAsync(id, finisherDoctorId, null, cancellationToken);
    }

    public async Task<(int BalanceSeconds, int BalanceMinutes, string ConsultationType)> GetTimeBankBalanceAsync(
        Guid userId, string consultationType, CancellationToken cancellationToken = default)
    {
        var normalizedType = string.IsNullOrWhiteSpace(consultationType) ? "medico_clinico" : consultationType;
        var balanceSeconds = await consultationTimeBankRepository.GetBalanceSecondsAsync(userId, normalizedType, cancellationToken);
        return (balanceSeconds, balanceSeconds / 60, normalizedType);
    }

    public async Task<(int PendingCount, int InReviewCount, int CompletedCount, decimal TotalEarnings)> GetDoctorStatsAsync(
        Guid doctorId, CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(doctorId, cancellationToken);
        if (user?.Role != UserRole.Doctor)
            throw new UnauthorizedAccessException("Apenas médicos podem acessar as estatísticas.");
        return await requestRepository.GetDoctorStatsAsync(doctorId, cancellationToken);
    }
}
