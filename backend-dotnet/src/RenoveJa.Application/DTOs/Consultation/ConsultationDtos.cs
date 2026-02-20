namespace RenoveJa.Application.DTOs.Consultation;

/// <summary>Payload enviado via SignalR para atualização da transcrição no painel do médico.</summary>
public record TranscriptUpdateDto(string FullText);

/// <summary>Payload enviado via SignalR para atualização da anamnese estruturada no painel do médico.</summary>
public record AnamnesisUpdateDto(string AnamnesisJson);

/// <summary>Payload enviado via SignalR para atualização das sugestões da IA no painel do médico.</summary>
public record SuggestionUpdateDto(IReadOnlyList<string> Items);

/// <summary>Resultado do serviço de anamnese: JSON estruturado + sugestões (apoio à decisão).</summary>
public record ConsultationAnamnesisResult(string AnamnesisJson, IReadOnlyList<string> Suggestions);
