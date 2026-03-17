using System;
using System.Linq;
using Npgsql;

// Brasília: UTC-3 (sem horário de verão desde 2019)
var brasiliaOffset = TimeSpan.FromHours(-3);

var connStr = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
    ?? Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? args.FirstOrDefault()
    ?? throw new InvalidOperationException(
        "Defina ConnectionStrings__DefaultConnection, DATABASE_URL ou passe a connection string como argumento.");

await using var conn = new NpgsqlConnection(connStr);
await conn.OpenAsync();

await using var cmd = new NpgsqlCommand(@"
    SELECT 
        r.id AS request_id,
        r.created_at,
        r.status,
        r.request_type,
        ca.transcript_file_url,
        ca.recording_file_url,
        LEFT(ca.transcript_text, 200) AS transcript_preview
    FROM consultation_anamnesis ca
    JOIN requests r ON r.id = ca.request_id
    ORDER BY ca.created_at DESC
    LIMIT 1
", conn);

await using var r = await cmd.ExecuteReaderAsync();
if (!await r.ReadAsync())
{
    Console.WriteLine("Nenhuma consulta encontrada.");
    return 1;
}

var requestId = r.GetGuid(0);
var createdAt = r.GetDateTime(1);
var status = r.GetString(2);
var requestType = r.IsDBNull(3) ? "?" : r.GetString(3);
var transcriptUrl = r.IsDBNull(4) ? null : r.GetString(4);
var recordingUrl = r.IsDBNull(5) ? null : r.GetString(5);
var transcriptPreview = r.IsDBNull(6) ? null : r.GetString(6);

Console.WriteLine("=== ÚLTIMA CONSULTA ===\n");
Console.WriteLine($"Request ID:  {requestId}");
var brasiliaTime = createdAt.Add(brasiliaOffset);
Console.WriteLine($"Criada em:   {brasiliaTime:yyyy-MM-dd HH:mm:ss} (Brasília)");
Console.WriteLine($"Status:      {status}");
Console.WriteLine($"Tipo:        {requestType}");
Console.WriteLine();
Console.WriteLine("=== ONDE FOI SALVA ===");
Console.WriteLine();
Console.WriteLine("Banco (PostgreSQL):");
Console.WriteLine($"  • tabela: requests (id={requestId})");
Console.WriteLine($"  • tabela: consultation_anamnesis (request_id={requestId})");
Console.WriteLine();
Console.WriteLine("S3 (bucket renoveja-transcripts):");
var pathPrefix = $"consultas/{requestId:N}";
Console.WriteLine($"  • Transcrição: {pathPrefix}/transcricao/transcricao-{requestId:N}.txt");
Console.WriteLine($"  • Gravação:    {pathPrefix}/gravacao/consulta-{requestId:N}-*.mp4");
Console.WriteLine($"  • Chunks áudio: {pathPrefix}/gravacao-chunks/*.webm");
Console.WriteLine();
Console.WriteLine("URLs (se existirem):");
Console.WriteLine($"  • transcript_file_url: {transcriptUrl ?? "(não salvo)"}");
Console.WriteLine($"  • recording_file_url:  {recordingUrl ?? "(não salvo)"}");
Console.WriteLine();
if (!string.IsNullOrEmpty(transcriptPreview))
{
    Console.WriteLine("Preview transcrição: " + transcriptPreview + "...");
}
return 0;
