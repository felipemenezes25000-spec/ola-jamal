using Microsoft.Extensions.Options;
using RenoveJa.Application.Interfaces;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Storage;

/// <summary>
/// Upload de arquivos para o Supabase Storage usando a API REST (service_role).
/// Implementa IStorageService completo.
/// </summary>
public class SupabaseStorageService : IStorageService
{
    public const string HttpClientName = "SupabaseStorage";
    private const string PrescriptionBucket = "prescription-images";
    private const string CertificatesBucket = "certificates";
    private const string VerifyPdfBucket = "prescriptions";

    private static string GetBucketForPath(string path)
    {
        if (path.StartsWith("certificates/", StringComparison.OrdinalIgnoreCase))
            return CertificatesBucket;
        // PDFs de receita e assinados vão para o bucket 'prescriptions' (usado pela Edge Function verify)
        if (path.StartsWith("receitas/", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("signed/", StringComparison.OrdinalIgnoreCase))
            return VerifyPdfBucket;
        return PrescriptionBucket;
    }
    private readonly HttpClient _httpClient;
    private readonly SupabaseConfig _config;

    public SupabaseStorageService(IHttpClientFactory httpClientFactory, IOptions<SupabaseConfig> config)
    {
        _config = config.Value;
        _httpClient = httpClientFactory.CreateClient(HttpClientName);
    }

    /// <summary>
    /// Faz upload de receita (mantém compatibilidade).
    /// </summary>
    public async Task<string> UploadPrescriptionImageAsync(
        Stream content,
        string fileName,
        string contentType,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var extension = Path.GetExtension(fileName);
        if (string.IsNullOrEmpty(extension))
            extension = ".jpg";
        var safeFileName = $"{Guid.NewGuid():N}{extension}";
        var objectPath = $"{userId}/{safeFileName}";

        var url = $"{_config.Url.TrimEnd('/')}/storage/v1/object/{PrescriptionBucket}/{objectPath}";

        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("apikey", _config.ServiceKey);
        request.Headers.Add("Authorization", $"Bearer {_config.ServiceKey}");
        request.Content = new StreamContent(content);
        request.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);

        var response = await _httpClient.SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            var hint = response.StatusCode == System.Net.HttpStatusCode.NotFound && body.Contains("Bucket not found", StringComparison.OrdinalIgnoreCase)
                ? " Crie o bucket no projeto Supabase que a API usa: Dashboard → SQL Editor → execute o arquivo docs/STORAGE_BUCKET.sql (ou crie o bucket 'prescription-images' em Storage). Confirme que Supabase:Url no appsettings é o mesmo projeto."
                : "";
            throw new InvalidOperationException(
                $"Storage upload failed: {response.StatusCode}. {body}.{hint}");
        }

        var publicUrl = $"{_config.Url.TrimEnd('/')}/storage/v1/object/public/{PrescriptionBucket}/{objectPath}";
        return publicUrl;
    }

    /// <inheritdoc />
    public async Task<StorageUploadResult> UploadAsync(
        string path,
        byte[] data,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucketForPath(path);
            var url = $"{_config.Url.TrimEnd('/')}/storage/v1/object/{bucket}/{path}";

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Add("apikey", _config.ServiceKey);
            request.Headers.Add("Authorization", $"Bearer {_config.ServiceKey}");
            request.Content = new ByteArrayContent(data);
            request.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);

            var response = await _httpClient.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                return new StorageUploadResult(false, null, $"Upload failed: {response.StatusCode}. {body}");
            }

            var publicUrl = GetPublicUrl(path);
            return new StorageUploadResult(true, publicUrl, null);
        }
        catch (Exception ex)
        {
            return new StorageUploadResult(false, null, $"Upload error: {ex.Message}");
        }
    }

    /// <inheritdoc />
    public async Task<byte[]?> DownloadAsync(
        string path,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucketForPath(path);
            var url = $"{_config.Url.TrimEnd('/')}/storage/v1/object/{bucket}/{path}";

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("apikey", _config.ServiceKey);
            request.Headers.Add("Authorization", $"Bearer {_config.ServiceKey}");

            var response = await _httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return null;

            return await response.Content.ReadAsByteArrayAsync(cancellationToken);
        }
        catch
        {
            return null;
        }
    }

    /// <inheritdoc />
    public async Task<bool> DeleteAsync(
        string path,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucketForPath(path);
            var url = $"{_config.Url.TrimEnd('/')}/storage/v1/object/{bucket}/{path}";

            using var request = new HttpRequestMessage(HttpMethod.Delete, url);
            request.Headers.Add("apikey", _config.ServiceKey);
            request.Headers.Add("Authorization", $"Bearer {_config.ServiceKey}");

            var response = await _httpClient.SendAsync(request, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    /// <inheritdoc />
    public async Task<bool> ExistsAsync(
        string path,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucketForPath(path);
            var url = $"{_config.Url.TrimEnd('/')}/storage/v1/object/{bucket}/{path}";

            using var request = new HttpRequestMessage(HttpMethod.Head, url);
            request.Headers.Add("apikey", _config.ServiceKey);
            request.Headers.Add("Authorization", $"Bearer {_config.ServiceKey}");

            var response = await _httpClient.SendAsync(request, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    /// <inheritdoc />
    public string GetPublicUrl(string path)
    {
        var bucket = GetBucketForPath(path);
        return $"{_config.Url.TrimEnd('/')}/storage/v1/object/public/{bucket}/{path}";
    }

    /// <inheritdoc />
    public async Task<byte[]?> DownloadFromStorageUrlAsync(string publicUrl, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(publicUrl)) return null;
        var path = ExtractPathFromPublicUrl(publicUrl);
        if (path == null) return null;
        return await DownloadAsync(path, cancellationToken);
    }

    /// <summary>
    /// Extrai o path do objeto a partir da URL pública (ex.: .../object/public/prescription-images/userId/file.jpg → userId/file.jpg).
    /// </summary>
    private string? ExtractPathFromPublicUrl(string publicUrl)
    {
        var baseUrl = _config.Url.TrimEnd('/');
        var suffix = $"/storage/v1/object/public/{PrescriptionBucket}/";
        if (!publicUrl.StartsWith(baseUrl, StringComparison.OrdinalIgnoreCase)) return null;
        var idx = publicUrl.IndexOf(suffix, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return null;
        return publicUrl[(idx + suffix.Length)..].Trim();
    }
}
