using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Application.Services;

/// <summary>
/// Implementação de tokens temporários para acesso a documentos via URL.
/// Token = base64url(requestId:exp).base64url(HMAC-SHA256)
/// </summary>
public class DocumentTokenService(IOptions<ApiConfig> apiConfig) : IDocumentTokenService
{
    private readonly string _secret = (apiConfig?.Value?.DocumentTokenSecret ?? "").Trim();

    public string? GenerateDocumentToken(Guid requestId, int validMinutes = 15)
    {
        if (string.IsNullOrEmpty(_secret))
            return null;

        var exp = DateTimeOffset.UtcNow.AddMinutes(validMinutes).ToUnixTimeSeconds();
        var payload = $"{requestId}:{exp}";
        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var payloadB64 = Convert.ToBase64String(payloadBytes)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadB64));
        var sig = Convert.ToBase64String(hash)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');

        return $"{payloadB64}.{sig}";
    }

    public bool ValidateDocumentToken(string? token, Guid requestId)
    {
        if (string.IsNullOrEmpty(_secret) || string.IsNullOrWhiteSpace(token))
            return false;

        var parts = token.Trim().Split('.');
        if (parts.Length != 2)
            return false;

        var payloadB64 = parts[0].Replace('-', '+').Replace('_', '/');
        var pad = payloadB64.Length % 4;
        if (pad > 0) payloadB64 += new string('=', 4 - pad);

        byte[] payloadBytes;
        try
        {
            payloadBytes = Convert.FromBase64String(payloadB64);
        }
        catch
        {
            return false;
        }

        var payload = Encoding.UTF8.GetString(payloadBytes);
        var sep = payload.IndexOf(':');
        if (sep <= 0)
            return false;

        if (!Guid.TryParse(payload[..sep], out var tid) || tid != requestId)
            return false;

        if (!long.TryParse(payload[(sep + 1)..], out var exp) || DateTimeOffset.UtcNow.ToUnixTimeSeconds() > exp)
            return false;

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secret));
        var expectedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(parts[0]));
        var expectedSig = Convert.ToBase64String(expectedHash)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');

        return parts[1].Length == expectedSig.Length &&
               CryptographicOperations.FixedTimeEquals(
                   Encoding.UTF8.GetBytes(parts[1]).AsSpan(),
                   Encoding.UTF8.GetBytes(expectedSig).AsSpan());
    }
}
