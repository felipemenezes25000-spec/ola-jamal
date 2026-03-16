using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Video;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Webhook do Daily.co: recebe eventos (ex.: recording.ready-to-download),
/// baixa a gravação e envia para o S3 em estrutura clara (recordings/consultas/{requestId}/).
/// </summary>
[ApiController]
[Route("api/webhooks/daily")]
public class DailyWebhookController(
    IDailyVideoService dailyVideoService,
    IStorageService storageService,
    IConsultationAnamnesisRepository consultationAnamnesisRepository,
    IRequestRepository requestRepository,
    IHttpClientFactory httpClientFactory,
    IOptions<DailyConfig> dailyConfig,
    ILogger<DailyWebhookController> logger) : ControllerBase
{
    /// <summary>
    /// Recebe eventos do Daily (configurar no Dashboard Daily: URL deste endpoint).
    /// Quando type = "recording.ready-to-download": baixa o MP4, sobe para S3 e grava a URL na anamnese da consulta.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Handle([FromBody] DailyWebhookPayload? payload, CancellationToken cancellationToken)
    {
        // Validar HMAC-SHA256 do Daily.co (o Daily assina o body e envia no header x-webhook-signature)
        var configuredSecret = dailyConfig.Value.WebhookSecret;
        if (!string.IsNullOrWhiteSpace(configuredSecret))
        {
            var signature = Request.Headers["x-webhook-signature"].ToString();
            if (string.IsNullOrEmpty(signature))
            {
                logger.LogWarning("[DailyWebhook] Header x-webhook-signature ausente. Rejeitando.");
                return Unauthorized();
            }

            // Ler raw body do stream buffered (EnableBuffering() no Program.cs)
            Request.Body.Position = 0;
            var rawBody = await new StreamReader(Request.Body, Encoding.UTF8, leaveOpen: true).ReadToEndAsync(cancellationToken);
            Request.Body.Position = 0;

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(configuredSecret));
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(rawBody));
            var computed = Convert.ToBase64String(hash);

            if (!string.Equals(computed, signature, StringComparison.Ordinal))
            {
                logger.LogWarning("[DailyWebhook] HMAC inválido. Esperado={Expected}, Recebido={Received}", computed[..8] + "...", signature[..Math.Min(8, signature.Length)] + "...");
                return Unauthorized();
            }
        }

        if (payload?.Type == null)
        {
            logger.LogDebug("[DailyWebhook] Payload vazio ou sem type.");
            return Ok();
        }

        if (payload.Type != "recording.ready-to-download")
        {
            logger.LogDebug("[DailyWebhook] Evento ignorado: {Type}", payload.Type);
            return Ok();
        }

        var recordingId = payload.Payload?.RecordingId ?? payload.Payload?.recording_id;
        var roomName = payload.Payload?.RoomName ?? payload.Payload?.room_name;
        if (string.IsNullOrEmpty(recordingId) || string.IsNullOrEmpty(roomName))
        {
            logger.LogWarning("[DailyWebhook] recording.ready-to-download sem recording_id ou room_name.");
            return Ok();
        }

        var prefix = $"{dailyConfig.Value.RoomPrefix}-";
        if (!roomName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning("[DailyWebhook] room_name não começa com {Prefix}: {RoomName}", prefix, roomName);
            return Ok();
        }

        var requestIdStr = roomName[prefix.Length..];
        if (!Guid.TryParse(requestIdStr, out var requestId))
        {
            logger.LogWarning("[DailyWebhook] room_name não contém requestId válido: {RoomName}", roomName);
            return Ok();
        }

        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null)
        {
            logger.LogWarning("[DailyWebhook] Request não encontrado: {RequestId}", requestId);
            return Ok();
        }

        var (downloadLink, _) = await dailyVideoService.GetRecordingAccessLinkAsync(recordingId, 3600, cancellationToken);
        if (string.IsNullOrEmpty(downloadLink))
        {
            logger.LogWarning("[DailyWebhook] Não foi possível obter link de download da gravação {RecordingId}.", recordingId);
            return Ok();
        }

        // PERF FIX: streaming — baixa o vídeo como stream e envia para S3 sem carregar tudo na memória
        var path = $"consultas/{requestId:N}/gravacao/consulta-{requestId:N}-{recordingId}.mp4";
        StorageUploadResult uploadResult;
        long streamSize = 0;
        try
        {
            var client = httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("RenoveJaBackend", "1.0"));
            var response = await client.GetAsync(downloadLink, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            response.EnsureSuccessStatusCode();

            streamSize = response.Content.Headers.ContentLength ?? 0;
            if (streamSize == 0)
            {
                // Fallback: checar se stream realmente tem dados
                await using var checkStream = await response.Content.ReadAsStreamAsync(cancellationToken);
                if (checkStream == null || !checkStream.CanRead)
                {
                    logger.LogWarning("[DailyWebhook] Gravação vazia (stream): {RecordingId}.", recordingId);
                    return Ok();
                }
                uploadResult = await storageService.UploadStreamAsync(path, checkStream, "video/mp4", cancellationToken);
            }
            else
            {
                await using var videoStream = await response.Content.ReadAsStreamAsync(cancellationToken);
                uploadResult = await storageService.UploadStreamAsync(path, videoStream, "video/mp4", cancellationToken);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[DailyWebhook] Falha ao baixar/enviar gravação {RecordingId}.", recordingId);
            return Ok();
        }

        if (!uploadResult.Success || string.IsNullOrEmpty(uploadResult.Url))
        {
            logger.LogError("[DailyWebhook] Falha ao enviar gravação para S3: {RequestId} Error={Error}", requestId, uploadResult.ErrorMessage);
            return Ok();
        }

        logger.LogInformation("[DailyWebhook] Gravação enviada à AWS (stream): RequestId={RequestId} Path={Path} ContentLength={Size}", requestId, path, streamSize);

        var existing = await consultationAnamnesisRepository.GetByRequestIdAsync(requestId, cancellationToken);
        if (existing != null)
        {
            existing.SetRecordingFileUrl(uploadResult.Url);
            await consultationAnamnesisRepository.UpdateAsync(existing, cancellationToken);
        }
        else
        {
            var entity = ConsultationAnamnesis.Create(
                requestId,
                request.PatientId,
                transcriptText: null,
                transcriptFileUrl: null,
                recordingFileUrl: uploadResult.Url,
                anamnesisJson: null,
                aiSuggestionsJson: null,
                evidenceJson: null);
            await consultationAnamnesisRepository.CreateAsync(entity, cancellationToken);
        }

        return Ok();
    }

    /// <summary>Payload do webhook Daily (campos em camelCase ou snake_case conforme documentação).</summary>
    public class DailyWebhookPayload
    {
        public string? Type { get; set; }
        public DailyWebhookPayloadInner? Payload { get; set; }
    }

    public class DailyWebhookPayloadInner
    {
        public string? RecordingId { get; set; }
        public string? recording_id { get; set; }
        public string? RoomName { get; set; }
        public string? room_name { get; set; }
    }
}
