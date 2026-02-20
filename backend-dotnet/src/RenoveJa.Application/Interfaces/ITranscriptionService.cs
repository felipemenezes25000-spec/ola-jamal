namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de transcrição de áudio (Speech-to-Text) para consultas por vídeo.
/// Utiliza Whisper (OpenAI) para converter áudio do paciente em texto.
/// </summary>
public interface ITranscriptionService
{
    /// <summary>
    /// Transcreve um chunk de áudio para texto.
    /// </summary>
    /// <param name="audioBytes">Bytes do áudio (ex.: webm, mp3, m4a). Whisper aceita vários formatos.</param>
    /// <param name="fileName">Nome do arquivo para hint de formato (ex.: "chunk.webm"). Opcional.</param>
    /// <param name="cancellationToken">Cancelamento.</param>
    /// <returns>Texto transcrito ou null se API não configurada/falha.</returns>
    Task<string?> TranscribeAsync(
        byte[] audioBytes,
        string? fileName = null,
        CancellationToken cancellationToken = default);
}
