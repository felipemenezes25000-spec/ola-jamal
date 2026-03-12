using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Payments;

/// <summary>
/// Orquestra o processamento de webhooks do Mercado Pago: parse, validação HMAC, persistência e processamento.
/// </summary>
public class PaymentWebhookHandler(
    IPaymentService paymentService,
    IWebhookEventRepository webhookEventRepository,
    IOptions<MercadoPagoConfig> mpConfig,
    ILogger<PaymentWebhookHandler> logger) : IPaymentWebhookHandler
{
    public async Task<PaymentWebhookHandleResult> HandleAsync(
        string? rawBody,
        string queryString,
        IReadOnlyDictionary<string, string> headers,
        string? contentType,
        long? contentLength,
        string? sourceIp,
        CancellationToken cancellationToken = default)
    {
        var queryStringRaw = queryString ?? "";
        var xRequestId = headers.GetValueOrDefault("x-request-id", headers.GetValueOrDefault("X-Request-Id", ""));
        var xSignature = headers.GetValueOrDefault("x-signature", headers.GetValueOrDefault("X-Signature", ""));

        string? dataIdFromBody = null;
        string? actionFromBody = null;
        MercadoPagoWebhookDto? parsedWebhook = null;

        if (!string.IsNullOrWhiteSpace(rawBody))
        {
            try
            {
                using var doc = JsonDocument.Parse(rawBody);
                var root = doc.RootElement;

                JsonElement dataEl = default;
                JsonElement idEl = default;

                if (root.TryGetProperty("data", out dataEl) && dataEl.TryGetProperty("id", out idEl))
                {
                    dataIdFromBody = idEl.ValueKind == JsonValueKind.Number
                        ? idEl.GetInt64().ToString()
                        : idEl.GetString();
                }

                if (root.TryGetProperty("action", out var actionEl))
                    actionFromBody = actionEl.GetString();
                else if (root.TryGetProperty("type", out var typeEl))
                {
                    if (typeEl.GetString()?.Equals("payment", StringComparison.OrdinalIgnoreCase) == true)
                        actionFromBody = "payment.updated";
                }
                else if (root.TryGetProperty("topic", out var topicEl))
                {
                    if (topicEl.GetString()?.Equals("payment", StringComparison.OrdinalIgnoreCase) == true)
                        actionFromBody = "payment.updated";
                }

                if (string.IsNullOrEmpty(dataIdFromBody) && root.TryGetProperty("resource", out var resourceEl))
                {
                    dataIdFromBody = resourceEl.ValueKind == JsonValueKind.Number
                        ? resourceEl.GetInt64().ToString()
                        : resourceEl.GetString();
                }

                if (parsedWebhook == null && !string.IsNullOrEmpty(dataIdFromBody))
                {
                    var dataDict = new Dictionary<string, JsonElement>();
                    if (dataEl.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var prop in dataEl.EnumerateObject())
                            dataDict[prop.Name] = prop.Value.Clone();
                    }
                    else if (idEl.ValueKind != JsonValueKind.Null && idEl.ValueKind != JsonValueKind.Undefined)
                        dataDict["id"] = idEl.Clone();

                    parsedWebhook = new MercadoPagoWebhookDto(
                        actionFromBody ?? "payment.updated",
                        dataIdFromBody,
                        dataDict
                    );
                }
            }
            catch (JsonException jsonEx)
            {
                logger.LogWarning(jsonEx, "Payments Webhook: body não é JSON válido.");
            }
        }

        var dataIdFromQuery = GetPaymentIdFromQuery(queryStringRaw);
        var dataIdForHmac = dataIdFromQuery;
        var dataIdForProcessing = dataIdFromQuery ?? dataIdFromBody;

        if (string.IsNullOrWhiteSpace(dataIdForProcessing))
        {
            logger.LogWarning("Payments Webhook: sem id na query nem no body.");
            return new PaymentWebhookHandleResult(PaymentWebhookResultKind.BadRequest, "Missing payment id in query or body");
        }

        if (parsedWebhook == null && !string.IsNullOrEmpty(dataIdForProcessing))
        {
            try
            {
                using var doc = JsonDocument.Parse($"\"{dataIdForProcessing.Replace("\\", "\\\\").Replace("\"", "\\\"")}\"");
                var data = new Dictionary<string, JsonElement> { ["id"] = doc.RootElement.Clone() };
                parsedWebhook = new MercadoPagoWebhookDto(
                    actionFromBody ?? "payment.updated",
                    dataIdForProcessing,
                    data
                );
            }
            catch
            {
                var data = new Dictionary<string, JsonElement>();
                using (var doc = JsonDocument.Parse($"\"{dataIdForProcessing}\""))
                    data["id"] = doc.RootElement.Clone();
                parsedWebhook = new MercadoPagoWebhookDto(
                    actionFromBody ?? "payment.updated",
                    dataIdForProcessing,
                    data
                );
            }
        }

        if (parsedWebhook == null)
        {
            return new PaymentWebhookHandleResult(PaymentWebhookResultKind.BadRequest, "Invalid webhook payload");
        }

        var webhookSecret = mpConfig.Value.WebhookSecret;
        if (!string.IsNullOrWhiteSpace(webhookSecret) && !webhookSecret.Contains("YOUR_"))
        {
            if (!ValidateWebhookSignature(dataIdForHmac, xSignature, xRequestId))
            {
                if (!string.IsNullOrWhiteSpace(dataIdForProcessing))
                {
                    var alreadyProcessed = await paymentService.IsPaymentProcessedByExternalIdAsync(dataIdForProcessing, cancellationToken);
                    if (alreadyProcessed)
                    {
                        logger.LogInformation("Webhook MP: HMAC inválido mas pagamento já processado. Retornando 200 idempotente.");
                        return new PaymentWebhookHandleResult(PaymentWebhookResultKind.Idempotent);
                    }
                }
                logger.LogWarning("Webhook MP rejeitado: assinatura HMAC inválida.");
                return new PaymentWebhookHandleResult(PaymentWebhookResultKind.Unauthorized, "Invalid webhook signature");
            }
        }
        else
        {
            logger.LogWarning("Webhook: MercadoPago:WebhookSecret não configurado — validação HMAC desabilitada.");
        }

        var requestHeaders = string.Join("; ", headers.Select(h => $"{h.Key}={h.Value}"));

        if (!string.IsNullOrEmpty(xRequestId))
        {
            try
            {
                var existing = await webhookEventRepository.GetByMercadoPagoRequestIdAsync(xRequestId, cancellationToken);
                if (existing != null)
                {
                    existing.MarkAsDuplicate();
                    await webhookEventRepository.UpdateAsync(existing, cancellationToken);
                    logger.LogWarning("[WEBHOOK-EVENT] Webhook duplicado detectado. X-Request-Id={RequestId}", xRequestId);
                    return new PaymentWebhookHandleResult(PaymentWebhookResultKind.Duplicate);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "[WEBHOOK-EVENT] Falha ao verificar duplicidade.");
            }
        }

        var webhookEvent = new WebhookEvent(
            correlationId: null,
            mercadoPagoPaymentId: dataIdForProcessing,
            mercadoPagoRequestId: xRequestId,
            webhookType: actionFromBody?.Split('.').FirstOrDefault(),
            webhookAction: actionFromBody,
            rawPayload: rawBody,
            queryString: queryStringRaw,
            requestHeaders: requestHeaders,
            contentType: contentType,
            contentLength: contentLength > 0 ? (int)contentLength : null,
            sourceIp: sourceIp);

        try
        {
            webhookEvent = await webhookEventRepository.CreateAsync(webhookEvent, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[WEBHOOK-EVENT] Falha ao persistir WebhookEvent.");
        }

        try
        {
            await paymentService.ProcessWebhookAsync(parsedWebhook, cancellationToken);

            if (webhookEvent != null)
            {
                try
                {
                    webhookEvent.MarkAsProcessed(
                        JsonSerializer.Serialize(parsedWebhook),
                        "processed",
                        null);
                    await webhookEventRepository.UpdateAsync(webhookEvent, cancellationToken);
                }
                catch (Exception persistEx)
                {
                    logger.LogWarning(persistEx, "[WEBHOOK-EVENT] Falha ao atualizar WebhookEvent.");
                }
            }
        }
        catch (Exception ex)
        {
            if (webhookEvent != null)
            {
                try
                {
                    webhookEvent.MarkAsFailed(ex.Message);
                    await webhookEventRepository.UpdateAsync(webhookEvent, cancellationToken);
                }
                catch { /* best effort */ }
            }
            logger.LogError(ex, "[WEBHOOK-EVENT] Erro ao processar webhook.");
            throw;
        }

        return new PaymentWebhookHandleResult(PaymentWebhookResultKind.Success);
    }

    private static string? GetPaymentIdFromQuery(string queryStringRaw)
    {
        if (string.IsNullOrWhiteSpace(queryStringRaw) || queryStringRaw.Length < 10)
            return null;

        var query = queryStringRaw.TrimStart('?');
        foreach (var pair in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var eq = pair.IndexOf('=');
            if (eq <= 0) continue;
            var key = Uri.UnescapeDataString(pair[..eq].Trim());
            var value = Uri.UnescapeDataString(pair[(eq + 1)..].Trim());
            if ((key.Equals("data.id", StringComparison.OrdinalIgnoreCase) || key.Equals("data_id", StringComparison.OrdinalIgnoreCase) || key.Equals("id", StringComparison.OrdinalIgnoreCase))
                && value.Length > 0 && value.Length < 20 && value.All(char.IsDigit))
            {
                return value;
            }
        }
        return null;
    }

    private bool ValidateWebhookSignature(string? dataId, string? xSignature, string? xRequestId)
    {
        var secret = mpConfig.Value.WebhookSecret;
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(xSignature))
            return false;

        string? ts = null;
        string? v1 = null;
        foreach (var part in xSignature.Split(','))
        {
            var trimmed = part.Trim();
            if (trimmed.StartsWith("ts="))
                ts = trimmed[3..];
            else if (trimmed.StartsWith("v1="))
                v1 = trimmed[3..];
        }

        if (string.IsNullOrEmpty(ts) || string.IsNullOrEmpty(v1))
            return false;

        var manifest = string.IsNullOrWhiteSpace(dataId)
            ? $"request-id:{xRequestId};ts:{ts};"
            : string.IsNullOrWhiteSpace(xRequestId)
                ? $"id:{dataId};ts:{ts};"
                : $"id:{dataId};request-id:{xRequestId};ts:{ts};";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(manifest));
        var computed = BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        return string.Equals(computed, v1, StringComparison.OrdinalIgnoreCase);
    }
}
