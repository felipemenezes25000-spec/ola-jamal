namespace RenoveJa.Api.Middleware;

/// <summary>
/// Middleware que propaga ou gera um ID de correlação por requisição para rastreamento.
/// </summary>
public class CorrelationIdMiddleware(RequestDelegate next)
{
    private const string CorrelationIdHeader = "X-Correlation-Id";

    /// <summary>
    /// Processa a requisição adicionando/propagando o header X-Correlation-Id.
    /// </summary>
    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[CorrelationIdHeader].FirstOrDefault()
                            ?? Guid.NewGuid().ToString();

        context.Items["CorrelationId"] = correlationId;
        context.Response.Headers[CorrelationIdHeader] = correlationId;

        await next(context);
    }
}
