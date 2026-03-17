#!/usr/bin/env dotnet-script
#r "nuget: Npgsql, 8.0.5"
#r "nuget: System.Text.Json, 8.0.0"

using Npgsql;
using System.Text.Json;

var requestId = "720a5727-24c3-44ca-9e26-66fd03471eb1";
var connStr = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
    ?? throw new InvalidOperationException("Defina ConnectionStrings__DefaultConnection");

await using var conn = new NpgsqlConnection(connStr);
await conn.OpenAsync();

await using var cmd = new NpgsqlCommand(
    "SELECT anamnesis_json, ai_suggestions_json FROM public.consultation_anamnesis WHERE request_id = @id",
    conn);
cmd.Parameters.AddWithValue("id", Guid.Parse(requestId));

await using var r = await cmd.ExecuteReaderAsync();
if (!await r.ReadAsync())
{
    Console.WriteLine("Nenhum registro encontrado para request_id " + requestId);
    return;
}

var anamnesisJson = r.IsDBNull(0) ? null : r.GetString(0);
var suggestionsJson = r.IsDBNull(1) ? null : r.GetString(1);

if (string.IsNullOrWhiteSpace(anamnesisJson))
{
    Console.WriteLine("anamnesis_json vazio ou null");
    return;
}

var doc = JsonDocument.Parse(anamnesisJson);
var root = doc.RootElement;

Console.WriteLine("=== CID SUGERIDO ===");
if (root.TryGetProperty("cid_sugerido", out var cid))
    Console.WriteLine(cid.GetString() ?? "(vazio)");
else
    Console.WriteLine("(não encontrado)");

Console.WriteLine("\n=== CONFIANÇA ===");
if (root.TryGetProperty("confianca_cid", out var conf))
    Console.WriteLine(conf.GetString() ?? "(vazio)");

Console.WriteLine("\n=== RACIOCÍNIO CLÍNICO ===");
if (root.TryGetProperty("raciocinio_clinico", out var rac)))
    Console.WriteLine((rac.GetString() ?? "").Length > 500 ? rac.GetString()![..500] + "..." : rac.GetString());

Console.WriteLine("\n=== DIAGNÓSTICO DIFERENCIAL (primeiros 3) ===");
if (root.TryGetProperty("diagnostico_diferencial", out var dd) && dd.ValueKind == JsonValueKind.Array)
{
    var i = 0;
    foreach (var item in dd.EnumerateArray())
    {
        if (i++ >= 3) break;
        var hip = item.TryGetProperty("hipotese", out var h) ? h.GetString() : "?";
        var c = item.TryGetProperty("cid", out var c2) ? c2.GetString() : "?";
        var prob = item.TryGetProperty("probabilidade", out var p) ? p.GetString() : "?";
        Console.WriteLine($"  {hip} | {c} | {prob}");
    }
}
