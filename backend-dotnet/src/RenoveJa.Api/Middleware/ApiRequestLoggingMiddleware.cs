using System.Diagnostics;
using System.Security.Claims;

namespace RenoveJa.Api.Middleware;

/// <summary>
/// Middleware que registra TODAS as requisições HTTP em log (console + arquivo).
/// Garante controle total: método, path, query, usuário, IP, status, duração, erros.
/// </summary>
public class ApiRequestLoggingMiddleware(RequestDelegate next, ILogger<ApiRequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Items["CorrelationId"]?.ToString() ?? context.TraceIdentifier;
        var path = context.Request.Path.Value ?? "";
        var method = context.Request.Method;
        var query = context.Request.QueryString.HasValue ? context.Request.QueryString.Value : "";

        var userId = context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "-";
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "-";

        logger.LogInformation(
            "[API-IN] {Method} {Path}{Query} | UserId={UserId} | IP={IP} | CorrelationId={CorrelationId}",
            method, path, query, userId, ip, correlationId);

        var sw = Stopwatch.StartNew();
        try
        {
            await next(context);
        }
        finally
        {
            sw.Stop();
            var status = context.Response.StatusCode;
            var logLevel = status >= 500 ? LogLevel.Error : status >= 400 ? LogLevel.Warning : LogLevel.Information;
            logger.Log(logLevel,
                "[API-OUT] {Method} {Path} | Status={Status} | {Duration}ms | UserId={UserId} | CorrelationId={CorrelationId}",
                method, path, status, sw.ElapsedMilliseconds, userId, correlationId);
        }
    }
}
