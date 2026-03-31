namespace RenoveJa.Api.Helpers;

public static class FileSignatureValidator
{
    private static readonly Dictionary<string, byte[][]> Signatures = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = [new byte[] { 0xFF, 0xD8, 0xFF }],
        ["image/png"] = [new byte[] { 0x89, 0x50, 0x4E, 0x47 }],
        ["image/webp"] = [new byte[] { 0x52, 0x49, 0x46, 0x46 }],
        ["image/heic"] = [new byte[] { 0x00, 0x00, 0x00 }],
        ["image/heif"] = [new byte[] { 0x00, 0x00, 0x00 }],
        ["application/pdf"] = [new byte[] { 0x25, 0x50, 0x44, 0x46 }],
    };

    public static async Task<bool> HasValidSignatureAsync(Stream stream, string contentType)
    {
        if (!Signatures.TryGetValue(contentType, out var expectedSignatures))
            return true;

        var maxLen = expectedSignatures.Max(s => s.Length);
        var header = new byte[maxLen];
        var originalPosition = stream.CanSeek ? stream.Position : -1;

        var bytesRead = await stream.ReadAsync(header.AsMemory(0, maxLen));

        if (stream.CanSeek && originalPosition >= 0)
            stream.Position = originalPosition;

        if (bytesRead < expectedSignatures.Min(s => s.Length))
            return false;

        return expectedSignatures.Any(sig =>
            bytesRead >= sig.Length && header.AsSpan(0, sig.Length).SequenceEqual(sig));
    }
}
