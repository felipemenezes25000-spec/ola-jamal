using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private readonly SupabaseConfig _supabaseConfig;
    private readonly ILogger<HealthController> _logger;

    public HealthController(IHttpClientFactory httpFactory, IOptions<SupabaseConfig> supabaseConfig, ILogger<HealthController> logger)
    {
        _httpClient = httpFactory.CreateClient();
        _supabaseConfig = supabaseConfig.Value;
        _logger = logger;
    }

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

        _logger.LogInformation("Health check: status={Status}, checks={Checks}", overall ? "healthy" : "degraded", string.Join(",", checks.Keys));
        return Ok(new
        {
            status = overall ? "healthy" : "degraded",
            timestamp = DateTime.UtcNow,
            service = "RenoveJa API",
            version = "1.0.0",
            checks
        });
    }
}
