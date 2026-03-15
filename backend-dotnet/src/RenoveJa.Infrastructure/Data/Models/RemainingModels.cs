namespace RenoveJa.Infrastructure.Data.Models;

/// <summary>Modelo de persistência de notificação (tabela notifications).</summary>
public class NotificationModel
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string NotificationType { get; set; } = "info";
    public bool Read { get; set; }
    public string? Data { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class VideoRoomModel
{
    public Guid Id { get; set; }
    public Guid RequestId { get; set; }
    public string RoomName { get; set; } = string.Empty;
    public string? RoomUrl { get; set; }
    public string Status { get; set; } = "waiting";
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public int? DurationSeconds { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Modelo de persistência de anamnese de consulta (tabela consultation_anamnesis).</summary>
public class ConsultationAnamnesisModel
{
    public Guid Id { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("request_id")]
    public Guid RequestId { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("patient_id")]
    public Guid PatientId { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("transcript_text")]
    public string? TranscriptText { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("transcript_file_url")]
    public string? TranscriptFileUrl { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("anamnesis_json")]
    public string? AnamnesisJson { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("ai_suggestions_json")]
    public string? AiSuggestionsJson { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("evidence_json")]
    public string? EvidenceJson { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }
}

/// <summary>Modelo de persistência de preferências de push (tabela user_push_preferences).</summary>
public class UserPushPreferencesModel
{
    public Guid UserId { get; set; }
    public bool RequestsEnabled { get; set; }
    public bool PaymentsEnabled { get; set; }
    public bool ConsultationsEnabled { get; set; }
    public bool RemindersEnabled { get; set; }
    public string Timezone { get; set; } = "America/Sao_Paulo";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Modelo de persistência de token de push (tabela push_tokens).</summary>
public class PushTokenModel
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public string DeviceType { get; set; } = "unknown";
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}
