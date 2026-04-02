namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Store em memória do estado da sessão de consulta (transcrição + anamnese + sugestões) por requestId.
/// Usado durante a chamada; ao encerrar (FinishConsultation) os dados são persistidos e removidos do store.
/// </summary>
public interface IConsultationSessionStore
{
    /// <summary>Garante que existe uma sessão para o requestId (paciente). Chamar ao iniciar a captura de áudio.</summary>
    void EnsureSession(Guid requestId, Guid patientId);

    /// <summary>Armazena o tipo de consulta (psicologo | medico_clinico) na sessão.</summary>
    void SetConsultationType(Guid requestId, string? consultationType);

    /// <summary>Obtém o tipo de consulta da sessão.</summary>
    string? GetConsultationType(Guid requestId);

    /// <summary>Acumula texto transcrito na sessão. startTimeSeconds opcional (Deepgram/Daily).</summary>
    void AppendTranscript(Guid requestId, string text, double? startTimeSeconds = null);

    /// <summary>Atualiza anamnese, sugestões e evidências (artigos científicos) na sessão.</summary>
    void UpdateAnamnesis(Guid requestId, string? anamnesisJson, string? suggestionsJson, string? evidenceJson = null);

    /// <summary>Obtém o transcript acumulado (somente leitura).</summary>
    string GetTranscript(Guid requestId);

    /// <summary>Obtém o último estado de anamnese/sugestões (para passar ao próximo passo da IA).</summary>
    (string? AnamnesisJson, string? SuggestionsJson) GetAnamnesisState(Guid requestId);

    /// <summary>Obtém evidências clínicas armazenadas na sessão.</summary>
    string? GetEvidenceJson(Guid requestId);

    /// <summary>Remove a sessão e retorna os dados para persistência. Retorna null se não houver sessão.</summary>
    ConsultationSessionData? GetAndRemove(Guid requestId);
}

/// <summary>Segmento de transcrição com timestamp (para .txt formatado).</summary>
/// <param name="StartTimeSeconds">Segundos desde início da transcrição (Deepgram/Daily), quando disponível.</param>
public record TranscriptSegment(string Speaker, string Text, DateTime ReceivedAtUtc, double? StartTimeSeconds = null);

/// <summary>Dados da sessão ao encerrar a consulta.</summary>
/// <param name="EvidenceJson">JSON com artigos científicos (biblioteca, url, título, relevância) que apoiam o CID sugerido.</param>
public record ConsultationSessionData(
    Guid RequestId,
    Guid PatientId,
    string? TranscriptText,
    IReadOnlyList<TranscriptSegment>? TranscriptSegments,
    string? AnamnesisJson,
    string? AiSuggestionsJson,
    string? EvidenceJson = null);
