using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.DTOs.Video;
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
    IPaymentRepository paymentRepository,
    IUserRepository userRepository,
    IDoctorRepository doctorRepository,
    IVideoRoomRepository videoRoomRepository,
    INotificationRepository notificationRepository) : IRequestService
{
    private const decimal PrescriptionPrice = 50.00m;
    private const decimal ExamPrice = 100.00m;
    private const decimal ConsultationPrice = 150.00m;

    /// <summary>
    /// Cria uma solicitação de receita médica e o pagamento associado.
    /// </summary>
    public async Task<(RequestResponseDto Request, PaymentResponseDto Payment)> CreatePrescriptionAsync(
        CreatePrescriptionRequestDto request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        if (user == null)
            throw new InvalidOperationException("User not found");

        var prescriptionType = Enum.Parse<PrescriptionType>(request.PrescriptionType, true);

        var medicalRequest = MedicalRequest.CreatePrescription(
            userId,
            user.Name,
            prescriptionType,
            request.Medications,
            request.PrescriptionImages);

        medicalRequest = await requestRepository.CreateAsync(medicalRequest, cancellationToken);

        var payment = Payment.CreatePixPayment(medicalRequest.Id, userId, PrescriptionPrice);
        payment = await paymentRepository.CreateAsync(payment, cancellationToken);

        // Update request status to pending payment
        medicalRequest.UpdateStatus(RequestStatus.PendingPayment);
        medicalRequest = await requestRepository.UpdateAsync(medicalRequest, cancellationToken);

        // Create notification
        await CreateNotificationAsync(
            userId,
            "Solicitação Criada",
            "Sua solicitação de receita foi criada. Aguardando pagamento.",
            cancellationToken);

        return (MapRequestToDto(medicalRequest), MapPaymentToDto(payment));
    }

    /// <summary>
    /// Cria uma solicitação de exame e o pagamento associado.
    /// </summary>
    public async Task<(RequestResponseDto Request, PaymentResponseDto Payment)> CreateExamAsync(
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
            request.ExamType,
            request.Exams,
            request.Symptoms);

        medicalRequest = await requestRepository.CreateAsync(medicalRequest, cancellationToken);

        var payment = Payment.CreatePixPayment(medicalRequest.Id, userId, ExamPrice);
        payment = await paymentRepository.CreateAsync(payment, cancellationToken);

        medicalRequest.UpdateStatus(RequestStatus.PendingPayment);
        medicalRequest = await requestRepository.UpdateAsync(medicalRequest, cancellationToken);

        await CreateNotificationAsync(
            userId,
            "Solicitação Criada",
            "Sua solicitação de exame foi criada. Aguardando pagamento.",
            cancellationToken);

        return (MapRequestToDto(medicalRequest), MapPaymentToDto(payment));
    }

    /// <summary>
    /// Cria uma solicitação de consulta e o pagamento associado.
    /// </summary>
    public async Task<(RequestResponseDto Request, PaymentResponseDto Payment)> CreateConsultationAsync(
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

        var payment = Payment.CreatePixPayment(medicalRequest.Id, userId, ConsultationPrice);
        payment = await paymentRepository.CreateAsync(payment, cancellationToken);

        medicalRequest.UpdateStatus(RequestStatus.PendingPayment);
        medicalRequest = await requestRepository.UpdateAsync(medicalRequest, cancellationToken);

        await CreateNotificationAsync(
            userId,
            "Solicitação Criada",
            "Sua solicitação de consulta foi criada. Aguardando pagamento.",
            cancellationToken);

        return (MapRequestToDto(medicalRequest), MapPaymentToDto(payment));
    }

    /// <summary>
    /// Lista solicitações do paciente com filtros opcionais por status e tipo.
    /// </summary>
    public async Task<List<RequestResponseDto>> GetUserRequestsAsync(
        Guid userId,
        string? status = null,
        string? type = null,
        CancellationToken cancellationToken = default)
    {
        var requests = await requestRepository.GetByPatientIdAsync(userId, cancellationToken);

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusEnum = Enum.Parse<RequestStatus>(status, true);
            requests = requests.Where(r => r.Status == statusEnum).ToList();
        }

        if (!string.IsNullOrWhiteSpace(type))
        {
            var typeEnum = Enum.Parse<RequestType>(type, true);
            requests = requests.Where(r => r.RequestType == typeEnum).ToList();
        }

        return requests.Select(MapRequestToDto).ToList();
    }

    /// <summary>
    /// Obtém uma solicitação pelo ID.
    /// </summary>
    public async Task<RequestResponseDto> GetRequestByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
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

        var newStatus = Enum.Parse<RequestStatus>(dto.Status, true);
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
    /// Aprova uma solicitação e define o valor (médico).
    /// </summary>
    public async Task<RequestResponseDto> ApproveAsync(
        Guid id,
        ApproveRequestDto dto,
        Guid doctorId,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        var doctor = await userRepository.GetByIdAsync(doctorId, cancellationToken);
        if (doctor == null || !doctor.IsDoctor())
            throw new InvalidOperationException("Doctor not found");

        if (request.DoctorId == null)
        {
            request.AssignDoctor(doctorId, doctor.Name);
        }

        request.Approve(dto.Price, dto.Notes);
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        await CreateNotificationAsync(
            request.PatientId,
            "Solicitação Aprovada",
            $"Sua solicitação foi aprovada. Valor: R$ {dto.Price:F2}",
            cancellationToken);

        return MapRequestToDto(request);
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
        var videoRoom = VideoRoom.Create(request.Id, roomName);
        videoRoom.SetRoomUrl($"https://meet.renoveja.com/{roomName}");
        videoRoom = await videoRoomRepository.CreateAsync(videoRoom, cancellationToken);

        await CreateNotificationAsync(
            request.PatientId,
            "Consulta Pronta",
            "Sua consulta está pronta. Entre na sala de vídeo.",
            cancellationToken);

        return (MapRequestToDto(request), MapVideoRoomToDto(videoRoom));
    }

    /// <summary>
    /// Assina digitalmente a solicitação e gera o documento.
    /// </summary>
    public async Task<RequestResponseDto> SignAsync(
        Guid id,
        SignRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        // In a real implementation, this would call PdfGeneratorService
        var signedDocumentUrl = $"https://storage.renoveja.com/signed/{id}.pdf";
        var signatureId = Guid.NewGuid().ToString();

        request.Sign(signedDocumentUrl, signatureId);
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        await CreateNotificationAsync(
            request.PatientId,
            "Documento Assinado",
            "Sua solicitação foi assinada digitalmente e está disponível para download.",
            cancellationToken);

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
    }

    private static RequestResponseDto MapRequestToDto(MedicalRequest request)
    {
        return new RequestResponseDto(
            request.Id,
            request.PatientId,
            request.PatientName,
            request.DoctorId,
            request.DoctorName,
            request.RequestType.ToString().ToLowerInvariant(),
            request.Status.ToString().ToLowerInvariant(),
            request.PrescriptionType?.ToString().ToLowerInvariant(),
            request.Medications.Count > 0 ? request.Medications : null,
            request.PrescriptionImages.Count > 0 ? request.PrescriptionImages : null,
            request.ExamType,
            request.Exams.Count > 0 ? request.Exams : null,
            request.Symptoms,
            request.Price?.Amount,
            request.Notes,
            request.RejectionReason,
            request.SignedAt,
            request.SignedDocumentUrl,
            request.SignatureId,
            request.CreatedAt,
            request.UpdatedAt);
    }

    private static PaymentResponseDto MapPaymentToDto(Payment payment)
    {
        return new PaymentResponseDto(
            payment.Id,
            payment.RequestId,
            payment.UserId,
            payment.Amount.Amount,
            payment.Status.ToString().ToLowerInvariant(),
            payment.PaymentMethod,
            payment.ExternalId,
            payment.PixQrCode,
            payment.PixQrCodeBase64,
            payment.PixCopyPaste,
            payment.PaidAt,
            payment.CreatedAt,
            payment.UpdatedAt);
    }

    private static VideoRoomResponseDto MapVideoRoomToDto(VideoRoom room)
    {
        return new VideoRoomResponseDto(
            room.Id,
            room.RequestId,
            room.RoomName,
            room.RoomUrl,
            room.Status.ToString().ToLowerInvariant(),
            room.StartedAt,
            room.EndedAt,
            room.DurationSeconds,
            room.CreatedAt);
    }
}
