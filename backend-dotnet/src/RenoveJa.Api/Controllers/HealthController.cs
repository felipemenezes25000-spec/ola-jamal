using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Health endpoints for monitoring and load balancers. No authentication required.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
[EnableRateLimiting("fixed")]
public class HealthController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private readonly SupabaseConfig _supabaseConfig;
    private readonly IRequestRepository _requestRepository;
    private readonly MercadoPagoConfig _mercadoPagoConfig;
    private readonly OpenAIConfig _openAiConfig;
    private readonly ILogger<HealthController> _logger;

    public HealthController(
        IHttpClientFactory httpFactory,
        IOptions<SupabaseConfig> supabaseConfig,
        IRequestRepository requestRepository,
        IOptions<MercadoPagoConfig> mercadoPagoConfig,
        IOptions<OpenAIConfig> openAiConfig,
        ILogger<HealthController> logger)
    {
        _httpClient = httpFactory.CreateClient();
        _supabaseConfig = supabaseConfig.Value;
        _requestRepository = requestRepository;
        _mercadoPagoConfig = mercadoPagoConfig.Value;
        _openAiConfig = openAiConfig.Value;
        _logger = logger;
    }

    /// <summary>
    /// Basic health check.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var checks = new Dictionary<string, object>();
        var overall = true;

        // Supabase REST
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Get, $"{_supabaseConfig.Url}/rest/v1/?limit=0");
            req.Headers.Add("apikey", _supabaseConfig.ServiceKey);
            var res = await _httpClient.SendAsync(req, ct);
            checks["supabase"] = new { status = res.IsSuccessStatusCode ? "ok" : "error", code = (int)res.StatusCode };
            if (!res.IsSuccessStatusCode) overall = false;
        }
        catch (Exception ex)
        {
            checks["supabase"] = new { status = "error", message = ex.Message };
            overall = false;
        }

        // Supabase Storage
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Get, $"{_supabaseConfig.Url}/storage/v1/bucket");
            req.Headers.Add("apikey", _supabaseConfig.ServiceKey);
            req.Headers.Add("Authorization", $"Bearer {_supabaseConfig.ServiceKey}");
            var res = await _httpClient.SendAsync(req, ct);
            checks["storage"] = new { status = res.IsSuccessStatusCode ? "ok" : "error", code = (int)res.StatusCode };
            if (!res.IsSuccessStatusCode) overall = false;
        }
        catch (Exception ex)
        {
            checks["storage"] = new { status = "error", message = ex.Message };
            overall = false;
        }

        if (!overall)
            _logger.LogWarning("Health check DEGRADED: checks={Checks}", string.Join(",", checks.Keys));
        return Ok(new
        {
            status = overall ? "healthy" : "degraded",
            timestamp = DateTime.UtcNow,
            service = "RenoveJa API",
            version = "1.0.0",
            checks
        });
    }

    /// <summary>
    /// Detailed readiness status for Kubernetes/load balancers.
    /// </summary>
    [HttpGet("readiness")]
    [AllowAnonymous]
    public async Task<IActionResult> GetReadiness(CancellationToken ct)
    {
        var detailed = User.Identity?.IsAuthenticated == true;

        var checks = new Dictionary<string, object>();
        var dbOk = false;
        var storageOk = false;
        var paymentOk = false;
        var aiOk = false;

        // Database connectivity (simple query via repository)
        try
        {
            _ = await _requestRepository.GetByIdAsync(Guid.Empty, ct);
            checks["database"] = new { status = "ok" };
            dbOk = true;
        }
        catch (Exception ex)
        {
            checks["database"] = new { status = "error" };
            if (detailed) checks["database"] = new { status = "error", message = ex.Message };
            _logger.LogWarning(ex, "Readiness: database check failed");
        }

        // Storage service availability
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Get, $"{_supabaseConfig.Url}/storage/v1/bucket");
            req.Headers.Add("apikey", _supabaseConfig.ServiceKey);
            req.Headers.Add("Authorization", $"Bearer {_supabaseConfig.ServiceKey}");
            var res = await _httpClient.SendAsync(req, ct);
            storageOk = res.IsSuccessStatusCode;
            checks["storage"] = detailed
                ? new { status = storageOk ? "ok" : "error", code = (int)res.StatusCode }
                : (object)new { status = storageOk ? "ok" : "error" };
        }
        catch (Exception ex)
        {
            checks["storage"] = new { status = "error" };
            if (detailed) checks["storage"] = new { status = "error", message = ex.Message };
            _logger.LogWarning(ex, "Readiness: storage check failed");
        }

        // Payment gateway (MercadoPago config present)
        paymentOk = !string.IsNullOrWhiteSpace(_mercadoPagoConfig.AccessToken);
        checks["payment"] = detailed
            ? new { status = paymentOk ? "ok" : "degraded", message = paymentOk ? "Configured" : "MercadoPago AccessToken not configured" }
            : (object)new { status = paymentOk ? "ok" : "degraded" };

        // AI service (Gemini ou OpenAI configurado)
        aiOk = !string.IsNullOrWhiteSpace(_openAiConfig.GeminiApiKey) || !string.IsNullOrWhiteSpace(_openAiConfig.ApiKey);
        checks["ai"] = detailed
            ? new { status = aiOk ? "ok" : "degraded", message = aiOk ? "Configured" : "OpenAI__ApiKey ou Gemini__ApiKey not configured" }
            : (object)new { status = aiOk ? "ok" : "degraded" };

        string overall;
        if (!dbOk || !storageOk)
            overall = "unhealthy";
        else if (!paymentOk || !aiOk)
            overall = "degraded";
        else
            overall = "healthy";

        if (overall != "healthy")
            _logger.LogWarning("Readiness {Status}: db={Db}, storage={Storage}, payment={Payment}, ai={Ai}",
                overall, dbOk, storageOk, paymentOk, aiOk);

        return Ok(new
        {
            status = overall,
            timestamp = DateTime.UtcNow,
            service = "RenoveJa API",
            checks
        });
    }

    /// <summary>
    /// SLO (Service Level Objective) metrics for monitoring.
    /// </summary>
    [HttpGet("slo")]
    public IActionResult Slo()
    {
        return Ok(new
        {
            targets = new
            {
                availabilityPercent = 99.8,
                p95LatencyMs = 450,
                paymentErrorRatePercent = 0.8
            },
            currentStatus = "monitoring",
            timestamp = DateTime.UtcNow,
            service = "RenoveJa API"
        });
    }
}
