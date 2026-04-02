namespace RenoveJa.Api.Helpers;

public static class FileSignatureValidator
{
    // HEIC/HEIF use 'ftyp' at offset 4 and require special handling (not a simple prefix match)
    private static readonly HashSet<string> HeicContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/heic", "image/heif"
    };

    private static readonly byte[] FtypSignature = { 0x66, 0x74, 0x79, 0x70 }; // "ftyp"

    private static readonly Dictionary<string, byte[][]> Signatures = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = [new byte[] { 0xFF, 0xD8, 0xFF }],
        ["image/png"] = [new byte[] { 0x89, 0x50, 0x4E, 0x47 }],
        ["image/webp"] = [new byte[] { 0x52, 0x49, 0x46, 0x46 }],
        ["application/pdf"] = [new byte[] { 0x25, 0x50, 0x44, 0x46 }],
    };

    public static async Task<bool> HasValidSignatureAsync(Stream stream, string contentType)
    {
        var originalPosition = stream.CanSeek ? stream.Position : -1;

        try
        {
            // HEIC/HEIF: check for 'ftyp' at byte offset 4
            if (HeicContentTypes.Contains(contentType))
            {
                var header = new byte[8];
                var bytesRead = await stream.ReadAsync(header.AsMemory(0, 8));
                if (bytesRead < 8)
                    return false;

                return header.AsSpan(4, 4).SequenceEqual(FtypSignature);
            }

            if (!Signatures.TryGetValue(contentType, out var expectedSignatures))
                return false; // Reject unknown content types by default

            var maxLen = expectedSignatures.Max(s => s.Length);
            var buf = new byte[maxLen];

            var read = await stream.ReadAsync(buf.AsMemory(0, maxLen));

            if (read < expectedSignatures.Min(s => s.Length))
                return false;

            return expectedSignatures.Any(sig =>
                read >= sig.Length && buf.AsSpan(0, sig.Length).SequenceEqual(sig));
        }
        finally
        {
            if (stream.CanSeek && originalPosition >= 0)
                stream.Position = originalPosition;
        }
    }
}
