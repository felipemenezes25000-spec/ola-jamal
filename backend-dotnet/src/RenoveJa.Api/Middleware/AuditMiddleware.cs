using System.Diagnostics;
using System.Security.Claims;
using Microsoft.Extensions.DependencyInjection;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Api.Middleware;

/// <summary>
/// Middleware de auditoria LGPD.
/// Intercepta todas as requests e registra endpoint, método, userId, IP, user-agent, status code e duração.
/// Para endpoints sensíveis (dados de saúde), adiciona detalhes extras.
/// Execução assíncrona (fire-and-forget) para não bloquear a resposta.
/// NÃO registra body de request (pode conter dados sensíveis).
/// </summary>
public class AuditMiddleware(
    RequestDelegate next,
    ILogger<AuditMiddleware> logger)
{
    /// <summary>
    /// Endpoints sensíveis que acessam dados de saúde.
    /// </summary>
    private static readonly string[] SensitivePathPrefixes =
    [
        "/api/requests",
        "/api/certificates",
        "/api/verify",
        "/api/payments"
    ];

    public async Task InvokeAsync(HttpContext context, IAuditService auditService)
    {
        var stopwatch = Stopwatch.StartNew();

        await next(context);

        stopwatch.Stop();

        // Capturar TUDO do context antes que ele seja disposed
        var path = context.Request.Path.Value ?? "";
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

        // Criar novo scope para o fire-and-forget (o scope da request será disposed)
        var serviceScopeFactory = context.RequestServices.GetRequiredService<IServiceScopeFactory>();

        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = serviceScopeFactory.CreateScope();
                var scopedAuditService = scope.ServiceProvider.GetRequiredService<IAuditService>();
                await LogRequestCapturedAsync(scopedAuditService, path, method, statusCode, ipAddress, userAgent, correlationId, userId, durationMs);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Falha no fire-and-forget do audit log");
            }
        });
    }

    private static async Task LogRequestCapturedAsync(
        IAuditService auditService, string path, string method, int statusCode,
        string? ipAddress, string? userAgent, string? correlationId, Guid? userId, long durationMs)
    {
        var action = method switch
        {
            "GET" => "Read",
            "POST" => "Create",
            "PUT" or "PATCH" => "Update",
            "DELETE" => "Delete",
            _ => method
        };

        // Determinar tipo de entidade e detalhes extras para endpoints sensíveis
        var (entityType, entityId, metadata) = ClassifyEndpoint(path, method, statusCode, durationMs);

        await auditService.LogAsync(
            userId: userId,
            action: action,
            entityType: entityType,
            entityId: entityId,
            ipAddress: ipAddress,
            userAgent: userAgent,
            correlationId: correlationId,
            metadata: metadata);
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
                "/api/payments" => "Payment",
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
