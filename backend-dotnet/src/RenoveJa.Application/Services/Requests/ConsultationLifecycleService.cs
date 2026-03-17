using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.DTOs.Video;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Requests;

/// <summary>
/// Ciclo de vida de consultas: aceitar, iniciar, reportar chamada conectada, finalizar e transcrição.
/// </summary>
public class ConsultationLifecycleService(
    IRequestRepository requestRepository,
    IUserRepository userRepository,
    IVideoRoomRepository videoRoomRepository,
    IConsultationAnamnesisRepository consultationAnamnesisRepository,
    IConsultationSessionStore consultationSessionStore,
    IConsultationTimeBankRepository consultationTimeBankRepository,
    IConsultationEncounterService consultationEncounterService,
    IStorageService storageService,
    IAuditService auditService,
    IRequestEventsPublisher requestEventsPublisher,
    IPushNotificationDispatcher pushDispatcher,
    IDocumentTokenService documentTokenService,
    IOptions<ApiConfig> apiConfig,
    ISoapNotesService soapNotesService,
    IStartConsultationRecording startConsultationRecording,
    ILogger<ConsultationLifecycleService> logger) : IConsultationLifecycleService
{
    private readonly string _apiBaseUrl = (apiConfig?.Value?.BaseUrl ?? "").Trim();

    private Task PublishRequestUpdatedAsync(MedicalRequest request, string? message = null, CancellationToken cancellationToken = default)
        => requestEventsPublisher.NotifyRequestUpdatedAsync(
            request.Id, request.PatientId, request.DoctorId,
            Helpers.EnumHelper.ToSnakeCase(request.Status), message, cancellationToken);

    public async Task<(RequestResponseDto Request, VideoRoomResponseDto VideoRoom)> AcceptConsultationAsync(
        Guid id, Guid doctorId, CancellationToken cancellationToken = default)
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

        request.AssignDoctor(doctorId, doctor.Name);
        request.Approve(0);
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        var roomName = $"consultation-{request.Id}";
        var videoRoom = VideoRoom.Create(request.Id, roomName);
        videoRoom = await videoRoomRepository.CreateAsync(videoRoom, cancellationToken);

        await PublishRequestUpdatedAsync(request, "Médico aceitou — consulta confirmada", cancellationToken);
        await pushDispatcher.SendAsync(PushNotificationRules.ConsultationScheduled(request.PatientId, request.Id, isDoctor: false), cancellationToken);
        return (RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService), RequestHelpers.MapVideoRoomToDto(videoRoom));
    }

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
            throw new InvalidOperationException($"Consultation can only be started when status is Paid. Current status: {request.Status}.");

        request.StartConsultation();
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        var videoRoom = await videoRoomRepository.GetByRequestIdAsync(id, cancellationToken);
        if (videoRoom != null && videoRoom.Status == VideoRoomStatus.Waiting)
        {
            videoRoom.Start();
            await videoRoomRepository.UpdateAsync(videoRoom, cancellationToken);
        }

        // Garantir gravação de vídeo: iniciar via API Daily (independente do token)
        try
        {
            await startConsultationRecording.StartRecordingAsync(id, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[StartConsultation] Falha ao iniciar gravação Daily para request {RequestId}", id);
        }

        await PublishRequestUpdatedAsync(request, "Médico na sala", cancellationToken);
        await pushDispatcher.SendAsync(PushNotificationRules.DoctorReady(request.PatientId, request.Id), cancellationToken);

        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }

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
            return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);

        request = await requestRepository.UpdateAsync(request, cancellationToken);

        if (!hadStarted && request.ConsultationStartedAt.HasValue)
        {
            if (request.DoctorId.HasValue)
            {
                try
                {
                    await consultationEncounterService.StartEncounterForConsultationAsync(
                        request.Id, request.PatientId, request.DoctorId.Value, request.Symptoms, cancellationToken);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "[ReportCallConnected] Falha ao criar Encounter para request {RequestId}", request.Id);
                }
            }

            await PublishRequestUpdatedAsync(request, "Chamada conectada", cancellationToken);
        }

        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }

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

        // Debitar do banco de horas apenas os minutos efetivamente utilizados
        if (request.ContractedMinutes.HasValue && !string.IsNullOrWhiteSpace(request.ConsultationType))
        {
            try
            {
                var usedSeconds = videoRoom?.DurationSeconds ?? 0;
                if (usedSeconds > 0)
                {
                    var contractedSeconds = request.ContractedMinutes.Value * 60;
                    var pricePerMinute = request.PricePerMinute ?? 6.99m;
                    var amount = request.Price?.Amount ?? 0;

                    var freeSeconds = amount <= 0
                        ? contractedSeconds
                        : (int)Math.Max(0, contractedSeconds - (int)Math.Ceiling((double)(amount / pricePerMinute)) * 60);

                    var toDebit = Math.Min(usedSeconds, freeSeconds);
                    if (toDebit > 0)
                    {
                        await consultationTimeBankRepository.DebitAsync(
                            request.PatientId, request.ConsultationType, toDebit, request.Id, cancellationToken);

                        logger.LogInformation(
                            "[FinishConsultation] Debitado {Seconds}s do banco de horas de {PatientId} ({Type}) — usado na consulta",
                            toDebit, request.PatientId, request.ConsultationType);
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Falha ao debitar banco de horas para request {RequestId}", id);
            }
        }

        // Persistir transcrição e anamnese da consulta no prontuário
        var sessionData = consultationSessionStore.GetAndRemove(id);
        if (sessionData != null)
        {
            string? transcriptFileUrl = null;
            var contentToSave = RequestHelpers.BuildTranscriptTxtContent(sessionData, request.ConsultationStartedAt);
            if (!string.IsNullOrWhiteSpace(contentToSave))
            {
                try
                {
                    var path = $"consultas/{id:N}/transcricao/transcricao-{id:N}.txt";
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
                    existing.Update(sessionData.TranscriptText, transcriptFileUrl, null, sessionData.AnamnesisJson, sessionData.AiSuggestionsJson, sessionData.EvidenceJson);
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
                    var entity = ConsultationAnamnesis.Create(
                        id, sessionData.PatientId, sessionData.TranscriptText, transcriptFileUrl, null,
                        sessionData.AnamnesisJson, sessionData.AiSuggestionsJson, sessionData.EvidenceJson);
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
            var icd10 = RequestHelpers.ExtractIcd10FromAnamnesis(anamnesisJson, logger);
            await consultationEncounterService.FinalizeEncounterForConsultationAsync(
                id, anamnesisJson, plan, icd10, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[FinishConsultation] Falha ao finalizar Encounter para request {RequestId}", id);
        }

        await PublishRequestUpdatedAsync(request, "Consulta finalizada", cancellationToken);
        await pushDispatcher.SendAsync(PushNotificationRules.ConsultationFinished(request.PatientId, request.Id), cancellationToken);

        // Gera notas SOAP em background — não bloqueia o retorno para o médico
        var transcriptForSoap = sessionData?.TranscriptText ?? string.Empty;
        var anamnesisForSoap  = sessionData?.AnamnesisJson;
        _ = Task.Run(async () =>
        {
            try
            {
                string? soapJson = null;
                ConsultationAnamnesis? anamnesisEntity = null;

                if (string.IsNullOrWhiteSpace(transcriptForSoap))
                {
                    anamnesisEntity = await consultationAnamnesisRepository.GetByRequestIdAsync(id, CancellationToken.None);
                    if (anamnesisEntity != null)
                    {
                        var soap = await soapNotesService.GenerateAsync(
                            anamnesisEntity.TranscriptText ?? "", anamnesisEntity.AnamnesisJson, CancellationToken.None);
                        if (soap != null) soapJson = soap.RawJson;
                    }
                }
                else
                {
                    var soap = await soapNotesService.GenerateAsync(
                        transcriptForSoap, anamnesisForSoap, CancellationToken.None);
                    if (soap != null) soapJson = soap.RawJson;
                    anamnesisEntity = await consultationAnamnesisRepository.GetByRequestIdAsync(id, CancellationToken.None);
                }

                if (soapJson == null || anamnesisEntity == null)
                {
                    logger.LogWarning("[SOAP] Notas SOAP não geradas ou entidade não encontrada. RequestId={RequestId}", id);
                    return;
                }

                // 1. Persistir no banco
                anamnesisEntity.SetSoapNotes(soapJson, DateTime.UtcNow);
                await consultationAnamnesisRepository.UpdateAsync(anamnesisEntity, CancellationToken.None);
                logger.LogInformation("[SOAP] Notas SOAP salvas no banco. RequestId={RequestId}", id);

                // 2. Upload pro S3 — path: consultas/{id}/notas-soap/soap-notes-{id}.json
                try
                {
                    var s3Path = $"consultas/{id:N}/notas-soap/soap-notes-{id:N}.json";
                    var bytes  = System.Text.Encoding.UTF8.GetBytes(soapJson);
                    var result = await storageService.UploadAsync(s3Path, bytes, "application/json", CancellationToken.None);
                    if (result.Success)
                        logger.LogInformation("[SOAP] Notas SOAP enviadas ao S3. RequestId={RequestId} Path={Path}", id, s3Path);
                    else
                        logger.LogWarning("[SOAP] Falha no upload S3 das notas SOAP. RequestId={RequestId} Error={Error}", id, result.ErrorMessage);
                }
                catch (Exception exS3)
                {
                    logger.LogWarning(exS3, "[SOAP] Exceção no upload S3 das notas SOAP (dado seguro no banco). RequestId={RequestId}", id);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "[SOAP] Falha ao gerar notas SOAP. RequestId={RequestId}", id);
            }
        }, CancellationToken.None);

        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService);
    }

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
            ?? $"consultas/{id:N}/transcricao/transcricao-{id:N}.txt";
        return await storageService.CreateSignedUrlAsync(path, expiresInSeconds, cancellationToken);
    }

    public async Task<string?> GetRecordingDownloadUrlAsync(Guid id, Guid userId, int expiresInSeconds = 3600, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null) return null;
        if (request.RequestType != RequestType.Consultation) return null;

        var isDoctor = request.DoctorId == userId;
        var isPatient = request.PatientId == userId;
        if (!isDoctor && !isPatient) return null;

        var anamnesis = await consultationAnamnesisRepository.GetByRequestIdAsync(id, cancellationToken);
        if (anamnesis?.RecordingFileUrl == null) return null;

        var path = storageService.ExtractPathFromStorageUrl(anamnesis.RecordingFileUrl);
        if (string.IsNullOrWhiteSpace(path)) return null;
        return await storageService.CreateSignedUrlAsync(path, expiresInSeconds, cancellationToken);
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
}
