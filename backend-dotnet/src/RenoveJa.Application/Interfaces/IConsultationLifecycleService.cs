using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.DTOs.Video;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Ciclo de vida de consultas: aceitar, iniciar, reportar chamada conectada, finalizar e transcrição.
/// </summary>
public interface IConsultationLifecycleService
{
    Task<(RequestResponseDto Request, VideoRoomResponseDto VideoRoom)> AcceptConsultationAsync(
        Guid id, Guid doctorId, CancellationToken cancellationToken = default);

    Task<RequestResponseDto> StartConsultationAsync(
        Guid id, Guid doctorId, CancellationToken cancellationToken = default);

    Task<RequestResponseDto> ReportCallConnectedAsync(
        Guid id, Guid userId, CancellationToken cancellationToken = default);

    Task<RequestResponseDto> FinishConsultationAsync(
        Guid id, Guid doctorId, FinishConsultationDto? dto, CancellationToken cancellationToken = default);

    Task<RequestResponseDto> AutoFinishConsultationAsync(
        Guid id, Guid userId, CancellationToken cancellationToken = default);

    Task<string?> GetTranscriptDownloadUrlAsync(
        Guid id, Guid userId, int expiresInSeconds = 3600, CancellationToken cancellationToken = default);

    /// <summary>Retorna signed URL para reprodução da gravação de vídeo da consulta (bucket privado). Médico ou paciente da consulta.</summary>
    Task<string?> GetRecordingDownloadUrlAsync(
        Guid id, Guid userId, int expiresInSeconds = 3600, CancellationToken cancellationToken = default);

}
