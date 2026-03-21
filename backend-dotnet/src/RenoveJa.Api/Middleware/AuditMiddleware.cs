using System.Diagnostics;
using System.Security.Claims;
using RenoveJa.Api.Services;

namespace RenoveJa.Api.Middleware;

/// <summary>
/// Middleware de auditoria LGPD.
/// Intercepta todas as requests e registra endpoint, método, userId, IP, user-agent, status code e duração.
/// Para endpoints sensíveis (dados de saúde), adiciona detalhes extras.
/// Publica no AuditChannel para processamento assíncrono pelo AuditBackgroundService.
/// NÃO registra body de request (pode conter dados sensíveis).
/// </summary>
public class AuditMiddleware(
    RequestDelegate next,
    ILogger<AuditMiddleware> logger,
    AuditChannel auditChannel)
{
    /// <summary>
    /// Endpoints sensíveis que acessam dados de saúde.
    /// </summary>
    private static readonly string[] SensitivePathPrefixes =
    [
        "/api/requests",
        "/api/certificates",
        "/api/verify"
    ];

    /// <summary>
    /// Paths que não precisam de audit (health checks do ALB, métricas, favicon).
    /// Evita desperdício de conexões DB com requests de infraestrutura.
    /// </summary>
    private static readonly string[] SkipPaths =
    [
        "/api/health",
        "/health",
        "/healthz",
        "/favicon.ico"
    ];

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";

        // Skip audit for infrastructure endpoints (health checks, etc.)
        if (ShouldSkipAudit(path))
        {
            await next(context);
            return;
        }

        var stopwatch = Stopwatch.StartNew();

        // FIX #68: Wrap em try/finally para garantir audit mesmo quando next() lança exceção
        try
        {
            await next(context);
        }
        finally
        {
            stopwatch.Stop();

            // Capturar TUDO do context antes que ele seja disposed
            var method = context.Request.Method;
            var statusCode = context.Response.StatusCode;
            var ipAddress = context.Connection.RemoteIpAddress?.ToString();
            var userAgent = context.Request.Headers.UserAgent.ToString();
            if (userAgent?.Length > 256) userAgent = userAgent[..256];
            var correlationId = context.TraceIdentifier;
            var durationMs = stopwatch.ElapsedMilliseconds;

            Guid? userId = null;
            if (context.User?.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (Guid.TryParse(userIdClaim, out var parsedUserId))
                    userId = parsedUserId;
            }

            var action = method switch
            {
                "GET" => "Read",
                "POST" => "Create",
                "PUT" or "PATCH" => "Update",
                "DELETE" => "Delete",
                _ => method
            };

            var (entityType, entityId, metadata) = ClassifyEndpoint(path, method, statusCode, durationMs);

            var entry = new AuditEntry(
                UserId: userId,
                Action: action,
                EntityType: entityType,
                EntityId: entityId,
                IpAddress: ipAddress,
                UserAgent: userAgent,
                CorrelationId: correlationId,
                Metadata: metadata);

            // FIX B27: Log at Error level when audit events are dropped (compliance risk)
            if (!auditChannel.Writer.TryWrite(entry))
            {
                logger.LogError("Audit channel is full; entry dropped for {Method} {Path}. Consider scaling audit consumer.", method, path);
            }
        }
    }

    private static bool ShouldSkipAudit(string path)
    {
        foreach (var skip in SkipPaths)
        {
            if (path.StartsWith(skip, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    /// <summary>
    /// Classifica o endpoint para determinar tipo de entidade, ID e detalhes.
    /// </summary>
    private static (string entityType, Guid? entityId, Dictionary<string, object?>? metadata) ClassifyEndpoint(string path, string method, int statusCode, long durationMs)
    {
        var lowerPath = path.ToLowerInvariant();

        // Metadados básicos
        var metadata = new Dictionary<string, object?>
        {
            ["endpoint"] = $"{method} {path}",
            ["method"] = method,
            ["status_code"] = statusCode,
            ["duration_ms"] = durationMs
        };

        // Endpoints sensíveis com detalhes extras
        foreach (var prefix in SensitivePathPrefixes)
        {
            if (!lowerPath.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                continue;

            var entityType = prefix switch
            {
                "/api/requests" => "Request",
                "/api/certificates" => "Certificate",
                "/api/verify" => "Verification",
                _ => "Unknown"
            };

            // Tentar extrair ID da URL (ex: /api/requests/123abc)
            Guid? entityId = null;
            var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length >= 3)
            {
                var potentialId = segments[2];
                if (Guid.TryParse(potentialId, out var parsedId))
                    entityId = parsedId;
            }

            metadata["sensitive"] = true;

            return (entityType, entityId, metadata);
        }

        // Endpoints não-sensíveis
        var generalEntityType = lowerPath switch
        {
            _ when lowerPath.StartsWith("/api/auth") => "Auth",
            _ when lowerPath.StartsWith("/api/doctors") => "DoctorProfile",
            _ when lowerPath.StartsWith("/api/notifications") => "Notification",
            _ when lowerPath.StartsWith("/api/video") => "Video",
            _ when lowerPath.StartsWith("/api/admin") => "Admin",
            _ when lowerPath.StartsWith("/api/health") => "Health",
            _ => "General"
        };

        return (generalEntityType, null, metadata);
    }
}
