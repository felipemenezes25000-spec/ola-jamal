namespace RenoveJa.Api.Middleware;

/// <summary>
/// For SignalR connections, WebSocket clients often cannot set the Authorization header.
/// This middleware copies access_token from the query string to the Authorization header
/// so that the existing Bearer authentication works for /hubs/* requests.
/// </summary>
public class SignalRTokenMiddleware
{
    private const string AccessTokenQueryKey = "access_token";
    private readonly RequestDelegate _next;

    public SignalRTokenMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/hubs", StringComparison.OrdinalIgnoreCase) &&
            context.Request.Query.TryGetValue(AccessTokenQueryKey, out var token) &&
            !string.IsNullOrWhiteSpace(token))
        {
            if (!context.Request.Headers.ContainsKey("Authorization"))
            {
                context.Request.Headers.Authorization = $"Bearer {token}";
            }
        }

        await _next(context);
    }
}
