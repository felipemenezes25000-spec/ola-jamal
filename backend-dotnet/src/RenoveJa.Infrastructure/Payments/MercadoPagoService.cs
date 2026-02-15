using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Helpers;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.Payments;

/// <summary>
/// Integração com API do Mercado Pago para criação de pagamentos PIX e cartão.
/// </summary>
public class MercadoPagoService(
    IHttpClientFactory httpClientFactory,
    IOptions<MercadoPagoConfig> config,
    ILogger<MercadoPagoService> logger) : IMercadoPagoService
{
    private const string ApiBaseUrl = "https://api.mercadopago.com";

    public async Task<MercadoPagoPixResult> CreatePixPaymentAsync(
        decimal amount,
        string description,
        string payerEmail,
        string externalReference,
        CancellationToken cancellationToken = default)
    {
        var accessToken = config.Value.AccessToken;
        if (string.IsNullOrWhiteSpace(accessToken) || accessToken.Contains("YOUR_") || accessToken.Contains("_HERE"))
            throw new InvalidOperationException(
                "MercadoPago:AccessToken não configurado. Defina em appsettings (credenciais em developers.mercadopago.com).");

        var request = new
        {
            transaction_amount = Math.Round(amount, 2),
            description = description.Length > 200 ? description[..200] : description,
            payment_method_id = "pix",
            payer = new
            {
                email = payerEmail
            },
            external_reference = externalReference,
            notification_url = config.Value.NotificationUrl
        };

        var json = JsonSerializer.Serialize(request, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            WriteIndented = false
        });

        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Idempotency-Key", Guid.NewGuid().ToString());

        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await client.PostAsync($"{ApiBaseUrl}/v1/payments", content, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            var isUnauth = response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
                           (errorBody.Contains("unauthorized", StringComparison.OrdinalIgnoreCase) || errorBody.Contains("invalid access token", StringComparison.OrdinalIgnoreCase));
            var msg = isUnauth
                ? "Access Token do Mercado Pago inválido ou expirado. Obtenha um novo em: https://www.mercadopago.com.br/developers/panel/app → sua aplicação → Credenciais → Copiar Access Token de Teste. Atualize MercadoPago:AccessToken no appsettings.json e reinicie a API."
                : $"Mercado Pago PIX falhou: {response.StatusCode}. {errorBody}";
            throw new InvalidOperationException(msg);
        }

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(responseBody);
        var root = doc.RootElement;

        var id = root.TryGetProperty("id", out var idProp) ? idProp.GetInt64().ToString() : throw new InvalidOperationException("Resposta MP sem id");
        var poi = root.TryGetProperty("point_of_interaction", out var poiProp) ? poiProp : default;
        var txData = poi.ValueKind != JsonValueKind.Undefined && poi.TryGetProperty("transaction_data", out var td) ? td : default;

        var qrCodeBase64 = txData.ValueKind != JsonValueKind.Undefined && txData.TryGetProperty("qr_code_base64", out var qr64) ? qr64.GetString() ?? "" : "";
        var qrCode = txData.ValueKind != JsonValueKind.Undefined && txData.TryGetProperty("qr_code", out var qr) ? qr.GetString() ?? "" : "";
        // PIX copia e cola = qr_code (EMV). ticket_url = link para página de pagamento.
        var copyPaste = !string.IsNullOrEmpty(qrCode) ? qrCode : (txData.ValueKind != JsonValueKind.Undefined && txData.TryGetProperty("ticket_url", out var ticket) ? ticket.GetString() ?? "" : "");

        return new MercadoPagoPixResult(id, qrCodeBase64, qrCode, copyPaste);
    }

    public async Task<MercadoPagoCardResult> CreateCardPaymentAsync(
        decimal amount,
        string description,
        string payerEmail,
        string? payerCpf,
        string externalReference,
        string token,
        int installments,
        string paymentMethodId,
        long? issuerId,
        string? paymentTypeId = null,
        CancellationToken cancellationToken = default)
    {
        var accessToken = config.Value.AccessToken;
        if (string.IsNullOrWhiteSpace(accessToken) || accessToken.Contains("YOUR_") || accessToken.Contains("_HERE"))
            throw new InvalidOperationException(
                "MercadoPago:AccessToken não configurado. Defina em appsettings (credenciais em developers.mercadopago.com).");

        var payer = new Dictionary<string, object?>
        {
            ["email"] = payerEmail
        };

        // CPF: enviado pelo formulário do Brick (qualquer pessoa pode pagar). MP exige CPF válido (11 dígitos, algoritmo módulo 11).
        // Erro 2067 = Invalid user identification number.
        string? cpfToSend = null;
        if (CpfHelper.IsValidForPayment(payerCpf))
            cpfToSend = CpfHelper.ExtractDigits(payerCpf);
        if (!string.IsNullOrEmpty(cpfToSend))
            payer["identification"] = new { type = "CPF", number = cpfToSend };

        var request = new Dictionary<string, object?>
        {
            ["transaction_amount"] = Math.Round(amount, 2),
            ["description"] = description.Length > 200 ? description[..200] : description,
            ["payment_method_id"] = paymentMethodId.Trim().ToLowerInvariant(),
            ["token"] = token,
            ["installments"] = Math.Max(1, installments),
            ["payer"] = payer,
            ["external_reference"] = externalReference,
            ["notification_url"] = config.Value.NotificationUrl
        };
        if (issuerId.HasValue && issuerId.Value > 0)
            request["issuer_id"] = issuerId.Value;
        // Nota: a API POST /v1/payments rejeita o parâmetro payment_type_id (erro 8: "The name of the following parameters is wrong").
        // O MP infere crédito/débito pelo número do cartão (token). Para cartão múltiplo, o Brick gera o token já com a escolha do usuário; não enviamos payment_type_id.

        var json = JsonSerializer.Serialize(request, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            WriteIndented = false
        });

        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Idempotency-Key", Guid.NewGuid().ToString());

        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await client.PostAsync($"{ApiBaseUrl}/v1/payments", content, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            var isUnauth = response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
                           (errorBody.Contains("unauthorized", StringComparison.OrdinalIgnoreCase) || errorBody.Contains("invalid access token", StringComparison.OrdinalIgnoreCase));
            var msg = isUnauth
                ? "Access Token do Mercado Pago inválido ou expirado. Obtenha um novo em: https://www.mercadopago.com.br/developers/panel/app → Credenciais."
                : $"Mercado Pago (cartão) falhou: {response.StatusCode}. {errorBody}";
            throw new InvalidOperationException(msg);
        }

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(responseBody);
        var root = doc.RootElement;

        var id = root.TryGetProperty("id", out var idProp) ? idProp.GetInt64().ToString() : throw new InvalidOperationException("Resposta MP sem id");
        var status = root.TryGetProperty("status", out var statusProp) ? statusProp.GetString() ?? "pending" : "pending";

        return new MercadoPagoCardResult(id, status);
    }

    /// <summary>
    /// Obtém detalhes do pagamento (status e external_reference) para webhook Checkout Pro.
    /// </summary>
    public async Task<MercadoPagoPaymentDetails?> GetPaymentDetailsAsync(string paymentId, CancellationToken cancellationToken = default)
    {
        var accessToken = config.Value.AccessToken;
        if (string.IsNullOrWhiteSpace(accessToken) || accessToken.Contains("YOUR_"))
            return null;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{ApiBaseUrl}/v1/payments/{paymentId}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var client = httpClientFactory.CreateClient();
            var response = await client.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("MP GET /v1/payments/{PaymentId} returned {Status}", paymentId, response.StatusCode);
                return null;
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            var status = root.TryGetProperty("status", out var s) ? s.GetString() ?? "pending" : "pending";
            var externalRef = root.TryGetProperty("external_reference", out var er) ? er.GetString() : null;

            return new MercadoPagoPaymentDetails(status, externalRef);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Erro ao obter detalhes do pagamento {PaymentId} na API do MP", paymentId);
            return null;
        }
    }

    /// <summary>
    /// Cria preferência do Checkout Pro e retorna init_point (ou sandbox_init_point em modo teste).
    /// </summary>
    public async Task<string> CreateCheckoutProPreferenceAsync(
        decimal amount,
        string title,
        string externalReference,
        string payerEmail,
        string? redirectBaseUrl,
        CancellationToken cancellationToken = default)
    {
        var accessToken = config.Value.AccessToken;
        if (string.IsNullOrWhiteSpace(accessToken) || accessToken.Contains("YOUR_") || accessToken.Contains("_HERE"))
            throw new InvalidOperationException(
                "MercadoPago:AccessToken não configurado. Defina em appsettings (credenciais em developers.mercadopago.com).");

        var items = new[] { new { id = "item1", title = title.Length > 200 ? title[..200] : title, quantity = 1, currency_id = "BRL", unit_price = Math.Round(amount, 2) } };

        var payload = new Dictionary<string, object?>
        {
            ["items"] = items,
            ["external_reference"] = externalReference,
            ["notification_url"] = config.Value.NotificationUrl,
            ["payer"] = new { email = payerEmail }
        };

        if (!string.IsNullOrWhiteSpace(redirectBaseUrl) && !redirectBaseUrl.Contains("YOUR_"))
        {
            var baseUrl = redirectBaseUrl.TrimEnd('/');
            payload["back_urls"] = new
            {
                success = $"{baseUrl}/payment/success",
                pending = $"{baseUrl}/payment/pending",
                failure = $"{baseUrl}/payment/failure"
            };
            payload["auto_return"] = "approved";
        }

        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            WriteIndented = false
        });

        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await client.PostAsync($"{ApiBaseUrl}/checkout/preferences", content, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Mercado Pago Checkout Pro falhou: {response.StatusCode}. {errorBody}");
        }

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(responseBody);
        var root = doc.RootElement;

        var isTest = accessToken.StartsWith("TEST-", StringComparison.OrdinalIgnoreCase);
        var pointProp = isTest ? "sandbox_init_point" : "init_point";
        if (root.TryGetProperty(pointProp, out var initPoint))
            return initPoint.GetString() ?? "";
        if (root.TryGetProperty("init_point", out var ip))
            return ip.GetString() ?? "";
        throw new InvalidOperationException("Resposta MP sem init_point");
    }

    /// <summary>
    /// Verifica o status real de um pagamento na API do Mercado Pago.
    /// </summary>
    public async Task<string?> GetPaymentStatusAsync(string paymentId, CancellationToken cancellationToken = default)
    {
        var accessToken = config.Value.AccessToken;
        if (string.IsNullOrWhiteSpace(accessToken) || accessToken.Contains("YOUR_"))
            return null;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{ApiBaseUrl}/v1/payments/{paymentId}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var client = httpClientFactory.CreateClient();
            var response = await client.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("MP GET /v1/payments/{PaymentId} returned {Status}", paymentId, response.StatusCode);
                return null;
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.TryGetProperty("status", out var statusProp) ? statusProp.GetString() : null;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Erro ao verificar pagamento {PaymentId} na API do MP", paymentId);
            return null;
        }
    }
}
