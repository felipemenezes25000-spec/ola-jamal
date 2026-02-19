using System.Net;
using System.Text.Json;
<<<<<<< HEAD
using RenoveJa.Application.Exceptions;
=======
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
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
<<<<<<< HEAD
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

=======
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
        var (statusCode, message) = exception switch
        {
            DomainException => (HttpStatusCode.BadRequest, exception.Message),
            UnauthorizedAccessException => (HttpStatusCode.Unauthorized, exception.Message),
            InvalidOperationException => (HttpStatusCode.BadRequest, exception.Message),
            KeyNotFoundException => (HttpStatusCode.NotFound, "Resource not found"),
            _ => (HttpStatusCode.InternalServerError, "An error occurred while processing your request")
        };

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;

<<<<<<< HEAD
        var defaultResponse = new
=======
        var response = new
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
        {
            status = (int)statusCode,
            message,
            details = context.Request.Path.Value
        };

<<<<<<< HEAD
        var jsonDefault = JsonSerializer.Serialize(defaultResponse, new JsonSerializerOptions
=======
        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

<<<<<<< HEAD
        return context.Response.WriteAsync(jsonDefault);
=======
        return context.Response.WriteAsync(json);
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
    }
}
