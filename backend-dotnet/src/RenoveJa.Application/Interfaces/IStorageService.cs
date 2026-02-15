namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Resultado de upload de arquivo.
/// </summary>
public record StorageUploadResult(
    bool Success,
    string? Url,
    string? ErrorMessage);

/// <summary>
/// Serviço de armazenamento de arquivos (Supabase Storage, S3, etc).
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
    /// Faz upload de imagem de receita/prescrição via stream.
    /// Retorna a URL pública do arquivo.
    /// </summary>
    Task<string> UploadPrescriptionImageAsync(
        Stream content,
        string fileName,
        string contentType,
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Baixa imagem a partir de URL pública do storage (ex.: Supabase).
    /// Extrai o path da URL e usa o endpoint autenticado para download.
    /// Retorna null se a URL não for do nosso storage ou o download falhar.
    /// </summary>
    Task<byte[]?> DownloadFromStorageUrlAsync(string publicUrl, CancellationToken cancellationToken = default);
}
