namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Store em memória do estado da sessão de consulta (transcrição + anamnese + sugestões) por requestId.
/// Usado durante a chamada; ao encerrar (FinishConsultation) os dados são persistidos e removidos do store.
/// </summary>
public interface IConsultationSessionStore
{
    /// <summary>Garante que existe uma sessão para o requestId (paciente). Chamar ao iniciar a captura de áudio.</summary>
    void EnsureSession(Guid requestId, Guid patientId);

    /// <summary>Acumula texto transcrito na sessão.</summary>
    void AppendTranscript(Guid requestId, string text);

    /// <summary>Atualiza anamnese e sugestões na sessão.</summary>
    void UpdateAnamnesis(Guid requestId, string? anamnesisJson, string? suggestionsJson);

    /// <summary>Obtém o transcript acumulado (somente leitura).</summary>
    string GetTranscript(Guid requestId);

    /// <summary>Obtém o último estado de anamnese/sugestões (para passar ao próximo passo da IA).</summary>
    (string? AnamnesisJson, string? SuggestionsJson) GetAnamnesisState(Guid requestId);

    /// <summary>Remove a sessão e retorna os dados para persistência. Retorna null se não houver sessão.</summary>
    ConsultationSessionData? GetAndRemove(Guid requestId);
}

/// <summary>Dados da sessão ao encerrar a consulta.</summary>
public record ConsultationSessionData(
    Guid RequestId,
    Guid PatientId,
    string? TranscriptText,
    string? AnamnesisJson,
    string? AiSuggestionsJson);
