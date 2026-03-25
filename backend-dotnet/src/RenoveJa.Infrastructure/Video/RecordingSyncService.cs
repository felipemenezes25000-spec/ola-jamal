using System.Net.Http.Headers;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Infrastructure.Video;

/// <summary>
/// Fallback para salvar gravação no S3 quando o webhook Daily não funcionar.
/// Lista gravações da sala, baixa a primeira com status "finished", sobe para S3.
/// </summary>
public class RecordingSyncService(
    IDailyVideoService dailyVideoService,
    IStorageService storageService,
    IConsultationAnamnesisRepository consultationAnamnesisRepository,
    IRequestRepository requestRepository,
    IHttpClientFactory httpClientFactory,
    IOptions<DailyConfig> dailyConfig,
    ILogger<RecordingSyncService> logger) : IRecordingSyncService
{
    public async Task<bool> TrySyncRecordingAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null || request.RequestType != Domain.Enums.RequestType.Consultation)
            return false;

        var existing = await consultationAnamnesisRepository.GetByRequestIdAsync(requestId, cancellationToken);
        if (existing?.RecordingFileUrl != null)
        {
            logger.LogDebug("[RecordingSync] Gravação já salva para RequestId={RequestId}", requestId);
            return false;
        }

        var roomName = dailyConfig.Value.GetRoomName(requestId);
        var recordings = await dailyVideoService.ListRecordingsByRoomAsync(roomName, cancellationToken);
        var finished = recordings
            .Where(r => "finished".Equals(r.Status, StringComparison.OrdinalIgnoreCase) && (r.DurationSeconds ?? 0) > 0)
            .OrderByDescending(r => r.StartTs ?? 0)
            .FirstOrDefault();

        if (finished == null)
        {
            logger.LogDebug("[RecordingSync] Nenhuma gravação finished para RequestId={RequestId} Room={Room}", requestId, roomName);
            return false;
        }

        var recordingId = finished.Id;
        var path = RenoveJa.Application.Helpers.StoragePaths.Gravacao(request.PatientId, requestId, recordingId);

        var (downloadLink, _) = await dailyVideoService.GetRecordingAccessLinkAsync(recordingId, 3600, cancellationToken);
        if (string.IsNullOrEmpty(downloadLink))
        {
            logger.LogWarning("[RecordingSync] Link de download vazio para RecordingId={RecordingId}", recordingId);
            return false;
        }

        try
        {
            var client = httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromMinutes(10);
            client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("RenoveJaBackend", "1.0"));
            var response = await client.GetAsync(downloadLink, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            response.EnsureSuccessStatusCode();

            await using var videoStream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var uploadResult = await storageService.UploadStreamAsync(path, videoStream, "video/mp4", cancellationToken);

            if (!uploadResult.Success || string.IsNullOrEmpty(uploadResult.Url))
            {
                logger.LogWarning("[RecordingSync] Falha no upload para RequestId={RequestId} Error={Error}", requestId, uploadResult.ErrorMessage);
                return false;
            }

            var savedUrl = uploadResult.Url;
            if (existing != null)
            {
                existing.SetRecordingFileUrl(savedUrl);
                await consultationAnamnesisRepository.UpdateAsync(existing, cancellationToken);
            }
            else
            {
                var entity = RenoveJa.Domain.Entities.ConsultationAnamnesis.Create(
                    requestId, request.PatientId,
                    transcriptText: null, transcriptFileUrl: null, recordingFileUrl: savedUrl,
                    anamnesisJson: null, aiSuggestionsJson: null, evidenceJson: null);
                await consultationAnamnesisRepository.CreateAsync(entity, cancellationToken);
            }

            logger.LogInformation("[RecordingSync] Gravação sincronizada: RequestId={RequestId} Path={Path}", requestId, path);

            // Deletar gravação do Daily.co após upload para S3
            try
            {
                await dailyVideoService.DeleteRecordingAsync(recordingId, cancellationToken);
            }
            catch (Exception delEx)
            {
                logger.LogWarning(delEx, "[RecordingSync] Falha ao deletar gravação do Daily RecordingId={RecordingId} (já salva no S3)", recordingId);
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[RecordingSync] Erro ao sincronizar gravação RequestId={RequestId}", requestId);
            return false;
        }
    }
}
