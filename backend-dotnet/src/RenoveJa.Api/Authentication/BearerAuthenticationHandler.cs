using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Api.Authentication;

/// <summary>
/// Handler de autenticação Bearer que valida o token via IAuthService.
/// </summary>
public class BearerAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IAuthService authService) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    /// <summary>
    /// Nome do cookie HttpOnly que contém o token de autenticação (usado pelo frontend-web).
    /// O mobile continua usando o header Authorization: Bearer.
    /// </summary>
    public const string AuthCookieName = "auth_token";

    /// <summary>
    /// Valida o token Bearer (header ou cookie HttpOnly) e cria o principal de autenticação.
    /// Prioridade: cookie auth_token (web) → header Authorization: Bearer (mobile).
    /// </summary>
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // 1. Tentar ler do cookie HttpOnly (frontend-web)
        string? token = null;
        if (Request.Cookies.TryGetValue(AuthCookieName, out var cookieToken) && !string.IsNullOrWhiteSpace(cookieToken))
        {
            token = cookieToken.Trim();
        }

        // 2. Fallback: header Authorization: Bearer (mobile app)
        if (string.IsNullOrEmpty(token))
        {
            if (!Request.Headers.TryGetValue("Authorization", out var value))
                return AuthenticateResult.Fail("Missing Authorization Header");

            var authHeader = value.ToString();
            if (!authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                return AuthenticateResult.Fail("Invalid Authorization Header");

            token = authHeader["Bearer ".Length..].Trim();
        }

        try
        {
            var (userId, role) = await authService.ValidateTokenAsync(token);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Role, role)
            };

            var identity = new ClaimsIdentity(claims, Scheme.Name);
            var principal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(principal, Scheme.Name);

            return AuthenticateResult.Success(ticket);
        }
        catch (UnauthorizedAccessException)
        {
            return AuthenticateResult.Fail("Invalid or expired token");
        }
        catch (Exception)
        {
            return AuthenticateResult.Fail("Authentication error");
        }
    }
}
