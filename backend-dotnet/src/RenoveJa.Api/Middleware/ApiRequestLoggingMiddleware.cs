using System.Diagnostics;
using System.Security.Claims;

namespace RenoveJa.Api.Middleware;

/// <summary>
/// Middleware que registra requisições HTTP de forma objetiva: apenas erros (4xx/5xx),
/// requisições lentas (>3s) e exceções. Evita poluição com health checks e 2xx rápidos.
/// </summary>
public class ApiRequestLoggingMiddleware(RequestDelegate next, ILogger<ApiRequestLoggingMiddleware> logger)
{
    private const long SlowRequestThresholdMs = 3000;

    private static bool ShouldSkipLogging(string path)
    {
        if (string.IsNullOrEmpty(path)) return true;
        return path.StartsWith("/api/health", StringComparison.OrdinalIgnoreCase);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";
        if (ShouldSkipLogging(path))
        {
            await next(context);
            return;
        }

        var correlationId = context.Items["CorrelationId"]?.ToString() ?? context.TraceIdentifier;
        var method = context.Request.Method;
        var userId = context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "-";

        var sw = Stopwatch.StartNew();
        try
        {
            await next(context);
        }
        finally
        {
            sw.Stop();
            var status = context.Response.StatusCode;
            var durationMs = sw.ElapsedMilliseconds;
            var isError = status >= 400;
            var isSlow = durationMs >= SlowRequestThresholdMs;

            if (isError || isSlow)
            {
                // Warning+ para erros importantes; Info fica só em Console/File
                var logLevel = status >= 500 ? LogLevel.Error
                    : (status >= 400 || isSlow) ? LogLevel.Warning
                    : LogLevel.Information;
                var reason = isError ? $"Status={status}" : $"Lento={durationMs}ms";
                logger.Log(logLevel,
                    "[API] {Method} {Path} | {Reason} | {Duration}ms | UserId={UserId} | CorrelationId={CorrelationId}",
                    method, path, reason, durationMs, userId, correlationId);
            }
        }
    }
}
