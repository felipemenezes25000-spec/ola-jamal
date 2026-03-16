namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Resultado de upload de arquivo.
/// </summary>
public record StorageUploadResult(
    bool Success,
    string? Url,
    string? ErrorMessage);

/// <summary>
/// Servico de armazenamento de arquivos (AWS S3).
/// </summary>
public interface IStorageService
{
    /// <summary>
    /// Faz upload de um arquivo.
    /// </summary>
    Task<StorageUploadResult> UploadAsync(
        string path,
        byte[] data,
        string contentType,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Faz upload de um arquivo via Stream (evita carregar tudo na memória — ideal para vídeos grandes).
    /// </summary>
    Task<StorageUploadResult> UploadStreamAsync(
        string path,
        Stream data,
        string contentType,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Faz download de um arquivo.
    /// </summary>
    Task<byte[]?> DownloadAsync(
        string path,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Remove um arquivo.
    /// </summary>
    Task<bool> DeleteAsync(
        string path,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Verifica se um arquivo existe.
    /// </summary>
    Task<bool> ExistsAsync(
        string path,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtém a URL pública de um arquivo.
    /// </summary>
    string GetPublicUrl(string path);

    /// <summary>
    /// Faz upload de imagem de receita via stream. Path: pedidos/receita/anexos/{userId}/...
    /// Retorna a URL pública do arquivo.
    /// </summary>
    Task<string> UploadPrescriptionImageAsync(
        Stream content,
        string fileName,
        string contentType,
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Faz upload de imagem de exame via stream. Path: pedidos/exame/anexos/{userId}/...
    /// Retorna a URL pública do arquivo.
    /// </summary>
    Task<string> UploadExamImageAsync(
        Stream content,
        string fileName,
        string contentType,
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Faz upload de avatar do usuário via stream.
    /// Retorna a URL pública do arquivo.
    /// </summary>
    Task<string> UploadAvatarAsync(
        Stream content,
        string fileName,
        string contentType,
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Baixa imagem a partir de URL publica do storage (S3/CloudFront).
    /// Extrai o path da URL e usa o endpoint autenticado para download.
    /// Retorna null se a URL não for do nosso storage ou o download falhar.
    /// </summary>
    Task<byte[]?> DownloadFromStorageUrlAsync(string publicUrl, CancellationToken cancellationToken = default);

    /// <summary>
    /// Cria uma signed URL para download temporário (buckets privados).
    /// Retorna null se falhar.
    /// </summary>
    Task<string?> CreateSignedUrlAsync(string path, int expiresInSeconds, CancellationToken cancellationToken = default);

    /// <summary>
    /// Extrai o path do objeto a partir de uma URL do storage (pública ou signed).
    /// Retorna null se não for do nosso storage.
    /// </summary>
    string? ExtractPathFromStorageUrl(string url);
}
