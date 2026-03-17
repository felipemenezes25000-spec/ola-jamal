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
        // Validar HMAC-SHA256 do Daily.co (o Daily assina o body e envia no header X-Webhook-Signature).
        // O secret do Daily é BASE-64 encoded; decodificar antes de usar no HMAC.
        var configuredSecret = dailyConfig.Value.WebhookSecret;
        if (string.IsNullOrWhiteSpace(configuredSecret))
        {
            logger.LogError("[DailyWebhook] WebhookSecret não configurado. Rejeitando requisição por segurança.");
            return StatusCode(503, new { error = "Webhook secret not configured. Cannot validate request." });
        }

        {
            var signature = Request.Headers["X-Webhook-Signature"].ToString();
            if (string.IsNullOrEmpty(signature))
            {
                logger.LogWarning("[DailyWebhook] Header X-Webhook-Signature ausente. Rejeitando.");
                return Unauthorized();
            }

            // Ler raw body do stream buffered (EnableBuffering() no Program.cs)
            Request.Body.Position = 0;
            var rawBody = await new StreamReader(Request.Body, Encoding.UTF8, leaveOpen: true).ReadToEndAsync(cancellationToken);
            Request.Body.Position = 0;

            byte[] keyBytes;
            try
            {
                keyBytes = Convert.FromBase64String(configuredSecret.Trim());
            }
            catch (FormatException)
            {
                keyBytes = Encoding.UTF8.GetBytes(configuredSecret);
            }

            using var hmac = new HMACSHA256(keyBytes);
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(rawBody));
            var computed = Convert.ToBase64String(hash);

            if (!string.Equals(computed, signature, StringComparison.Ordinal))
            {
                logger.LogWarning("[DailyWebhook] HMAC inválido. Esperado={Expected}, Recebido={Received}", computed[..Math.Min(8, computed.Length)] + "...", signature[..Math.Min(8, signature.Length)] + "...");
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

        // Retry: até 4 tentativas (download + upload). Retorna 503 em falha para Daily reenviar webhook.
        const int maxAttempts = 4;
        const int baseDelayMs = 1000;
        var path = $"consultas/{requestId:N}/gravacao/consulta-{requestId:N}-{recordingId}.mp4";
        StorageUploadResult? uploadResult = null;
        long streamSize = 0;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            var (downloadLink, _) = await dailyVideoService.GetRecordingAccessLinkAsync(recordingId, 3600, cancellationToken);
            if (string.IsNullOrEmpty(downloadLink))
            {
                logger.LogWarning("[DailyWebhook] Tentativa {Attempt}/{Max}: link de download vazio para {RecordingId}.", attempt, maxAttempts, recordingId);
                if (attempt < maxAttempts) await Task.Delay(baseDelayMs * (1 << (attempt - 1)), cancellationToken);
                continue;
            }

            try
            {
                var client = httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromMinutes(10);
                client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("RenoveJaBackend", "1.0"));
                var response = await client.GetAsync(downloadLink, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                response.EnsureSuccessStatusCode();

                streamSize = response.Content.Headers.ContentLength ?? 0;
                await using var videoStream = await response.Content.ReadAsStreamAsync(cancellationToken);
                if (streamSize == 0 && (videoStream == null || !videoStream.CanRead))
                {
                    logger.LogWarning("[DailyWebhook] Tentativa {Attempt}/{Max}: stream vazio para {RecordingId}.", attempt, maxAttempts, recordingId);
                    if (attempt < maxAttempts) await Task.Delay(baseDelayMs * (1 << (attempt - 1)), cancellationToken);
                    continue;
                }

                uploadResult = await storageService.UploadStreamAsync(path, videoStream, "video/mp4", cancellationToken);
                if (uploadResult.Success && !string.IsNullOrEmpty(uploadResult.Url))
                    break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "[DailyWebhook] Tentativa {Attempt}/{Max} falhou para {RecordingId}.", attempt, maxAttempts, recordingId);
            }

            if (attempt < maxAttempts)
                await Task.Delay(baseDelayMs * (1 << (attempt - 1)), cancellationToken);
        }

        if (uploadResult == null || !uploadResult.Success || string.IsNullOrEmpty(uploadResult.Url))
        {
            logger.LogError("[DailyWebhook] Todas as {Max} tentativas falharam. RequestId={RequestId} RecordingId={RecordingId}. Retornando 503 para Daily reenviar.", maxAttempts, requestId, recordingId);
            return StatusCode(503, new { error = "Falha ao processar gravação. Daily reenviará o webhook." });
        }

        var savedUrl = uploadResult.Url!;
        logger.LogInformation("[DailyWebhook] Gravação enviada à AWS (stream): RequestId={RequestId} Path={Path} ContentLength={Size}", requestId, path, streamSize);

        var existing = await consultationAnamnesisRepository.GetByRequestIdAsync(requestId, cancellationToken);
        if (existing != null)
        {
            existing.SetRecordingFileUrl(savedUrl);
            await consultationAnamnesisRepository.UpdateAsync(existing, cancellationToken);
        }
        else
        {
            var entity = ConsultationAnamnesis.Create(
                requestId,
                request.PatientId,
                transcriptText: null,
                transcriptFileUrl: null,
                recordingFileUrl: savedUrl,
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
