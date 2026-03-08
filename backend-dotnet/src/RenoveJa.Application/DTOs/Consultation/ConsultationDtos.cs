namespace RenoveJa.Application.DTOs.Consultation;

/// <summary>Payload para envio de texto já transcrito (Daily.co nativo).</summary>
/// <param name="StartTimeSeconds">Segundos desde o início da transcrição (Deepgram/Daily), opcional.</param>
public record TranscribeTextRequestDto(Guid RequestId, string Text, string? Speaker, double? StartTimeSeconds = null);

/// <summary>Payload enviado via SignalR para atualização da transcrição no painel do médico.</summary>
public record TranscriptUpdateDto(string FullText);

/// <summary>Payload enviado via SignalR para atualização da anamnese estruturada no painel do médico.</summary>
public record AnamnesisUpdateDto(string AnamnesisJson);

/// <summary>Payload enviado via SignalR para atualização das sugestões da IA no painel do médico.</summary>
public record SuggestionUpdateDto(IReadOnlyList<string> Items);

/// <summary>Payload enviado via SignalR para atualização das evidências (artigos PubMed) no painel do médico.</summary>
public record EvidenceUpdateDto(IReadOnlyList<EvidenceItemDto> Items);

/// <summary>Provedor da evidência: PubMed, Europe PMC, Semantic Scholar, ClinicalTrials.gov.</summary>
public static class EvidenceProvider
{
    public const string PubMed = "PubMed";
    public const string EuropePmc = "Europe PMC";
    public const string SemanticScholar = "Semantic Scholar";
    public const string ClinicalTrials = "ClinicalTrials.gov";
}

/// <summary>Item de evidência: artigo científico com trechos relevantes, relevância clínica e conexão com o paciente.</summary>
public record EvidenceItemDto(
    string Title,
    string Abstract,
    string Source,
    string? TranslatedAbstract,
    IReadOnlyList<string>? RelevantExcerpts = null,
    string? ClinicalRelevance = null,
    string? Provider = null,
    string? Url = null,
    string? ConexaoComPaciente = null,
    string? NivelEvidencia = null,
    string? MotivoSelecao = null);

/// <summary>Resultado do serviço de anamnese: JSON estruturado + sugestões + evidências (apoio à decisão).</summary>
public record ConsultationAnamnesisResult(string AnamnesisJson, IReadOnlyList<string> Suggestions, IReadOnlyList<EvidenceItemDto> Evidence);
