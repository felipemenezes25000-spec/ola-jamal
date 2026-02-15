using Microsoft.Extensions.Logging;
using RenoveJa.Application.DTOs;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.DTOs.Video;
using RenoveJa.Application.Helpers;
using RenoveJa.Application.Interfaces;
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
    INotificationRepository notificationRepository,
    IPushNotificationSender pushNotificationSender,
    IAiReadingService aiReadingService,
    IPrescriptionPdfService prescriptionPdfService,
    IDigitalCertificateService digitalCertificateService,
    IDailyVideoService dailyVideoService,
    ILogger<RequestService> logger) : IRequestService
{

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

    private static string? PrescriptionTypeToDisplay(PrescriptionType? type) => type switch
    {
        PrescriptionType.Simple => "simples",
        PrescriptionType.Controlled => "controlado",
        PrescriptionType.Blue => "azul",
        _ => null
    };

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

        var medicalRequest = MedicalRequest.CreatePrescription(
            userId,
            user.Name,
            prescriptionType,
            request.Medications ?? new List<string>(),
            request.PrescriptionImages);

        medicalRequest = await requestRepository.CreateAsync(medicalRequest, cancellationToken);

        await RunPrescriptionAiAndUpdateAsync(medicalRequest, cancellationToken);

        await CreateNotificationAsync(
            userId,
            "Solicitação Criada",
            "Sua solicitação de receita foi enviada. Aguardando análise do médico.",
            cancellationToken);

        return (MapRequestToDto(medicalRequest), null);
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

        medicalRequest = await requestRepository.CreateAsync(medicalRequest, cancellationToken);

        await RunExamAiAndUpdateAsync(medicalRequest, cancellationToken);

        await CreateNotificationAsync(
            userId,
            "Solicitação Criada",
            "Sua solicitação de exame foi enviada. Aguardando análise do médico.",
            cancellationToken);

        return (MapRequestToDto(medicalRequest), null);
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

        var medicalRequest = MedicalRequest.CreateConsultation(
            userId,
            user.Name,
            request.Symptoms);

        medicalRequest = await requestRepository.CreateAsync(medicalRequest, cancellationToken);

        await CreateNotificationAsync(
            userId,
            "Solicitação Criada",
            "Sua solicitação de consulta foi enviada. Aguardando médico.",
            cancellationToken);

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
        // Check if user is a doctor
        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        List<MedicalRequest> requests;

        if (user?.Role == UserRole.Doctor)
        {
            // For doctors: get requests assigned to them + available requests (no doctor, paid/submitted)
            var doctorRequests = await requestRepository.GetByDoctorIdAsync(userId, cancellationToken);
            var availableRequests = await requestRepository.GetByStatusAsync(RequestStatus.Paid, cancellationToken);
            var submittedRequests = await requestRepository.GetByStatusAsync(RequestStatus.Submitted, cancellationToken);

            var available = availableRequests.Concat(submittedRequests)
                .Where(r => r.DoctorId == null || r.DoctorId == Guid.Empty)
                .ToList();

            requests = doctorRequests.Concat(available)
                .DistinctBy(r => r.Id)
                .OrderByDescending(r => r.CreatedAt)
                .ToList();
        }
        else
        {
            requests = await requestRepository.GetByPatientIdAsync(userId, cancellationToken);
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

        return requests.Select(MapRequestToDto).ToList();
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
    /// Obtém uma solicitação pelo ID. Valida que o usuário é o paciente ou o médico da solicitação.
    /// </summary>
    public async Task<RequestResponseDto> GetRequestByIdAsync(
        Guid id,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        var isOwner = request.PatientId == userId || request.DoctorId == userId;
        if (!isOwner)
            throw new KeyNotFoundException("Request not found");

        return MapRequestToDto(request);
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
            cancellationToken);

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
            request.Approve(price, notes: null);
            request = await requestRepository.UpdateAsync(request, cancellationToken);

            await CreateNotificationAsync(
                request.PatientId,
                "Solicitação Aprovada",
                $"Sua solicitação foi aprovada. Valor: R$ {price:F2}. Acesse o app para realizar o pagamento.",
                cancellationToken);

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

        await CreateNotificationAsync(
            request.PatientId,
            "Solicitação Rejeitada",
            $"Sua solicitação foi rejeitada. Motivo: {dto.RejectionReason}",
            cancellationToken);

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

            await CreateNotificationAsync(
                request.PatientId,
                "Médico Atribuído",
                $"Sua solicitação foi atribuída ao Dr(a). {doctorUser.Name}",
                cancellationToken);

            await CreateNotificationAsync(
                doctorUser.Id,
                "Nova Solicitação",
                $"Você recebeu uma nova solicitação de {request.PatientName}",
                cancellationToken);
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

        var doctor = await userRepository.GetByIdAsync(doctorId, cancellationToken);
        if (doctor == null || !doctor.IsDoctor())
            throw new InvalidOperationException("Doctor not found");

        request.AssignDoctor(doctorId, doctor.Name);
        request.MarkConsultationReady();
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        var roomName = $"consultation-{request.Id}";

        // Criar sala real via Daily.co API
        var dailyResult = await dailyVideoService.CreateRoomAsync(roomName, expirationMinutes: 60, cancellationToken);
        var roomUrl = dailyResult.Success && !string.IsNullOrWhiteSpace(dailyResult.RoomUrl)
            ? dailyResult.RoomUrl
            : $"https://meet.renoveja.com/{roomName}";

        var videoRoom = VideoRoom.Create(request.Id, roomName);
        videoRoom.SetRoomUrl(roomUrl);
        videoRoom = await videoRoomRepository.CreateAsync(videoRoom, cancellationToken);

        await CreateNotificationAsync(
            request.PatientId,
            "Consulta Pronta",
            "Sua consulta está pronta. Entre na sala de vídeo.",
            cancellationToken);

        return (MapRequestToDto(request), MapVideoRoomToDto(videoRoom));
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

        // Se o médico está atribuído, tentar fluxo completo de geração + assinatura
        if (request.DoctorId.HasValue)
        {
            var doctorProfile = await doctorRepository.GetByUserIdAsync(request.DoctorId.Value, cancellationToken);

            if (doctorProfile != null)
            {
                // 1. Verificar se médico tem certificado válido
                var hasCertificate = await digitalCertificateService.HasValidCertificateAsync(doctorProfile.Id, cancellationToken);

                if (hasCertificate && request.RequestType == Domain.Enums.RequestType.Prescription)
                {
                    var doctorUser = await userRepository.GetByIdAsync(request.DoctorId.Value, cancellationToken);
                    var patientUser = await userRepository.GetByIdAsync(request.PatientId, cancellationToken);

                    // 2. Gerar PDF da receita
                    var pdfData = new PrescriptionPdfData(
                        RequestId: request.Id,
                        PatientName: request.PatientName ?? "Paciente",
                        PatientCpf: patientUser?.Cpf,
                        DoctorName: doctorUser?.Name ?? request.DoctorName ?? "Médico",
                        DoctorCrm: doctorProfile.Crm,
                        DoctorCrmState: doctorProfile.CrmState,
                        DoctorSpecialty: doctorProfile.Specialty,
                        Medications: request.Medications,
                        PrescriptionType: PrescriptionTypeToDisplay(request.PrescriptionType) ?? "simples",
                        EmissionDate: DateTime.UtcNow,
                        AccessCode: request.AccessCode);

                    var pdfResult = await prescriptionPdfService.GenerateAsync(pdfData, cancellationToken);

                    if (pdfResult.Success && pdfResult.PdfBytes != null)
                    {
                        // 3. Assinar PDF com certificado do médico
                        var certInfo = await digitalCertificateService.GetActiveCertificateAsync(doctorProfile.Id, cancellationToken);
                        if (certInfo != null)
                        {
                            var signResult = await digitalCertificateService.SignPdfAsync(
                                certInfo.Id,
                                pdfResult.PdfBytes,
                                $"receita-assinada-{request.Id}.pdf",
                                cancellationToken);

                            if (signResult.Success)
                            {
                                // 4 & 5. PDF assinado foi uploaded pelo SignPdfAsync; atualizar request
                                request.Sign(signResult.SignedDocumentUrl!, signResult.SignatureId!);
                                request = await requestRepository.UpdateAsync(request, cancellationToken);

                                await CreateNotificationAsync(
                                    request.PatientId,
                                    "Documento Assinado",
                                    "Sua receita foi assinada digitalmente e está disponível para download.",
                                    cancellationToken);

                                return MapRequestToDto(request);
                            }

                            logger.LogWarning("Falha ao assinar PDF para request {RequestId}: {Error}", id, signResult.ErrorMessage);
                        }
                    }
                    else
                    {
                        logger.LogWarning("Falha ao gerar PDF para request {RequestId}: {Error}", id, pdfResult.ErrorMessage);
                    }
                }
            }
        }

        // Fallback: aceitar URL externa (comportamento anterior)
        var signedDocumentUrl = !string.IsNullOrWhiteSpace(dto.SignedDocumentUrl)
            ? dto.SignedDocumentUrl.Trim()
            : $"https://storage.renoveja.com/signed/{id}.pdf";
        var signatureId = !string.IsNullOrWhiteSpace(dto.SignatureData) ? dto.SignatureData : Guid.NewGuid().ToString();

        request.Sign(signedDocumentUrl, signatureId);
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        await CreateNotificationAsync(
            request.PatientId,
            "Documento Assinado",
            "Sua solicitação foi assinada digitalmente e está disponível para download.",
            cancellationToken);

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
            request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, result.ReadabilityOk, result.MessageToUser);
            request = await requestRepository.UpdateAsync(request, cancellationToken);
            logger.LogInformation("IA reanálise receita: sucesso para request {RequestId}", id);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "IA reanálise receita (paciente): falhou para request {RequestId}. {Message}", id, ex.Message);
            request.SetAiAnalysis("[Reanálise por IA indisponível.]", null, null, null, null, null);
            request = await requestRepository.UpdateAsync(request, cancellationToken);
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
                request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, result.ReadabilityOk, result.MessageToUser);
                logger.LogInformation("IA reanálise receita (médico): sucesso para request {RequestId}", id);
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
                request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, result.ReadabilityOk, result.MessageToUser);
                logger.LogInformation("IA reanálise exame (médico): sucesso para request {RequestId}", id);
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
            request.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, result.ReadabilityOk, result.MessageToUser);
            request = await requestRepository.UpdateAsync(request, cancellationToken);
            logger.LogInformation("IA reanálise exame (paciente): sucesso para request {RequestId}", id);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "IA reanálise exame (paciente): falhou para request {RequestId}. {Message}", id, ex.Message);
            request.SetAiAnalysis("[Reanálise por IA indisponível.]", null, null, null, null, null);
            request = await requestRepository.UpdateAsync(request, cancellationToken);
        }
        return MapRequestToDto(request);
    }

    private async Task CreateNotificationAsync(
        Guid userId,
        string title,
        string message,
        CancellationToken cancellationToken)
    {
        var notification = Notification.Create(userId, title, message, NotificationType.Info);
        await notificationRepository.CreateAsync(notification, cancellationToken);
        await pushNotificationSender.SendAsync(userId, title, message, ct: cancellationToken);
    }

    private async Task RunPrescriptionAiAndUpdateAsync(MedicalRequest medicalRequest, CancellationToken cancellationToken)
    {
        if (medicalRequest.PrescriptionImages.Count == 0)
        {
            logger.LogInformation("IA receita: request {RequestId} sem imagens, pulando análise", medicalRequest.Id);
            return;
        }
        logger.LogInformation("IA receita: iniciando análise para request {RequestId} com {ImageCount} imagem(ns). URLs: {Urls}",
            medicalRequest.Id, medicalRequest.PrescriptionImages.Count, string.Join("; ", medicalRequest.PrescriptionImages.Take(3)));
        try
        {
            var result = await aiReadingService.AnalyzePrescriptionAsync(medicalRequest.PrescriptionImages, cancellationToken);
            medicalRequest.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, result.RiskLevel, null, result.ReadabilityOk, result.MessageToUser);
            await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
            logger.LogInformation("IA receita: análise concluída para request {RequestId}. ReadabilityOk={ReadabilityOk}, SummaryLength={Len}",
                medicalRequest.Id, result.ReadabilityOk, result.SummaryForDoctor?.Length ?? 0);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "IA receita: análise falhou para request {RequestId}. Mensagem: {Message}. Inner: {Inner}",
                medicalRequest.Id, ex.Message, ex.InnerException?.Message ?? "-");
            medicalRequest.SetAiAnalysis("[Análise por IA indisponível no momento.]", null, null, null, null, null);
            await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
        }
    }

    private async Task RunExamAiAndUpdateAsync(MedicalRequest medicalRequest, CancellationToken cancellationToken)
    {
        var parts = new List<string>();
        if (!string.IsNullOrEmpty(medicalRequest.ExamType)) parts.Add($"Tipo: {medicalRequest.ExamType}");
        if (medicalRequest.Exams.Count > 0) parts.Add("Exames: " + string.Join(", ", medicalRequest.Exams));
        if (!string.IsNullOrEmpty(medicalRequest.Symptoms)) parts.Add(medicalRequest.Symptoms);
        var textDescription = parts.Count > 0 ? string.Join("\n", parts) : null;
        var imageUrls = medicalRequest.ExamImages.Count > 0 ? medicalRequest.ExamImages : null;
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
            medicalRequest.SetAiAnalysis(result.SummaryForDoctor, result.ExtractedJson, null, result.Urgency, result.ReadabilityOk, result.MessageToUser);
            await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
            logger.LogInformation("IA exame: análise concluída para request {RequestId}. ReadabilityOk={ReadabilityOk}, SummaryLength={Len}",
                medicalRequest.Id, result.ReadabilityOk, result.SummaryForDoctor?.Length ?? 0);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "IA exame: análise falhou para request {RequestId}. Mensagem: {Message}. Inner: {Inner}",
                medicalRequest.Id, ex.Message, ex.InnerException?.Message ?? "-");
            medicalRequest.SetAiAnalysis("[Análise por IA indisponível no momento.]", null, null, null, null, null);
            await requestRepository.UpdateAsync(medicalRequest, cancellationToken);
        }
    }

    private static RequestResponseDto MapRequestToDto(MedicalRequest request)
    {
        return new RequestResponseDto(
            request.Id,
            request.PatientId,
            request.PatientName,
            request.DoctorId,
            request.DoctorName,
            EnumHelper.ToSnakeCase(request.RequestType),
            EnumHelper.ToSnakeCase(request.Status),
            PrescriptionTypeToDisplay(request.PrescriptionType),
            request.Medications.Count > 0 ? request.Medications : null,
            request.PrescriptionImages.Count > 0 ? request.PrescriptionImages : null,
            request.ExamType,
            request.Exams.Count > 0 ? request.Exams : null,
            request.ExamImages.Count > 0 ? request.ExamImages : null,
            request.Symptoms,
            request.Price?.Amount,
            request.Notes,
            request.RejectionReason,
            request.AccessCode,
            request.SignedAt,
            request.SignedDocumentUrl,
            request.SignatureId,
            request.CreatedAt,
            request.UpdatedAt,
            request.AiSummaryForDoctor,
            request.AiExtractedJson,
            request.AiRiskLevel,
            request.AiUrgency,
            request.AiReadabilityOk,
            request.AiMessageToUser);
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
}
