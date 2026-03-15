using System.Text.Json.Serialization;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de notas clínicas do médico sobre o paciente.
/// </summary>
public class DoctorPatientNotesRepository(PostgresClient supabase) : IDoctorPatientNotesRepository
{
    private const string TableName = "doctor_patient_notes";

    public async Task<IReadOnlyList<DoctorPatientNoteEntity>> GetNotesAsync(Guid doctorId, Guid patientId, CancellationToken cancellationToken = default)
    {
        var filter = $"doctor_id=eq.{doctorId}&patient_id=eq.{patientId}";
        var rows = await supabase.GetAllAsync<DoctorPatientNotesRow>(
            TableName,
            filter: filter,
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);

        return rows.Select(r => new DoctorPatientNoteEntity(
            r.Id,
            r.DoctorId,
            r.PatientId,
            r.NoteType ?? "progress_note",
            r.Content ?? "",
            r.RequestId,
            r.CreatedAt,
            r.UpdatedAt
        )).ToList();
    }

    public async Task<DoctorPatientNoteEntity> AddNoteAsync(Guid doctorId, Guid patientId, string noteType, string content, Guid? requestId, CancellationToken cancellationToken = default)
    {
        var payload = new DoctorPatientNotesRow
        {
            DoctorId = doctorId,
            PatientId = patientId,
            NoteType = noteType,
            Content = content.Trim(),
            RequestId = requestId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var inserted = await supabase.InsertAsync<DoctorPatientNotesRow>(TableName, payload, cancellationToken);
        return new DoctorPatientNoteEntity(
            inserted.Id,
            inserted.DoctorId,
            inserted.PatientId,
            inserted.NoteType ?? "progress_note",
            inserted.Content ?? "",
            inserted.RequestId,
            inserted.CreatedAt,
            inserted.UpdatedAt
        );
    }

    private class DoctorPatientNotesRow
    {
        [JsonPropertyName("id")]
        public Guid Id { get; set; }

        [JsonPropertyName("doctor_id")]
        public Guid DoctorId { get; set; }

        [JsonPropertyName("patient_id")]
        public Guid PatientId { get; set; }

        [JsonPropertyName("note_type")]
        public string? NoteType { get; set; }

        [JsonPropertyName("content")]
        public string? Content { get; set; }

        [JsonPropertyName("request_id")]
        public Guid? RequestId { get; set; }

        [JsonPropertyName("created_at")]
        public DateTime CreatedAt { get; set; }

        [JsonPropertyName("updated_at")]
        public DateTime UpdatedAt { get; set; }
    }
}
