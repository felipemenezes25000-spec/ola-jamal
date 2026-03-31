using System.Net;
using System.Text.Json;
using FluentValidation;
using RenoveJa.Application.Exceptions;
using RenoveJa.Domain.Exceptions;
namespace RenoveJa.Api.Middleware;

/// <summary>
/// Middleware que captura exceções não tratadas e retorna respostas JSON padronizadas.
/// </summary>
public class ExceptionHandlingMiddleware(
    RequestDelegate next,
    ILogger<ExceptionHandlingMiddleware> logger)
{
    // IMPORTANT: usa mesma lógica do ASP.NET Core (ASPNETCORE_ENVIRONMENT).
    // Nunca confiar apenas na variável de ambiente em isolamento — padrão é Production se não definida.
    private static bool IsDevelopment() =>
        string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);
    /// <summary>
    /// Invoca o próximo middleware e trata exceções lançadas no pipeline.
    /// </summary>
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            var path = context.Request.Path.Value ?? "";
            var method = context.Request.Method;

            if (ex is OperationCanceledException)
            {
                logger.LogDebug("Request cancelled by client: {Method} {Path}", method, path);
                if (!context.Response.HasStarted)
                {
                    context.Response.StatusCode = 499;
                }
                return;
            }

            logger.LogError(ex,
                "[EXCEPTION] {Method} {Path} | {ExceptionType}: {Message} | Inner: {Inner}",
                method, path, ex.GetType().Name, ex.Message,
                ex.InnerException?.Message ?? "-");

            if (context.Response.HasStarted)
            {
                logger.LogWarning("Response already started; cannot write error body for {Method} {Path}", method, path);
                return;
            }

            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var requestId = context.Items.TryGetValue("CorrelationId", out var cid) && cid is string s
            ? s
            : context.TraceIdentifier;

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        if (exception is ValidationException ve)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
            var errors = ve.Errors.Select(e => e.ErrorMessage).ToList();
            var response = new
            {
                status = 400,
                message = errors.Count == 1 ? errors[0] : "Verifique os campos: " + string.Join("; ", errors),
                errors,
                requestId
            };
            return context.Response.WriteAsync(JsonSerializer.Serialize(response, jsonOptions));
        }

        if (exception is PrescriptionValidationException pve)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
            var response = new
            {
                status = 400,
                message = "Receita incompleta: verifique os campos obrigatórios.",
                missingFields = pve.MissingFields,
                messages = pve.Messages,
                requestId
            };
            return context.Response.WriteAsync(JsonSerializer.Serialize(response, jsonOptions));
        }

        if (exception is DuplicateRequestException dre)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.Conflict; // 409
            var response = new
            {
                status = 409,
                message = dre.Message,
                code = dre.Code,
                cooldownDays = dre.CooldownDays,
                requestId
            };
            return context.Response.WriteAsync(JsonSerializer.Serialize(response, jsonOptions));
        }

        // 502/503/504 do upstream: retornar 503 para o cliente poder exibir "tente novamente"
        if (exception is HttpRequestException && (
            exception.Message.Contains("502", StringComparison.OrdinalIgnoreCase) ||
            exception.Message.Contains("503", StringComparison.OrdinalIgnoreCase) ||
            exception.Message.Contains("504", StringComparison.OrdinalIgnoreCase)))
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.ServiceUnavailable;
            var response = new
            {
                status = 503,
                message = "Serviço temporariamente indisponível. Tente novamente em alguns instantes.",
                requestId
            };
            return context.Response.WriteAsync(JsonSerializer.Serialize(response, jsonOptions));
        }

        var (statusCode, message) = exception switch
        {
            AuthConflictException => (HttpStatusCode.Conflict, exception.Message),
            DomainException => (HttpStatusCode.BadRequest, exception.Message),
            UnauthorizedAccessException => (HttpStatusCode.Unauthorized,
                IsDevelopment() ? exception.Message : "Não autorizado."),
            // InvalidOperationException: em produção não expor exception.Message (pode vazar detalhes internos)
            InvalidOperationException => (HttpStatusCode.BadRequest,
                IsDevelopment() ? exception.Message : "Operação inválida. Verifique os dados e tente novamente."),
            KeyNotFoundException => (HttpStatusCode.NotFound, "Resource not found"),
            _ => (HttpStatusCode.InternalServerError,
                IsDevelopment() ? exception.Message : "Ocorreu um erro ao processar sua solicitação. Tente novamente.")
        };

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;

        var defaultResponse = new
        {
            status = (int)statusCode,
            message,
            requestId
        };

        return context.Response.WriteAsync(JsonSerializer.Serialize(defaultResponse, jsonOptions));
    }
}
