namespace RenoveJa.Application.Services;

/// <summary>
/// Codifica GUID para Base64Url (22 caracteres) — URL-safe, sem padding.
/// Usado no QR Code e texto do PDF (ex: re.renoveja.com.br/XXXXX).
/// </summary>
public static class ShortUrlEncoder
{
    /// <summary>
    /// Codifica GUID para string de 22 caracteres (Base64Url).
    /// </summary>
    public static string Encode(Guid id)
    {
        var bytes = id.ToByteArray();
        var base64 = Convert.ToBase64String(bytes);
        return base64[..22].Replace("+", "-").Replace("/", "_");
    }

    /// <summary>
    /// Decodifica Base64Url de 22 caracteres para GUID.
    /// </summary>
    public static Guid? Decode(string encoded)
    {
        if (string.IsNullOrWhiteSpace(encoded) || encoded.Length != 22)
            return null;

        try
        {
            var base64 = encoded.Replace("-", "+").Replace("_", "/") + "==";
            var bytes = Convert.FromBase64String(base64);
            return bytes.Length == 16 ? new Guid(bytes) : null;
        }
        catch
        {
            return null;
        }
    }
}
