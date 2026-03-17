namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Sincroniza gravação da consulta do Daily.co para o S3 quando o webhook falhar.
/// Fallback: lista gravações da sala, baixa a primeira "finished", sobe para S3 e salva URL.
/// </summary>
public interface IRecordingSyncService
{
    /// <summary>
    /// Tenta sincronizar a gravação da consulta do Daily para S3.
    /// Retorna true se salvou; false se já existia, não há gravação ou falhou.
    /// </summary>
    Task<bool> TrySyncRecordingAsync(Guid requestId, CancellationToken cancellationToken = default);
}
