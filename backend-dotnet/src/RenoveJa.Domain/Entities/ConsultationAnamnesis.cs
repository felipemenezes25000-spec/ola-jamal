namespace RenoveJa.Domain.Entities;

/// <summary>
/// Registro de transcrição e anamnese gerados durante uma consulta por vídeo (um por request).
/// </summary>
public class ConsultationAnamnesis : Entity
{
    public Guid RequestId { get; private set; }
    public Guid PatientId { get; private set; }
    public string? TranscriptText { get; private set; }
    public string? AnamnesisJson { get; private set; }
    public string? AiSuggestionsJson { get; private set; }

    private ConsultationAnamnesis() : base()
    { }

    private ConsultationAnamnesis(
        Guid id,
        Guid requestId,
        Guid patientId,
        string? transcriptText,
        string? anamnesisJson,
        string? aiSuggestionsJson,
        DateTime createdAt)
        : base(id, createdAt)
    {
        RequestId = requestId;
        PatientId = patientId;
        TranscriptText = transcriptText;
        AnamnesisJson = anamnesisJson;
        AiSuggestionsJson = aiSuggestionsJson;
    }

    public static ConsultationAnamnesis Create(Guid requestId, Guid patientId, string? transcriptText, string? anamnesisJson, string? aiSuggestionsJson)
    {
        if (requestId == Guid.Empty)
            throw new Domain.Exceptions.DomainException("Request ID is required");
        if (patientId == Guid.Empty)
            throw new Domain.Exceptions.DomainException("Patient ID is required");

        return new ConsultationAnamnesis(
            Guid.NewGuid(),
            requestId,
            patientId,
            transcriptText,
            anamnesisJson,
            aiSuggestionsJson,
            DateTime.UtcNow);
    }

    public static ConsultationAnamnesis Reconstitute(
        Guid id,
        Guid requestId,
        Guid patientId,
        string? transcriptText,
        string? anamnesisJson,
        string? aiSuggestionsJson,
        DateTime createdAt)
    {
        return new ConsultationAnamnesis(
            id,
            requestId,
            patientId,
            transcriptText,
            anamnesisJson,
            aiSuggestionsJson,
            createdAt);
    }

    public void Update(string? transcriptText, string? anamnesisJson, string? aiSuggestionsJson)
    {
        TranscriptText = transcriptText;
        AnamnesisJson = anamnesisJson;
        AiSuggestionsJson = aiSuggestionsJson;
    }
}
