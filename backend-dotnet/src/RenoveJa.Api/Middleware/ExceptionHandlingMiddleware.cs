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
            logger.LogError(ex,
                "[EXCEPTION] {Method} {Path} | Tipo={ExceptionType} | Message={Message} | InnerException={Inner}",
                method, path, ex.GetType().Name, ex.Message,
                ex.InnerException?.Message ?? "-");
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        if (exception is ValidationException ve)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
            var errors = ve.Errors.Select(e => e.ErrorMessage).ToList();
            var response = new
            {
                status = 400,
                message = errors.Count == 1 ? errors[0] : "Verifique os campos: " + string.Join("; ", errors),
                errors
            };
            var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            return context.Response.WriteAsync(json);
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
                messages = pve.Messages
            };
            var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            return context.Response.WriteAsync(json);
        }

        var (statusCode, message) = exception switch
        {
            AuthConflictException => (HttpStatusCode.Conflict, exception.Message),
            DomainException => (HttpStatusCode.BadRequest, exception.Message),
            UnauthorizedAccessException => (HttpStatusCode.Unauthorized, exception.Message),
            InvalidOperationException => (HttpStatusCode.BadRequest, exception.Message),
            KeyNotFoundException => (HttpStatusCode.NotFound, "Resource not found"),
            _ => (HttpStatusCode.InternalServerError, "An error occurred while processing your request")
        };

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;

        var defaultResponse = new
        {
            status = (int)statusCode,
            message,
            details = context.Request.Path.Value
        };

        var jsonDefault = JsonSerializer.Serialize(defaultResponse, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        return context.Response.WriteAsync(jsonDefault);
    }
}
