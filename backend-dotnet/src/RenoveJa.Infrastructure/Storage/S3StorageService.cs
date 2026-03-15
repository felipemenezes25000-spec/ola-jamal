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
        if (path.StartsWith("certificates/", StringComparison.OrdinalIgnoreCase))
            return _config.CertificatesBucket;
        if (path.StartsWith("receitas/", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("signed/", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("prescription-images/", StringComparison.OrdinalIgnoreCase))
            return _config.PrescriptionsBucket;
        if (path.StartsWith("transcripts/", StringComparison.OrdinalIgnoreCase))
            return _config.TranscriptsBucket;
        if (path.StartsWith("avatars/", StringComparison.OrdinalIgnoreCase))
            return _config.AvatarsBucket;
        return _config.PrescriptionsBucket;
    }

    private static string CleanPath(string path)
    {
        // Remove bucket prefix if present
        var prefixes = new[] { "certificates/", "prescription-images/", "avatars/", "transcripts/", "receitas/", "signed/" };
        foreach (var prefix in prefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return path; // Keep as-is, S3 uses full key
        }
        return path;
    }

    public async Task<StorageUploadResult> UploadAsync(string path, byte[] data, string contentType, CancellationToken cancellationToken = default)
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
            return new StorageUploadResult(false, null, ex.Message);
        }
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
        catch
        {
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

    public async Task<string> UploadPrescriptionImageAsync(Stream content, string fileName, string contentType, Guid userId, CancellationToken cancellationToken = default)
    {
        var key = $"prescription-images/{userId}/{Guid.NewGuid()}/{fileName}";
        using var ms = new MemoryStream();
        await content.CopyToAsync(ms, cancellationToken);

        var result = await UploadAsync(key, ms.ToArray(), contentType, cancellationToken);
        if (!result.Success)
            throw new InvalidOperationException($"Upload failed: {result.ErrorMessage}");

        return result.Url!;
    }

    public async Task<string> UploadAvatarAsync(Stream content, string fileName, string contentType, Guid userId, CancellationToken cancellationToken = default)
    {
        var key = $"avatars/{userId}/{fileName}";
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

    public async Task<string?> CreateSignedUrlAsync(string path, int expiresInSeconds, CancellationToken cancellationToken = default)
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

            return await Task.FromResult(_s3.GetPreSignedURL(request));
        }
        catch
        {
            return null;
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

        // Supabase URL fallback (for legacy data)
        if (url.Contains("supabase.co/storage/"))
        {
            var idx = url.IndexOf("/object/public/");
            if (idx >= 0) return url[(idx + "/object/public/".Length)..];
            idx = url.IndexOf("/object/sign/");
            if (idx >= 0)
            {
                var path = url[(idx + "/object/sign/".Length)..];
                var qIdx = path.IndexOf('?');
                return qIdx >= 0 ? path[..qIdx] : path;
            }
        }

        return null;
    }
}
