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
    [System.Text.Json.Serialization.JsonPropertyName("recording_file_url")]
    public string? RecordingFileUrl { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("anamnesis_json")]
    public string? AnamnesisJson { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("ai_suggestions_json")]
    public string? AiSuggestionsJson { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("evidence_json")]
    public string? EvidenceJson { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("soap_notes_json")]
    public string? SoapNotesJson { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("soap_notes_generated_at")]
    public DateTime? SoapNotesGeneratedAt { get; set; }
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

/// <summary>Modelo de persistência de sugestão IA (tabela ai_suggestions).</summary>
public class AiSuggestionModel
{
    public Guid Id { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("consultation_id")]
    public Guid ConsultationId { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("patient_id")]
    public Guid PatientId { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("doctor_id")]
    public Guid? DoctorId { get; set; }
    public string Type { get; set; } = "exam_suggestion";
    public string Status { get; set; } = "generated";
    public string Model { get; set; } = string.Empty;
    [System.Text.Json.Serialization.JsonPropertyName("payload_json")]
    public string PayloadJson { get; set; } = "{}";
    [System.Text.Json.Serialization.JsonPropertyName("payload_hash")]
    public string PayloadHash { get; set; } = string.Empty;
    [System.Text.Json.Serialization.JsonPropertyName("correlation_id")]
    public string? CorrelationId { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Modelo de persistência de evento outbox (tabela outbox_events).</summary>
public class OutboxEventModel
{
    public Guid Id { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("aggregate_type")]
    public string AggregateType { get; set; } = string.Empty;
    [System.Text.Json.Serialization.JsonPropertyName("aggregate_id")]
    public Guid AggregateId { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("event_type")]
    public string EventType { get; set; } = string.Empty;
    [System.Text.Json.Serialization.JsonPropertyName("payload_json")]
    public string PayloadJson { get; set; } = "{}";
    [System.Text.Json.Serialization.JsonPropertyName("idempotency_key")]
    public string IdempotencyKey { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    [System.Text.Json.Serialization.JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }
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
