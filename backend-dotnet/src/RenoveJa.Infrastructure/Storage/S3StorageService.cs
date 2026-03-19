using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.Storage;

/// <summary>
/// Configuração do S3 Storage.
/// </summary>
public class S3StorageConfig
{
    public string Region { get; set; } = "sa-east-1";
    public string PrescriptionsBucket { get; set; } = "renoveja-prescriptions";
    public string CertificatesBucket { get; set; } = "renoveja-certificates";
    public string AvatarsBucket { get; set; } = "renoveja-avatars";
    public string TranscriptsBucket { get; set; } = "renoveja-transcripts";
    /// <summary>URL base do CloudFront ou S3 para URLs públicas.</summary>
    public string PublicBaseUrl { get; set; } = "";
}

/// <summary>
/// Implementação de IStorageService usando AWS S3.
/// </summary>
public class S3StorageService : IStorageService
{
    private readonly IAmazonS3 _s3;
    private readonly S3StorageConfig _config;

    public S3StorageService(IAmazonS3 s3, IOptions<S3StorageConfig> config)
    {
        _s3 = s3;
        _config = config.Value;
    }

    private string GetBucket(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return _config.PrescriptionsBucket;
        var p = path.TrimStart('/');

        // Novo padrão: pacientes/{id}/consultas/... → transcripts, pacientes/{id}/certificados/... → certificates, etc.
        if (p.StartsWith("pacientes/", StringComparison.OrdinalIgnoreCase))
        {
            if (p.Contains("/consultas/", StringComparison.OrdinalIgnoreCase))
                return _config.TranscriptsBucket;
            if (p.Contains("/certificados/", StringComparison.OrdinalIgnoreCase))
                return _config.CertificatesBucket;
            if (p.Contains("/avatar/", StringComparison.OrdinalIgnoreCase))
                return _config.AvatarsBucket;
            // pedidos, planos-de-cuidado, etc.
            return _config.PrescriptionsBucket;
        }

        // Padrão intermediário
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

        // Legado
        if (p.StartsWith("certificates/", StringComparison.OrdinalIgnoreCase))
            return _config.CertificatesBucket;
        if (p.StartsWith("receitas/", StringComparison.OrdinalIgnoreCase) ||
            p.StartsWith("signed/", StringComparison.OrdinalIgnoreCase) ||
            p.StartsWith("prescription-images/", StringComparison.OrdinalIgnoreCase))
            return _config.PrescriptionsBucket;
        if (p.StartsWith("transcripts/", StringComparison.OrdinalIgnoreCase) ||
            p.StartsWith("recordings/", StringComparison.OrdinalIgnoreCase))
            return _config.TranscriptsBucket;
        if (p.StartsWith("avatars/", StringComparison.OrdinalIgnoreCase))
            return _config.AvatarsBucket;
        if (p.StartsWith("careplans/", StringComparison.OrdinalIgnoreCase))
            return _config.PrescriptionsBucket;
        return _config.PrescriptionsBucket;
    }

    private static string CleanPath(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return path;
        var p = path.TrimStart('/');
        foreach (var prefix in Application.Helpers.StoragePaths.AllPrefixes)
        {
            if (p.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return p;
        }
        return p;
    }

    public async Task<StorageUploadResult> UploadAsync(string path, byte[] data, string contentType, CancellationToken cancellationToken = default)
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

                var request = new PutObjectRequest
                {
                    BucketName = bucket,
                    Key = key,
                    InputStream = new MemoryStream(data),
                    ContentType = contentType
                };

                await _s3.PutObjectAsync(request, cancellationToken);
                var url = GetPublicUrl(path);
                return new StorageUploadResult(true, url, null);
            }
            catch (Exception ex)
            {
                lastEx = ex;
                if (attempt < maxAttempts)
                    await Task.Delay(baseDelayMs * (1 << (attempt - 1)), cancellationToken);
            }
        }

        return new StorageUploadResult(false, null, lastEx?.Message ?? "Upload falhou após retries");
    }

    /// <summary>
    /// Upload via Stream — bufferiza para permitir retry (4 tentativas com backoff).
    /// TODO(perf): Para arquivos grandes (>10MB), usar TransferUtility com multipart upload
    /// para evitar OutOfMemoryException em PDFs pesados ou gravações de consulta.
    /// </summary>
    public async Task<StorageUploadResult> UploadStreamAsync(string path, Stream data, string contentType, CancellationToken cancellationToken = default)
    {
        using var ms = new MemoryStream();
        await data.CopyToAsync(ms, cancellationToken);
        var bytes = ms.ToArray();
        return await UploadAsync(path, bytes, contentType, cancellationToken);
    }

    public async Task<byte[]?> DownloadAsync(string path, CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucket(path);
            var key = CleanPath(path);

            var response = await _s3.GetObjectAsync(bucket, key, cancellationToken);
            using var ms = new MemoryStream();
            await response.ResponseStream.CopyToAsync(ms, cancellationToken);
            return ms.ToArray();
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<bool> DeleteAsync(string path, CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucket(path);
            var key = CleanPath(path);
            await _s3.DeleteObjectAsync(bucket, key, cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            // Log para diagnóstico — falha silenciosa impede debug de problemas de permissão/config S3
            System.Diagnostics.Debug.WriteLine($"[S3] DeleteAsync failed for {path}: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> ExistsAsync(string path, CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucket(path);
            var key = CleanPath(path);
            await _s3.GetObjectMetadataAsync(bucket, key, cancellationToken);
            return true;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    public string GetPublicUrl(string path)
    {
        var bucket = GetBucket(path);
        var key = CleanPath(path);

        if (!string.IsNullOrWhiteSpace(_config.PublicBaseUrl))
            return $"{_config.PublicBaseUrl.TrimEnd('/')}/{key}";

        return $"https://{bucket}.s3.{_config.Region}.amazonaws.com/{key}";
    }

    /// <summary>Upload de imagem de receita ou exame. kind: "receita" ou "exame" (default receita). Path: pedidos/{kind}/anexos/{userId}/{timestamp}-{guid}.{ext}</summary>
    public async Task<string> UploadPrescriptionImageAsync(Stream content, string fileName, string contentType, Guid userId, CancellationToken cancellationToken = default)
    {
        return await UploadRequestImageAsync(content, fileName, contentType, userId, "receita", cancellationToken);
    }

    /// <summary>Upload de imagem de exame. Path: pedidos/exame/anexos/{userId}/{timestamp}-{guid}.{ext}</summary>
    public async Task<string> UploadExamImageAsync(Stream content, string fileName, string contentType, Guid userId, CancellationToken cancellationToken = default)
    {
        return await UploadRequestImageAsync(content, fileName, contentType, userId, "exame", cancellationToken);
    }

    private async Task<string> UploadRequestImageAsync(Stream content, string fileName, string contentType, Guid userId, string kind, CancellationToken cancellationToken = default)
    {
        var ext = Path.GetExtension(fileName);
        if (string.IsNullOrEmpty(ext)) ext = ".jpg";
        var key = Application.Helpers.StoragePaths.PedidoAnexo(userId, kind, ext);
        using var ms = new MemoryStream();
        await content.CopyToAsync(ms, cancellationToken);

        var result = await UploadAsync(key, ms.ToArray(), contentType, cancellationToken);
        if (!result.Success)
            throw new InvalidOperationException($"Upload failed: {result.ErrorMessage}");

        return result.Url!;
    }

    public async Task<string> UploadAvatarAsync(Stream content, string fileName, string contentType, Guid userId, CancellationToken cancellationToken = default)
    {
        var key = Application.Helpers.StoragePaths.Avatar(userId, fileName);
        using var ms = new MemoryStream();
        await content.CopyToAsync(ms, cancellationToken);

        var result = await UploadAsync(key, ms.ToArray(), contentType, cancellationToken);
        if (!result.Success)
            throw new InvalidOperationException($"Upload failed: {result.ErrorMessage}");

        return result.Url!;
    }

    public async Task<byte[]?> DownloadFromStorageUrlAsync(string publicUrl, CancellationToken cancellationToken = default)
    {
        var path = ExtractPathFromStorageUrl(publicUrl);
        if (path == null) return null;
        return await DownloadAsync(path, cancellationToken);
    }

    public Task<string?> CreateSignedUrlAsync(string path, int expiresInSeconds, CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucket(path);
            var key = CleanPath(path);

            var request = new GetPreSignedUrlRequest
            {
                BucketName = bucket,
                Key = key,
                Expires = DateTime.UtcNow.AddSeconds(expiresInSeconds)
            };

            // GetPreSignedURL é síncrono no AWS SDK — não precisamos de Task.FromResult
            return Task.FromResult<string?>(_s3.GetPreSignedURL(request));
        }
        catch
        {
            return Task.FromResult<string?>(null);
        }
    }

    public string? ExtractPathFromStorageUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;

        // S3 URL: https://bucket.s3.region.amazonaws.com/key
        if (url.Contains(".s3.") && url.Contains(".amazonaws.com"))
        {
            var uri = new Uri(url);
            return uri.AbsolutePath.TrimStart('/');
        }

        // CloudFront URL
        if (!string.IsNullOrWhiteSpace(_config.PublicBaseUrl) && url.StartsWith(_config.PublicBaseUrl))
        {
            return url[_config.PublicBaseUrl.Length..].TrimStart('/');
        }

        return null;
    }
}
