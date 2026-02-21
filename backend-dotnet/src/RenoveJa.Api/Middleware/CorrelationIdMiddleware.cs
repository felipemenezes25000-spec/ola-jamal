using Serilog.Context;

namespace RenoveJa.Api.Middleware;

/// <summary>
/// Middleware que propaga ou gera um ID de correlação por requisição para rastreamento.
/// O correlationId é:
///   - Lido do header X-Correlation-Id enviado pelo cliente (mobile/web) se presente.
///   - Gerado como novo GUID caso o cliente não envie.
/// Enriquece o LogContext do Serilog para que TODOS os logs da requisição incluam
/// a propriedade {CorrelationId}, facilitando o rastreamento ponta-a-ponta.
/// </summary>
public class CorrelationIdMiddleware(RequestDelegate next)
{
    public const string CorrelationIdHeader = "X-Correlation-Id";

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[CorrelationIdHeader].FirstOrDefault()
                            ?? Guid.NewGuid().ToString("N")[..16];

        context.Items["CorrelationId"] = correlationId;
        context.Response.Headers[CorrelationIdHeader] = correlationId;

        // Enriquece todos os logs Serilog desta requisição com CorrelationId
        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await next(context);
        }
    }
}
