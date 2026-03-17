using System;
using System.Linq;
using System.Text.Json;
using Npgsql;

var connStr = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
    ?? Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? args.FirstOrDefault()
    ?? throw new InvalidOperationException(
        "Defina ConnectionStrings__DefaultConnection, DATABASE_URL ou passe a connection string como argumento.");

var requestId = args.Length > 1 ? args[1] : null;
var brasiliaOffset = TimeSpan.FromHours(-3);

await using var conn = new NpgsqlConnection(connStr);
await conn.OpenAsync();

// Se não passou requestId, busca o ID da última consulta
if (string.IsNullOrEmpty(requestId))
{
    await using var cmdLast = new NpgsqlCommand(@"
        SELECT r.id FROM consultation_anamnesis ca
        JOIN requests r ON r.id = ca.request_id
        ORDER BY ca.created_at DESC LIMIT 1
    ", conn);
    var lastId = await cmdLast.ExecuteScalarAsync();
    if (lastId == null || lastId == DBNull.Value)
    {
        Console.WriteLine("Nenhuma consulta encontrada.");
        return 1;
    }
    requestId = lastId.ToString();
}

if (!Guid.TryParse(requestId, out var reqGuid))
{
    Console.WriteLine("Request ID inválido.");
    return 1;
}

// Request + Patient + Doctor + Anamnesis
await using var cmd = new NpgsqlCommand(@"
    SELECT 
        r.id, r.short_code, r.patient_id, r.patient_name, r.doctor_id, r.doctor_name,
        r.status, r.request_type, r.symptoms, r.notes, r.price,
        r.consultation_type, r.contracted_minutes, r.price_per_minute,
        r.consultation_started_at, r.doctor_call_connected_at, r.patient_call_connected_at,
        r.ai_summary_for_doctor, r.doctor_conduct_notes, r.conduct_updated_at,
        r.created_at, r.updated_at,
        pu.name AS patient_full_name, pu.email AS patient_email, pu.phone AS patient_phone, pu.birth_date AS patient_birth,
        du.name AS doctor_full_name, du.email AS doctor_email,
        ca.transcript_text, ca.anamnesis_json, ca.ai_suggestions_json, ca.evidence_json, ca.soap_notes_json,
        ca.transcript_file_url, ca.recording_file_url, ca.created_at AS anamnesis_created_at
    FROM requests r
    LEFT JOIN users pu ON pu.id = r.patient_id
    LEFT JOIN users du ON du.id = r.doctor_id
    LEFT JOIN consultation_anamnesis ca ON ca.request_id = r.id
    WHERE r.id = @id
", conn);
cmd.Parameters.AddWithValue("id", reqGuid);

await using var r = await cmd.ExecuteReaderAsync();
if (!await r.ReadAsync())
{
    Console.WriteLine("Consulta não encontrada.");
    return 1;
}

var toBrasilia = (DateTime dt) => dt.Add(brasiliaOffset).ToString("yyyy-MM-dd HH:mm:ss");
object? GetVal(string col) { var i = r.GetOrdinal(col); return r.IsDBNull(i) ? null : r.GetValue(i); }
string? GetStr(string col) { var v = GetVal(col); return v?.ToString(); }
decimal? GetDec(string col) { var v = GetVal(col); return v == null ? null : Convert.ToDecimal(v); }
DateTime? GetDt(string col) { var v = GetVal(col); return v is DateTime d ? d : (DateTime?)null; }

Console.WriteLine("═══════════════════════════════════════════════════════════════");
Console.WriteLine("                    DETALHES DA CONSULTA");
Console.WriteLine("═══════════════════════════════════════════════════════════════\n");

Console.WriteLine("── IDENTIFICAÇÃO ──");
Console.WriteLine($"Request ID:      {GetVal("id")}");
Console.WriteLine($"Short Code:      {GetStr("short_code") ?? "-"}");
Console.WriteLine($"Status:          {GetStr("status") ?? "-"}");
Console.WriteLine($"Tipo request:    {GetStr("request_type") ?? "-"}");
Console.WriteLine();

Console.WriteLine("── PACIENTE ──");
Console.WriteLine($"ID:              {GetVal("patient_id")}");
Console.WriteLine($"Nome (request): {GetStr("patient_name") ?? "-"}");
Console.WriteLine($"Nome (users):   {GetStr("patient_full_name") ?? "-"}");
Console.WriteLine($"Email:          {GetStr("patient_email") ?? "-"}");
Console.WriteLine($"Telefone:       {GetStr("patient_phone") ?? "-"}");
Console.WriteLine($"Nascimento:     {(GetDt("patient_birth")?.ToString("yyyy-MM-dd") ?? "-")}");
Console.WriteLine();

Console.WriteLine("── MÉDICO ──");
Console.WriteLine($"ID:              {GetVal("doctor_id")}");
Console.WriteLine($"Nome (request): {GetStr("doctor_name") ?? "-"}");
Console.WriteLine($"Nome (users):   {GetStr("doctor_full_name") ?? "-"}");
Console.WriteLine($"Email:          {GetStr("doctor_email") ?? "-"}");
Console.WriteLine();

Console.WriteLine("── CONSULTA ──");
Console.WriteLine($"Queixa/sintomas: {GetStr("symptoms") ?? "-"}");
Console.WriteLine($"Notas:          {GetStr("notes") ?? "-"}");
Console.WriteLine($"Preço:          {(GetDec("price")?.ToString("C2") ?? "-")}");
Console.WriteLine($"Tipo consulta:   {GetStr("consultation_type") ?? "-"}");
Console.WriteLine($"Minutos contr.: {GetVal("contracted_minutes")?.ToString() ?? "-"}");
Console.WriteLine($"Preço/min:      {(GetDec("price_per_minute")?.ToString("C2") ?? "-")}");
Console.WriteLine();

Console.WriteLine("── HORÁRIOS (Brasília) ──");
Console.WriteLine($"Início consulta:     {(GetDt("consultation_started_at") is {} d1 ? toBrasilia(d1) : "-")}");
Console.WriteLine($"Médico conectou:     {(GetDt("doctor_call_connected_at") is {} d2 ? toBrasilia(d2) : "-")}");
Console.WriteLine($"Paciente conectou:   {(GetDt("patient_call_connected_at") is {} d3 ? toBrasilia(d3) : "-")}");
var created = GetDt("created_at");
var updated = GetDt("updated_at");
Console.WriteLine($"Criado em:           {(created.HasValue ? toBrasilia(created.Value) : "-")}");
Console.WriteLine($"Atualizado em:       {(updated.HasValue ? toBrasilia(updated.Value) : "-")}");
Console.WriteLine();

Console.WriteLine("── IA / CONDUTA ──");
var aiSummary = GetStr("ai_summary_for_doctor");
Console.WriteLine($"Resumo IA:       {(string.IsNullOrEmpty(aiSummary) ? "-" : aiSummary.Length > 500 ? aiSummary[..500] + "..." : aiSummary)}");
var conduct = GetStr("doctor_conduct_notes");
Console.WriteLine($"Conduta médico: {(string.IsNullOrEmpty(conduct) ? "-" : conduct.Length > 500 ? conduct[..500] + "..." : conduct)}");
Console.WriteLine($"Conduta atual.: {(GetDt("conduct_updated_at") is {} dc ? toBrasilia(dc) : "-")}");
Console.WriteLine();

Console.WriteLine("── ARQUIVOS ──");
Console.WriteLine($"Transcrição URL: {GetStr("transcript_file_url") ?? "(não salvo)"}");
Console.WriteLine($"Gravação URL:    {GetStr("recording_file_url") ?? "(não salvo)"}");
Console.WriteLine();

// Transcript (preview)
var transcript = GetStr("transcript_text");
if (!string.IsNullOrEmpty(transcript))
{
    Console.WriteLine("── TRANSCRIÇÃO (preview 800 chars) ──");
    Console.WriteLine(transcript.Length > 800 ? transcript[..800] + "..." : transcript);
    Console.WriteLine();
}

// Anamnesis JSON (formatado)
var anamnesisJson = GetStr("anamnesis_json");
if (!string.IsNullOrEmpty(anamnesisJson))
{
    Console.WriteLine("── ANAMNESE (JSON) ──");
    try
    {
        var doc = JsonDocument.Parse(anamnesisJson);
        Console.WriteLine(JsonSerializer.Serialize(doc, new JsonSerializerOptions { WriteIndented = true }));
    }
    catch { Console.WriteLine(anamnesisJson); }
    Console.WriteLine();
}

// AI Suggestions
var suggestionsJson = GetStr("ai_suggestions_json");
if (!string.IsNullOrEmpty(suggestionsJson))
{
    Console.WriteLine("── SUGESTÕES IA (JSON) ──");
    try
    {
        var doc = JsonDocument.Parse(suggestionsJson);
        Console.WriteLine(JsonSerializer.Serialize(doc, new JsonSerializerOptions { WriteIndented = true }));
    }
    catch { Console.WriteLine(suggestionsJson); }
}

Console.WriteLine("\n═══════════════════════════════════════════════════════════════");
return 0;
