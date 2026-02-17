using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Payments;
using RenoveJa.Domain.Interfaces;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por pagamentos (PIX, confirmação, webhook).
/// </summary>
[ApiController]
[Route("api/payments")]
public class PaymentsController(
    IPaymentService paymentService,
    IWebhookEventRepository webhookEventRepository,
    IOptions<MercadoPagoConfig> mpConfig,
    ILogger<PaymentsController> logger) : ControllerBase
{
    /// <summary>
    /// Cria um novo pagamento para uma solicitação.
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreatePayment(
        [FromBody] CreatePaymentRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        logger.LogInformation("Payments CreatePayment: userId={UserId}, requestId={RequestId}", userId, request.RequestId);
        var payment = await paymentService.CreatePaymentAsync(request, userId, cancellationToken);
        logger.LogInformation("Payments CreatePayment OK: paymentId={PaymentId}", payment.Id);
        return Ok(payment);
    }

    /// <summary>
    /// Obtém URL do Checkout Pro para pagamento com cartão. Abra a URL no navegador.
    /// </summary>
    [HttpGet("checkout-pro/{requestId}")]
    [Authorize]
    public async Task<IActionResult> GetCheckoutProUrl(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var result = await paymentService.GetCheckoutProUrlAsync(requestId, userId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Obtém o pagamento PIX pendente de uma solicitação (para o paciente pagar).
    /// </summary>
    [HttpGet("by-request/{requestId}")]
    [Authorize]
    public async Task<IActionResult> GetPaymentByRequest(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var payment = await paymentService.GetPaymentByRequestIdAsync(requestId, userId, cancellationToken);
        if (payment == null)
            return NotFound(new { message = "Nenhum pagamento pendente para esta solicitação" });
        return Ok(payment);
    }

    /// <summary>
    /// Obtém um pagamento pelo ID.
    /// </summary>
    [HttpGet("{id}")]
    [Authorize]
    public async Task<IActionResult> GetPayment(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var payment = await paymentService.GetPaymentAsync(id, userId, cancellationToken);
        return Ok(payment);
    }

    /// <summary>
    /// Retorna o código PIX copia-e-cola completo em texto puro (para copiar e testar).
    /// </summary>
    [HttpGet("{id}/pix-code")]
    [Authorize]
    public async Task<IActionResult> GetPixCode(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var payment = await paymentService.GetPaymentAsync(id, userId, cancellationToken);
        var code = payment.PixCopyPaste ?? payment.PixQrCode ?? "";
        return Content(code, "text/plain; charset=utf-8");
    }

    /// <summary>
    /// Confirma um pagamento pelo ID do pagamento.
    /// </summary>
    [HttpPost("{id}/confirm")]
    public async Task<IActionResult> ConfirmPayment(
        Guid id,
        CancellationToken cancellationToken)
    {
        var payment = await paymentService.ConfirmPaymentAsync(id, cancellationToken);
        return Ok(payment);
    }

    /// <summary>
    /// Confirma o pagamento pendente de uma solicitação (por requestId). Para testes.
    /// Use o ID da solicitação, não o ID do pagamento.
    /// </summary>
    [HttpPost("confirm-by-request/{requestId}")]
    public async Task<IActionResult> ConfirmPaymentByRequest(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var payment = await paymentService.ConfirmPaymentByRequestIdAsync(requestId, cancellationToken);
        return Ok(payment);
    }

    /// <summary>
    /// Lista cartões salvos do usuário.
    /// </summary>
    [HttpGet("saved-cards")]
    [Authorize]
    public async Task<IActionResult> GetSavedCards(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var cards = await paymentService.GetSavedCardsAsync(userId, cancellationToken);
        return Ok(cards);
    }

    /// <summary>
    /// Adiciona um cartão salvo (token do Brick em modo somente cartão).
    /// </summary>
    [HttpPost("add-card")]
    [Authorize]
    public async Task<IActionResult> AddCard(
        [FromBody] AddCardRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        await paymentService.AddCardAsync(userId, request.Token, cancellationToken);
        return Ok(new { message = "Cartão adicionado com sucesso." });
    }

    /// <summary>
    /// Pagar com cartão salvo (token criado via mp.fields.createCardToken com CVV).
    /// </summary>
    [HttpPost("saved-card")]
    [Authorize]
    public async Task<IActionResult> PayWithSavedCard(
        [FromBody] PayWithSavedCardRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var payment = await paymentService.PayWithSavedCardAsync(request, userId, cancellationToken);
        return Ok(payment);
    }

    /// <summary>
    /// Sincroniza o status do pagamento com a API do Mercado Pago. Útil quando o webhook falha.
    /// Use o ID da solicitação (requestId), não o ID do pagamento.
    /// </summary>
    [HttpPost("sync-status/{requestId}")]
    [Authorize]
    public async Task<IActionResult> SyncPaymentStatus(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var payment = await paymentService.SyncPaymentStatusAsync(requestId, cancellationToken);
        if (payment == null)
            return NotFound(new { message = "Nenhum pagamento encontrado para esta solicitação" });
        return Ok(payment);
    }

    /// <summary>
    /// Recebe webhooks do Mercado Pago. Valida assinatura HMAC-SHA256 quando WebhookSecret está configurado.
    /// Aceita notificação por body JSON ou por query string (data.id/type ou id/topic), conforme documentação MP.
    /// NÃO usa [FromBody] porque query strings como ?data.id=X causam falha no model binding (ASP.NET retorna 400).
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook(
        CancellationToken cancellationToken)
    {
        // LOG INICIAL: capturar informações antes de qualquer processamento
        var queryStringRaw = Request.QueryString.Value ?? "";
        var contentType = Request.ContentType ?? "null";
        var contentLength = Request.ContentLength ?? 0;
        var queryKeys = string.Join(", ", Request.Query.Keys);
        
        Console.WriteLine($"[WEBHOOK-IN] QueryString={queryStringRaw}, ContentType={contentType}, ContentLength={contentLength}, QueryKeys=[{queryKeys}]");
        logger.LogInformation("[WEBHOOK-IN] QueryString={QueryString}, ContentType={ContentType}, ContentLength={ContentLength}, QueryKeys=[{QueryKeys}]",
            queryStringRaw, contentType, contentLength, queryKeys);
        
        string? dataIdFromBody = null;
        string? actionFromBody = null;
        MercadoPagoWebhookDto? parsedWebhook = null;

        // SEMPRE ler body bruto primeiro (EnableBuffering já foi chamado no middleware)
        try
        {
            Console.WriteLine($"[WEBHOOK-BODY] Tentando ler body. Body.Position antes: {Request.Body.Position}, CanSeek: {Request.Body.CanSeek}");
            Request.Body.Position = 0;
            using var reader = new StreamReader(Request.Body, System.Text.Encoding.UTF8);
            var rawBody = await reader.ReadToEndAsync(cancellationToken);
            Request.Body.Position = 0;

            var bodyPreview = rawBody != null && rawBody.Length > 0 
                ? rawBody.Substring(0, Math.Min(500, rawBody.Length))
                : "(vazio)";
            
            Console.WriteLine($"[WEBHOOK-BODY] Body lido. Length={rawBody?.Length ?? 0}, Preview={bodyPreview}");
            logger.LogInformation("Payments Webhook: body length={Length}, contentType={ContentType}, preview={Preview}", 
                rawBody?.Length ?? 0, Request.ContentType ?? "null", bodyPreview);

            if (!string.IsNullOrWhiteSpace(rawBody))
            {
                try
                {
                    using var doc = JsonDocument.Parse(rawBody);
                    var root = doc.RootElement;
                    
                    JsonElement dataEl = default;
                    JsonElement idEl = default;
                    
                    // Extrair data.id do JSON (formato: { "data": { "id": "145782442303" } })
                    if (root.TryGetProperty("data", out dataEl) && dataEl.TryGetProperty("id", out idEl))
                    {
                        dataIdFromBody = idEl.ValueKind == JsonValueKind.Number
                            ? idEl.GetInt64().ToString()
                            : idEl.GetString();
                    }
                    
                    // Extrair action (formato: { "action": "payment.updated" })
                    if (root.TryGetProperty("action", out var actionEl))
                    {
                        actionFromBody = actionEl.GetString();
                    }
                    else if (root.TryGetProperty("type", out var typeEl))
                    {
                        var type = typeEl.GetString();
                        if (type?.Equals("payment", StringComparison.OrdinalIgnoreCase) == true)
                            actionFromBody = "payment.updated";
                    }
                    else if (root.TryGetProperty("topic", out var topicEl))
                    {
                        var topic = topicEl.GetString();
                        if (topic?.Equals("payment", StringComparison.OrdinalIgnoreCase) == true)
                            actionFromBody = "payment.updated";
                    }

                    // Formato antigo: { "resource": "146517732918", "topic": "payment" }
                    if (string.IsNullOrEmpty(dataIdFromBody) && root.TryGetProperty("resource", out var resourceEl))
                    {
                        dataIdFromBody = resourceEl.ValueKind == JsonValueKind.Number
                            ? resourceEl.GetInt64().ToString()
                            : resourceEl.GetString();
                    }

                    // Construir DTO se body parse deu dados mas parsedWebhook está null
                    if (parsedWebhook == null && !string.IsNullOrEmpty(dataIdFromBody))
                    {
                        var dataDict = new Dictionary<string, JsonElement>();
                        if (dataEl.ValueKind == JsonValueKind.Object)
                        {
                            foreach (var prop in dataEl.EnumerateObject())
                                dataDict[prop.Name] = prop.Value.Clone();
                        }
                        else if (idEl.ValueKind != JsonValueKind.Null && idEl.ValueKind != JsonValueKind.Undefined)
                        {
                            dataDict["id"] = idEl.Clone();
                        }
                        
                        parsedWebhook = new MercadoPagoWebhookDto(
                            actionFromBody ?? "payment.updated",
                            dataIdFromBody,
                            dataDict
                        );
                    }
                    else if (parsedWebhook != null && string.IsNullOrEmpty(dataIdFromBody))
                    {
                        // Se model binding funcionou mas não extraímos data.id, tentar do DTO
                        dataIdFromBody = ExtractPaymentIdFromWebhook(parsedWebhook);
                    }
                }
                catch (JsonException jsonEx)
                {
                    bodyPreview = rawBody != null && rawBody.Length > 0 
                        ? rawBody.Substring(0, Math.Min(200, rawBody.Length))
                        : "(vazio)";
                    logger.LogWarning(jsonEx, "Payments Webhook: body não é JSON válido. Body: {Body}", bodyPreview);
                }
            }
            else
            {
                logger.LogInformation("Payments Webhook: body vazio ou nulo");
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Payments Webhook: falha ao ler body bruto.");
        }

        // Fallback: tentar query string (alguns webhooks antigos do MP podem usar query)
        var dataIdFromQuery = GetPaymentIdFromQuery();
        
        Console.WriteLine($"[WEBHOOK-QUERY] dataIdFromQuery={dataIdFromQuery ?? "null"}, dataIdFromBody={dataIdFromBody ?? "null"}");
        logger.LogInformation("[WEBHOOK-QUERY] dataIdFromQuery={FromQuery}, dataIdFromBody={FromBody}", 
            dataIdFromQuery ?? "null", dataIdFromBody ?? "null");

        var dataIdForHmac = dataIdFromQuery ?? dataIdFromBody;
        var dataIdForProcessing = dataIdFromQuery ?? dataIdFromBody;

        logger.LogInformation("Payments Webhook: recebido, dataId={DataId}, fromQuery={FromQuery}, fromBody={FromBody}, action={Action}, parsedWebhook={HasWebhook}",
            dataIdForProcessing ?? "null", !string.IsNullOrEmpty(dataIdFromQuery), !string.IsNullOrEmpty(dataIdFromBody), actionFromBody ?? "null", parsedWebhook != null);

        if (string.IsNullOrWhiteSpace(dataIdForProcessing))
        {
            queryKeys = string.Join(", ", Request.Query.Keys);
            var errorMsg = $"Missing payment id in query or body. QueryString={Request.QueryString.Value ?? "null"}, QueryKeys=[{queryKeys}], ContentType={Request.ContentType ?? "null"}, ContentLength={Request.ContentLength ?? 0}, dataIdFromQuery={dataIdFromQuery ?? "null"}, dataIdFromBody={dataIdFromBody ?? "null"}";
            Console.WriteLine($"[WEBHOOK-ERROR] {errorMsg}");
            logger.LogWarning("Payments Webhook: sem id na query nem no body. QueryString={QueryString}, QueryKeys=[{Keys}], ContentType={ContentType}, ContentLength={Length}, dataIdFromQuery={FromQuery}, dataIdFromBody={FromBody}",
                Request.QueryString.Value ?? "null", queryKeys, Request.ContentType ?? "null", Request.ContentLength ?? 0, dataIdFromQuery ?? "null", dataIdFromBody ?? "null");
            return BadRequest(new { error = "Missing payment id in query or body" });
        }

        // Garantir que temos um webhook válido para processar
        if (parsedWebhook == null && !string.IsNullOrEmpty(dataIdForProcessing))
        {
            logger.LogInformation("Payments Webhook: construindo DTO a partir do ID encontrado. dataId={DataId}, action={Action}",
                dataIdForProcessing, actionFromBody ?? "payment.updated");
            
            // Fallback: construir DTO a partir do ID encontrado (query string ou body parseado)
            try
            {
                using var doc = JsonDocument.Parse($"\"{dataIdForProcessing.Replace("\\", "\\\\").Replace("\"", "\\\"")}\"");
                var data = new Dictionary<string, JsonElement> { ["id"] = doc.RootElement.Clone() };
                parsedWebhook = new MercadoPagoWebhookDto(
                    actionFromBody ?? "payment.updated",
                    dataIdForProcessing,
                    data
                );
                logger.LogInformation("Payments Webhook: DTO construído com sucesso");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Payments Webhook: falha ao construir DTO a partir do ID. dataId={DataId}", dataIdForProcessing);
                // Tentar construir de forma mais simples
                var data = new Dictionary<string, JsonElement>();
                using (var doc = JsonDocument.Parse($"\"{dataIdForProcessing}\""))
                {
                    data["id"] = doc.RootElement.Clone();
                }
                parsedWebhook = new MercadoPagoWebhookDto(
                    actionFromBody ?? "payment.updated",
                    dataIdForProcessing,
                    data
                );
            }
        }

        if (parsedWebhook == null)
        {
            logger.LogError("Payments Webhook: não foi possível construir DTO do webhook. dataId={DataId}, fromQuery={FromQuery}, fromBody={FromBody}",
                dataIdForProcessing ?? "null", !string.IsNullOrEmpty(dataIdFromQuery), !string.IsNullOrEmpty(dataIdFromBody));
            return BadRequest(new { error = "Invalid webhook payload" });
        }

        // Validar assinatura HMAC do Mercado Pago (usa id da URL quando presente, senão do body)
        // Em Development, pula validação HMAC para facilitar testes com ngrok
        var webhookSecret = mpConfig.Value.WebhookSecret;
        var isDevelopment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")?.Equals("Development", StringComparison.OrdinalIgnoreCase) == true;
        var xRequestId = Request.Headers["x-request-id"].FirstOrDefault();
        
        if (!isDevelopment && !string.IsNullOrWhiteSpace(webhookSecret) && !webhookSecret.Contains("YOUR_"))
        {
            var xSignature = Request.Headers["x-signature"].FirstOrDefault();

            if (paymentService is PaymentService ps && !ps.ValidateWebhookSignature(xSignature, xRequestId, dataIdForHmac))
            {
                logger.LogWarning("Webhook MP rejeitado: assinatura HMAC inválida. x-signature={Sig}", xSignature);
                return Unauthorized(new { error = "Invalid webhook signature" });
            }
        }
        else if (isDevelopment)
        {
            logger.LogInformation("Webhook: validação HMAC desabilitada em Development");
        }

        // Persistir WebhookEvent antes do processamento para rastreamento completo
        string? rawBodyForEvent = null;
        try
        {
            Request.Body.Position = 0;
            using var reader = new StreamReader(Request.Body, System.Text.Encoding.UTF8);
            rawBodyForEvent = await reader.ReadToEndAsync(cancellationToken);
            Request.Body.Position = 0;
        }
        catch { /* best effort */ }
        var sourceIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        var requestHeaders = string.Join("; ", Request.Headers.Select(h => $"{h.Key}={string.Join(",", h.Value)}"));

        // Verificar idempotência: se já existe webhook com mesmo x-request-id, marcar como duplicado
        Domain.Entities.WebhookEvent? webhookEvent = null;
        if (!string.IsNullOrEmpty(xRequestId))
        {
            try
            {
                var existing = await webhookEventRepository.GetByMercadoPagoRequestIdAsync(xRequestId, cancellationToken);
                if (existing != null)
                {
                    existing.MarkAsDuplicate();
                    await webhookEventRepository.UpdateAsync(existing, cancellationToken);
                    logger.LogWarning("[WEBHOOK-EVENT] Webhook duplicado detectado. X-Request-Id={RequestId}, PaymentId={PaymentId}",
                        xRequestId, dataIdForProcessing);
                    Console.WriteLine($"[WEBHOOK-EVENT] Duplicado. X-Request-Id={xRequestId}");
                    return Ok(new { message = "Webhook já processado (duplicado)", duplicate = true });
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "[WEBHOOK-EVENT] Falha ao verificar duplicidade (tabela pode não existir ainda). X-Request-Id={RequestId}", xRequestId);
                // Continua o processamento mesmo se a verificação de duplicidade falhar
            }
        }

        // Criar novo WebhookEvent
        webhookEvent = new Domain.Entities.WebhookEvent(
            correlationId: null, // Será preenchido se encontrarmos PaymentAttempt relacionado
            mercadoPagoPaymentId: dataIdForProcessing,
            mercadoPagoRequestId: xRequestId,
            webhookType: actionFromBody?.Split('.').FirstOrDefault(),
            webhookAction: actionFromBody,
            rawPayload: rawBodyForEvent,
            queryString: queryStringRaw,
            requestHeaders: requestHeaders,
            contentType: contentType,
            contentLength: contentLength > 0 ? (int)contentLength : null,
            sourceIp: sourceIp);

        // Tentar encontrar correlationId através do PaymentAttempt
        if (!string.IsNullOrEmpty(dataIdForProcessing))
        {
            // Buscar PaymentAttempt pelo MercadoPagoPaymentId para obter correlationId
            // Nota: precisamos adicionar método no repositório ou buscar via Payment
            // Por enquanto, deixamos null e preenchemos depois se necessário
        }

        try
        {
            webhookEvent = await webhookEventRepository.CreateAsync(webhookEvent, cancellationToken);
            logger.LogInformation("[WEBHOOK-EVENT] Evento persistido. EventId={EventId}, PaymentId={PaymentId}, X-Request-Id={RequestId}",
                webhookEvent.Id, dataIdForProcessing, xRequestId ?? "null");
            Console.WriteLine($"[WEBHOOK-EVENT] Persistido. EventId={webhookEvent.Id}, PaymentId={dataIdForProcessing}");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[WEBHOOK-EVENT] Falha ao persistir WebhookEvent (tabela pode não existir ainda). PaymentId={PaymentId}", dataIdForProcessing);
            // Continua o processamento mesmo se a persistência falhar
        }

        try
        {
            await paymentService.ProcessWebhookAsync(parsedWebhook, cancellationToken);
            
            // Marcar como processado com sucesso (se webhookEvent foi criado)
            if (webhookEvent != null)
            {
                try
                {
                    webhookEvent.MarkAsProcessed(
                        processedPayload: JsonSerializer.Serialize(parsedWebhook),
                        paymentStatus: "processed",
                        paymentStatusDetail: null);
                    var updated = await webhookEventRepository.UpdateAsync(webhookEvent, cancellationToken);
                    if (updated != null)
                    {
                        logger.LogInformation("[WEBHOOK-EVENT] Processado com sucesso. EventId={EventId}, PaymentId={PaymentId}",
                            webhookEvent.Id, dataIdForProcessing);
                        Console.WriteLine($"[WEBHOOK-EVENT] Processado. EventId={webhookEvent.Id}");
                    }
                }
                catch (Exception persistEx)
                {
                    logger.LogWarning(persistEx, "[WEBHOOK-EVENT] Falha ao atualizar WebhookEvent. EventId={EventId}", webhookEvent?.Id);
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
                catch (Exception persistEx)
                {
                    logger.LogWarning(persistEx, "[WEBHOOK-EVENT] Falha ao marcar WebhookEvent como falho. EventId={EventId}", webhookEvent.Id);
                }
            }
            logger.LogError(ex, "[WEBHOOK-EVENT] Erro ao processar webhook. PaymentId={PaymentId}",
                dataIdForProcessing);
            Console.WriteLine($"[WEBHOOK-EVENT] Erro. PaymentId={dataIdForProcessing}, Error={ex.Message}");
            throw;
        }

        logger.LogInformation("Payments Webhook: processado com sucesso");
        return Ok();
    }

    /// <summary>
    /// Obtém o ID do pagamento da query string. O Mercado Pago envia data.id=XXX&amp;type=payment.
    /// Em ASP.NET Core, Request.Query["data.id"] pode falhar (ponto tratado como hierarquia).
    /// Por isso tentamos: (1) Query collection, (2) iteração nas chaves, (3) parse do QueryString bruto.
    /// </summary>
    private string? GetPaymentIdFromQuery()
    {
        var queryStringRaw = Request.QueryString.Value ?? "";
        Console.WriteLine($"[GET-PAYMENT-ID] QueryString bruto: {queryStringRaw}");
        Console.WriteLine($"[GET-PAYMENT-ID] Query.Keys: [{string.Join(", ", Request.Query.Keys)}]");
        
        // 1) Acesso direto (funciona na maioria dos casos)
        var dataIdDirect = Request.Query["data.id"].FirstOrDefault();
        var dataIdUnderscore = Request.Query["data_id"].FirstOrDefault();
        var idDirect = Request.Query["id"].FirstOrDefault();
        
        Console.WriteLine($"[GET-PAYMENT-ID] Tentativa 1 - data.id={dataIdDirect ?? "null"}, data_id={dataIdUnderscore ?? "null"}, id={idDirect ?? "null"}");
        
        var fromCollection = dataIdDirect ?? dataIdUnderscore ?? idDirect;
        if (!string.IsNullOrWhiteSpace(fromCollection) && fromCollection.All(char.IsDigit))
        {
            Console.WriteLine($"[GET-PAYMENT-ID] Encontrado via collection: {fromCollection}");
            return fromCollection;
        }

        // 2) Fallback: iterar chaves (ex.: chave "data.id" com valor numérico)
        var fromKeys = GetDataIdFromQueryFallback();
        if (!string.IsNullOrWhiteSpace(fromKeys))
        {
            Console.WriteLine($"[GET-PAYMENT-ID] Encontrado via fallback keys: {fromKeys}");
            return fromKeys;
        }

        // 3) Parse do QueryString bruto (?data.id=145782054455&amp;type=payment) para não depender do IQueryCollection
        var raw = Request.QueryString.Value;
        if (string.IsNullOrWhiteSpace(raw) || raw.Length < 10)
        {
            Console.WriteLine($"[GET-PAYMENT-ID] QueryString muito curto ou vazio: {raw ?? "null"}");
            return null;
        }
        var query = raw.TrimStart('?');
        Console.WriteLine($"[GET-PAYMENT-ID] Tentativa 3 - Parse manual do QueryString: {query}");
        foreach (var pair in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var eq = pair.IndexOf('=');
            if (eq <= 0)
                continue;
            var key = Uri.UnescapeDataString(pair[..eq].Trim());
            var value = Uri.UnescapeDataString(pair[(eq + 1)..].Trim());
            Console.WriteLine($"[GET-PAYMENT-ID] Par chave-valor: {key}={value}");
            if ((key.Equals("data.id", StringComparison.OrdinalIgnoreCase) || key.Equals("data_id", StringComparison.OrdinalIgnoreCase) || key.Equals("id", StringComparison.OrdinalIgnoreCase))
                && value.Length > 0 && value.Length < 20 && value.All(char.IsDigit))
            {
                Console.WriteLine($"[GET-PAYMENT-ID] Encontrado via parse manual: {value}");
                return value;
            }
        }
        Console.WriteLine($"[GET-PAYMENT-ID] Nenhum ID encontrado em nenhuma tentativa");
        return null;
    }

    /// <summary>
    /// Fallback: percorre as chaves da Query e retorna o primeiro valor numérico cuja chave contenha "id".
    /// </summary>
    private string? GetDataIdFromQueryFallback()
    {
        foreach (var key in Request.Query.Keys)
        {
            if (key.IndexOf("id", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                var val = Request.Query[key].FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(val) && val.Length < 20 && val.All(c => char.IsDigit(c)))
                    return val;
            }
        }
        return null;
    }

    private static string? ExtractPaymentIdFromWebhook(MercadoPagoWebhookDto? webhook)
    {
        if (webhook?.Data != null && webhook.Data.TryGetValue("id", out var idVal))
        {
            return idVal.ValueKind == JsonValueKind.Number
                ? idVal.GetInt64().ToString()
                : idVal.GetString();
        }
        return webhook?.Id;
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
