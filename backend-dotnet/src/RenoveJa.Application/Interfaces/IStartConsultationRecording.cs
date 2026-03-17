namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Inicia gravação de vídeo da consulta no Daily.co.
/// Chamado ao iniciar a consulta para garantir que haja gravação mesmo se o token não iniciar.
/// </summary>
public interface IStartConsultationRecording
{
    /// <summary>Tenta iniciar gravação cloud na sala da consulta. Não lança exceção em falha.</summary>
    Task StartRecordingAsync(Guid requestId, CancellationToken ct = default);
}
