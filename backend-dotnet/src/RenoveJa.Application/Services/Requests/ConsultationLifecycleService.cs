using System.Collections.Concurrent;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
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
    IConsultationEncounterService consultationEncounterService,
    IStorageService storageService,
    IAuditService auditService,
    IRequestEventsPublisher requestEventsPublisher,
    IPushNotificationDispatcher pushDispatcher,
    IDocumentTokenService documentTokenService,
    IOptions<ApiConfig> apiConfig,
    ISoapNotesService soapNotesService,
    IStartConsultationRecording startConsultationRecording,
    IRecordingSyncService recordingSyncService,
    IServiceScopeFactory scopeFactory,
    ILogger<ConsultationLifecycleService> logger) : IConsultationLifecycleService
{
    private readonly string _apiBaseUrl = (apiConfig?.Value?.BaseUrl ?? "").Trim();

    // Per-consultation lock to prevent concurrent accept/start race conditions.
    // Uses a static ConcurrentDictionary so the locks survive across scoped service instances.
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> _consultationLocks = new();

    private static SemaphoreSlim GetLockFor(Guid consultationId)
        => _consultationLocks.GetOrAdd(consultationId, _ => new SemaphoreSlim(1, 1));

    private Task PublishRequestUpdatedAsync(MedicalRequest request, string? message = null, CancellationToken cancellationToken = default)
        => requestEventsPublisher.NotifyRequestUpdatedAsync(
            request.Id, request.PatientId, request.DoctorId,
            Helpers.EnumHelper.ToSnakeCase(request.Status), message, cancellationToken);

    public async Task<(RequestResponseDto Request, VideoRoomResponseDto VideoRoom)> AcceptConsultationAsync(
        Guid id, Guid doctorId, CancellationToken cancellationToken = default)
    {
        var semaphore = GetLockFor(id);
        await semaphore.WaitAsync(cancellationToken);
        try
        {
            var request = await requestRepository.GetByIdAsync(id, cancellationToken);
            if (request == null)
                throw new KeyNotFoundException("Request not found");

            if (request.RequestType != RequestType.Consultation)
                throw new InvalidOperationException("Only consultation requests can create video rooms");

            // Re-check status after acquiring lock to prevent two doctors from accepting simultaneously
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
        finally
        {
            semaphore.Release();
        }
    }

    public async Task<RequestResponseDto> StartConsultationAsync(Guid id, Guid doctorId, CancellationToken cancellationToken = default)
    {
        var semaphore = GetLockFor(id);
        await semaphore.WaitAsync(cancellationToken);
        try
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

            // Re-check status after acquiring lock to prevent concurrent start race conditions
            if (request.Status != RequestStatus.Paid && request.Status != RequestStatus.ConsultationReady)
                throw new InvalidOperationException($"Consultation can only be started when status is Paid or ConsultationReady. Current status: {request.Status}.");

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
        finally
        {
            semaphore.Release();
        }
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

        request.EndConsultationCall(dto?.ClinicalNotes);
        request = await requestRepository.UpdateAsync(request, cancellationToken);

        var videoRoom = await videoRoomRepository.GetByRequestIdAsync(id, cancellationToken);
        if (videoRoom != null && videoRoom.Status == VideoRoomStatus.Active)
        {
            videoRoom.End();
            await videoRoomRepository.UpdateAsync(videoRoom, cancellationToken);
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
                    var path = Helpers.StoragePaths.Transcricao(request.PatientId, id);
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

        await PublishRequestUpdatedAsync(request, "Chamada encerrada — emita os documentos na pós-consulta para finalizar", cancellationToken);
        await pushDispatcher.SendAsync(PushNotificationRules.ConsultationEndedPendingDocuments(request.PatientId, request.Id), cancellationToken);

        // Gravação: disparar sync em background (Daily pode levar 2-5 min para processar).
        // Usa scope próprio para evitar disposed scoped services.
        _ = SyncRecordingsAsync(id);

        // FIX B30: Execute SOAP notes generation inline (awaited) instead of Task.Run with scoped services.
        // Task.Run captures scoped services (consultationAnamnesisRepository, soapNotesService, storageService)
        // which may be disposed before the background task completes.
        var transcriptForSoap = sessionData?.TranscriptText ?? string.Empty;
        var anamnesisForSoap  = sessionData?.AnamnesisJson;
        try
        {
            string? soapJson = null;
            ConsultationAnamnesis? anamnesisEntity = null;

            if (string.IsNullOrWhiteSpace(transcriptForSoap))
            {
                anamnesisEntity = await consultationAnamnesisRepository.GetByRequestIdAsync(id, cancellationToken);
                if (anamnesisEntity != null)
                {
                    var soap = await soapNotesService.GenerateAsync(
                        anamnesisEntity.TranscriptText ?? "", anamnesisEntity.AnamnesisJson, cancellationToken);
                    if (soap != null) soapJson = soap.RawJson;
                }
            }
            else
            {
                var soap = await soapNotesService.GenerateAsync(
                    transcriptForSoap, anamnesisForSoap, cancellationToken);
                if (soap != null) soapJson = soap.RawJson;
                anamnesisEntity = await consultationAnamnesisRepository.GetByRequestIdAsync(id, cancellationToken);
            }

            if (soapJson == null || anamnesisEntity == null)
            {
                logger.LogWarning("[SOAP] Notas SOAP não geradas ou entidade não encontrada. RequestId={RequestId}", id);
            }
            else
            {
                // 1. Persistir no banco
                anamnesisEntity.SetSoapNotes(soapJson, DateTime.UtcNow);
                await consultationAnamnesisRepository.UpdateAsync(anamnesisEntity, cancellationToken);
                logger.LogInformation("[SOAP] Notas SOAP salvas no banco. RequestId={RequestId}", id);

                // 2. Upload pro S3 — path: consultas/{id}/notas-soap/soap-notes-{id}.json
                try
                {
                    var s3Path = Helpers.StoragePaths.SoapNotes(request.PatientId, id);
                    var bytes  = System.Text.Encoding.UTF8.GetBytes(soapJson);
                    var soapResult = await storageService.UploadAsync(s3Path, bytes, "application/json", cancellationToken);
                    if (soapResult.Success)
                        logger.LogInformation("[SOAP] Notas SOAP enviadas ao S3. RequestId={RequestId} Path={Path}", id, s3Path);
                    else
                        logger.LogWarning("[SOAP] Falha no upload S3 das notas SOAP. RequestId={RequestId} Error={Error}", id, soapResult.ErrorMessage);
                }
                catch (Exception exS3)
                {
                    logger.LogWarning(exS3, "[SOAP] Exceção no upload S3 das notas SOAP (dado seguro no banco). RequestId={RequestId}", id);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[SOAP] Falha ao gerar notas SOAP. RequestId={RequestId}", id);
        }

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
            ?? Helpers.StoragePaths.Transcricao(request.PatientId, id);
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
        if (anamnesis?.RecordingFileUrl == null)
        {
            await recordingSyncService.TrySyncRecordingAsync(id, cancellationToken);
            anamnesis = await consultationAnamnesisRepository.GetByRequestIdAsync(id, cancellationToken);
        }
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

        if (!request.DoctorId.HasValue)
            throw new InvalidOperationException("Cannot auto-finish consultation without an assigned doctor.");

        return await FinishConsultationAsync(id, request.DoctorId.Value, null, cancellationToken);
    }

    private async Task SyncRecordingsAsync(Guid requestId)
    {
        // Daily.co pode levar 2-10 min para processar a gravação.
        // Tentamos múltiplas vezes com backoff para garantir que a gravação seja salva no S3.
        var delays = new[] { 2, 4, 8 }; // minutos
        foreach (var delayMinutes in delays)
        {
            await Task.Delay(TimeSpan.FromMinutes(delayMinutes));
            try
            {
                using var scope = scopeFactory.CreateScope();
                var sync = scope.ServiceProvider.GetRequiredService<IRecordingSyncService>();
                var synced = await sync.TrySyncRecordingAsync(requestId);
                if (synced)
                {
                    logger.LogInformation("[RecordingSync] Gravação sincronizada com sucesso após {Minutes}min para RequestId={RequestId}", delayMinutes, requestId);
                    return;
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "[RecordingSync] Tentativa após {Minutes}min falhou para RequestId={RequestId}", delayMinutes, requestId);
            }
        }
        logger.LogWarning("[RecordingSync] Gravação não encontrada após todas as tentativas para RequestId={RequestId}. Webhook ou acesso manual necessário.", requestId);
    }

}
