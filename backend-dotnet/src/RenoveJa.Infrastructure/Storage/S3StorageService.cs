using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Helpers;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.Storage;

/// <summary>
/// Implementação de <see cref="IStorageService"/> usando AWS S3.
///
/// Roteamento de bucket:
///   O path S3 determina qual bucket usar via <see cref="GetBucket"/>.
///   Novos uploads DEVEM usar <see cref="StoragePaths"/> para gerar paths auditáveis.
///
/// Retry:
///   Upload usa retry exponencial (4 tentativas, backoff 500ms/1s/2s/4s).
///   Download, delete e demais operações propagam exceções.
/// </summary>
public sealed class S3StorageService(
    IAmazonS3 s3,
    IOptions<S3StorageConfig> config,
    ILogger<S3StorageService> logger) : IStorageService
{
    private readonly S3StorageConfig _config = config.Value;

    // ══════════════════════════════════════════════════════════════
    //  UPLOAD
    // ══════════════════════════════════════════════════════════════

    public async Task<StorageUploadResult> UploadAsync(
        string path, byte[] data, string contentType,
        CancellationToken cancellationToken = default)
    {
        const int maxAttempts = 4;
        const int baseDelayMs = 500;
        Exception? lastEx = null;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                var bucket = GetBucket(path);
                var key = CleanPath(path);

                await s3.PutObjectAsync(new PutObjectRequest
                {
                    BucketName = bucket,
                    Key = key,
                    InputStream = new MemoryStream(data),
                    ContentType = contentType
                }, cancellationToken);

                return new StorageUploadResult(true, GetPublicUrl(path), null);
            }
            catch (Exception ex)
            {
                lastEx = ex;
                if (attempt < maxAttempts)
                {
                    logger.LogWarning(ex,
                        "[S3] Upload attempt {Attempt}/{Max} failed for {Path}",
                        attempt, maxAttempts, path);
                    await Task.Delay(baseDelayMs * (1 << (attempt - 1)), cancellationToken);
                }
            }
        }

        logger.LogError(lastEx, "[S3] Upload failed after {Max} attempts for {Path}", maxAttempts, path);
        return new StorageUploadResult(false, null, lastEx?.Message ?? "Upload falhou após retries");
    }

    /// <summary>
    /// Upload via Stream — bufferiza para permitir retry.
    /// Para arquivos &gt;50MB, considerar TransferUtility com multipart.
    /// </summary>
    public async Task<StorageUploadResult> UploadStreamAsync(
        string path, Stream data, string contentType,
        CancellationToken cancellationToken = default)
    {
        using var ms = new MemoryStream();
        await data.CopyToAsync(ms, cancellationToken);
        return await UploadAsync(path, ms.ToArray(), contentType, cancellationToken);
    }

    // ══════════════════════════════════════════════════════════════
    //  DOWNLOAD
    // ══════════════════════════════════════════════════════════════

    public async Task<byte[]?> DownloadAsync(
        string path, CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucket(path);
            var key = CleanPath(path);

            var response = await s3.GetObjectAsync(bucket, key, cancellationToken);
            using var ms = new MemoryStream();
            await response.ResponseStream.CopyToAsync(ms, cancellationToken);
            return ms.ToArray();
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            logger.LogDebug("[S3] Object not found: {Path}", path);
            return null;
        }
    }

    public async Task<byte[]?> DownloadFromStorageUrlAsync(
        string publicUrl, CancellationToken cancellationToken = default)
    {
        var path = ExtractPathFromStorageUrl(publicUrl);
        if (path == null) return null;
        return await DownloadAsync(path, cancellationToken);
    }

    // ══════════════════════════════════════════════════════════════
    //  DELETE / EXISTS
    // ══════════════════════════════════════════════════════════════

    public async Task<bool> DeleteAsync(
        string path, CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucket(path);
            var key = CleanPath(path);
            await s3.DeleteObjectAsync(bucket, key, cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[S3] DeleteAsync failed for {Path}", path);
            return false;
        }
    }

    public async Task<bool> ExistsAsync(
        string path, CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucket(path);
            var key = CleanPath(path);
            await s3.GetObjectMetadataAsync(bucket, key, cancellationToken);
            return true;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  URLS
    // ══════════════════════════════════════════════════════════════

    public string GetPublicUrl(string path)
    {
        var bucket = GetBucket(path);
        var key = CleanPath(path);

        if (!string.IsNullOrWhiteSpace(_config.PublicBaseUrl))
            return $"{_config.PublicBaseUrl.TrimEnd('/')}/{key}";

        return $"https://{bucket}.s3.{_config.Region}.amazonaws.com/{key}";
    }

    public Task<string?> CreateSignedUrlAsync(
        string path, int expiresInSeconds,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucket(path);
            var key = CleanPath(path);

            var url = s3.GetPreSignedURL(new GetPreSignedUrlRequest
            {
                BucketName = bucket,
                Key = key,
                Expires = DateTime.UtcNow.AddSeconds(expiresInSeconds)
            });

            return Task.FromResult<string?>(url);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[S3] CreateSignedUrlAsync failed for {Path}", path);
            return Task.FromResult<string?>(null);
        }
    }

    public string? ExtractPathFromStorageUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;

        // S3 URL: https://{bucket}.s3.{region}.amazonaws.com/{key}
        if (url.Contains(".s3.") && url.Contains(".amazonaws.com"))
        {
            var uri = new Uri(url);
            return uri.AbsolutePath.TrimStart('/');
        }

        // CloudFront URL
        if (!string.IsNullOrWhiteSpace(_config.PublicBaseUrl) &&
            url.StartsWith(_config.PublicBaseUrl, StringComparison.OrdinalIgnoreCase))
        {
            return url[_config.PublicBaseUrl.Length..].TrimStart('/');
        }

        return null;
    }

    // ══════════════════════════════════════════════════════════════
    //  CONVENIENCE — uploads tipados (imagem receita/exame, avatar)
    // ══════════════════════════════════════════════════════════════

    public async Task<string> UploadPrescriptionImageAsync(
        Stream content, string fileName, string contentType,
        Guid userId, CancellationToken cancellationToken = default)
    {
        return await UploadTypedStreamAsync(
            StoragePaths.PedidoAnexo(userId, "receita", Path.GetExtension(fileName).NullIfEmpty() ?? ".jpg"),
            content, contentType, cancellationToken);
    }

    public async Task<string> UploadExamImageAsync(
        Stream content, string fileName, string contentType,
        Guid userId, CancellationToken cancellationToken = default)
    {
        return await UploadTypedStreamAsync(
            StoragePaths.PedidoAnexo(userId, "exame", Path.GetExtension(fileName).NullIfEmpty() ?? ".jpg"),
            content, contentType, cancellationToken);
    }

    public async Task<string> UploadAvatarAsync(
        Stream content, string fileName, string contentType,
        Guid userId, CancellationToken cancellationToken = default)
    {
        return await UploadTypedStreamAsync(
            StoragePaths.Avatar(userId, fileName),
            content, contentType, cancellationToken);
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNOS
    // ══════════════════════════════════════════════════════════════

    /// <summary>
    /// Upload genérico a partir de Stream — bufferiza, faz upload, retorna URL.
    /// Lança <see cref="InvalidOperationException"/> se falhar.
    /// </summary>
    private async Task<string> UploadTypedStreamAsync(
        string key, Stream content, string contentType,
        CancellationToken ct)
    {
        using var ms = new MemoryStream();
        await content.CopyToAsync(ms, ct);

        var result = await UploadAsync(key, ms.ToArray(), contentType, ct);
        if (!result.Success)
            throw new InvalidOperationException($"Upload failed for {key}: {result.ErrorMessage}");

        return result.Url!;
    }

    /// <summary>
    /// Determina o bucket S3 a partir do path.
    ///
    /// Hierarquia de roteamento:
    ///   1. Padrão auditável:  pacientes/{id}/documentos|pedidos → prescriptions
    ///                         pacientes/{id}/consultas          → transcripts
    ///                         pacientes/{id}/certificados       → certificates
    ///                         pacientes/{id}/avatar             → avatars
    ///   2. Intermediário:     pedidos/, documentos/, planos-de-cuidado/ → prescriptions
    ///                         consultas/                               → transcripts
    ///                         usuarios/{id}/certificados/              → certificates
    ///                         usuarios/                                → avatars
    ///   3. Legado (read-only): certificates/ → certificates
    ///                          receitas/, signed/, prescription-images/, careplans/ → prescriptions
    ///                          transcripts/, recordings/ → transcripts
    ///                          avatars/ → avatars
    /// </summary>
    private string GetBucket(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return _config.PrescriptionsBucket;
        var p = path.TrimStart('/');

        // ── 1. Padrão auditável: pacientes/{id}/... ──
        if (p.StartsWith("pacientes/", StringComparison.OrdinalIgnoreCase))
        {
            if (p.Contains("/consultas/", StringComparison.OrdinalIgnoreCase))
                return _config.TranscriptsBucket;
            if (p.Contains("/certificados/", StringComparison.OrdinalIgnoreCase))
                return _config.CertificatesBucket;
            if (p.Contains("/avatar/", StringComparison.OrdinalIgnoreCase))
                return _config.AvatarsBucket;
            return _config.PrescriptionsBucket;
        }

        // ── 2. Intermediário ──
        if (p.StartsWith("pedidos/", StringComparison.OrdinalIgnoreCase) ||
            p.StartsWith("planos-de-cuidado/", StringComparison.OrdinalIgnoreCase) ||
            p.StartsWith("documentos/", StringComparison.OrdinalIgnoreCase))
            return _config.PrescriptionsBucket;
        if (p.StartsWith("consultas/", StringComparison.OrdinalIgnoreCase))
            return _config.TranscriptsBucket;
        if (p.StartsWith("usuarios/", StringComparison.OrdinalIgnoreCase))
        {
            if (p.Contains("/certificados/", StringComparison.OrdinalIgnoreCase))
                return _config.CertificatesBucket;
            return _config.AvatarsBucket;
        }

        // ── 3. Legado (apenas leitura) ──
        if (p.StartsWith("certificates/", StringComparison.OrdinalIgnoreCase))
            return _config.CertificatesBucket;
        if (p.StartsWith("receitas/", StringComparison.OrdinalIgnoreCase) ||
            p.StartsWith("signed/", StringComparison.OrdinalIgnoreCase) ||
            p.StartsWith("prescription-images/", StringComparison.OrdinalIgnoreCase) ||
            p.StartsWith("careplans/", StringComparison.OrdinalIgnoreCase))
            return _config.PrescriptionsBucket;
        if (p.StartsWith("transcripts/", StringComparison.OrdinalIgnoreCase) ||
            p.StartsWith("recordings/", StringComparison.OrdinalIgnoreCase))
            return _config.TranscriptsBucket;
        if (p.StartsWith("avatars/", StringComparison.OrdinalIgnoreCase))
            return _config.AvatarsBucket;

        return _config.PrescriptionsBucket;
    }

    /// <summary>Normaliza o path removendo barra inicial, sem alterar prefixos reconhecidos.</summary>
    private static string CleanPath(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return path;
        return path.TrimStart('/');
    }
}

/// <summary>Extension para string vazia → null.</summary>
internal static class StringExtensions
{
    public static string? NullIfEmpty(this string? s)
        => string.IsNullOrEmpty(s) ? null : s;
}
