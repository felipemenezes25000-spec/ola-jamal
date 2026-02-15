namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Resultado da criação de sala de vídeo via Daily.co.
/// </summary>
public record DailyRoomResult(
    bool Success,
    string? RoomName,
    string? RoomUrl,
    string? ErrorMessage);

/// <summary>
/// Serviço de integração com Daily.co para teleconsultas.
/// </summary>
public interface IDailyVideoService
{
    /// <summary>
    /// Cria uma sala de vídeo no Daily.co.
    /// </summary>
    Task<DailyRoomResult> CreateRoomAsync(
        string roomName,
        int expirationMinutes = 60,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtém informações de uma sala existente.
    /// </summary>
    Task<DailyRoomResult> GetRoomAsync(
        string roomName,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deleta uma sala.
    /// </summary>
    Task<bool> DeleteRoomAsync(
        string roomName,
        CancellationToken cancellationToken = default);
}
