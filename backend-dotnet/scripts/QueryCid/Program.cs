using System;
using System.Linq;
using System.Text.Json;
using Npgsql;

var requestId = "720a5727-24c3-44ca-9e26-66fd03471eb1";
var connStr = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
    ?? Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? args.FirstOrDefault()
    ?? throw new InvalidOperationException(
        "Defina ConnectionStrings__DefaultConnection, DATABASE_URL ou passe a connection string como argumento.");

await using var conn = new NpgsqlConnection(connStr);
await conn.OpenAsync();

await using var cmd = new NpgsqlCommand(
    "SELECT anamnesis_json FROM public.consultation_anamnesis WHERE request_id = @id",
    conn);
cmd.Parameters.AddWithValue("id", Guid.Parse(requestId));

await using var r = await cmd.ExecuteReaderAsync();
if (!await r.ReadAsync())
{
    Console.WriteLine("Nenhum registro para request_id " + requestId);
    return 1;
}

var json = r.IsDBNull(0) ? null : r.GetString(0);
if (string.IsNullOrWhiteSpace(json))
{
    Console.WriteLine("anamnesis_json vazio");
    return 1;
}

var doc = JsonDocument.Parse(json);
var root = doc.RootElement;

Console.WriteLine("=== CID SUGERIDO ===");
Console.WriteLine(root.TryGetProperty("cid_sugerido", out var cid) ? cid.GetString() ?? "(vazio)" : "(não encontrado)");

Console.WriteLine("\n=== CONFIANÇA ===");
Console.WriteLine(root.TryGetProperty("confianca_cid", out var conf) ? conf.GetString() ?? "-" : "-");

Console.WriteLine("\n=== RACIOCÍNIO CLÍNICO (resumo) ===");
if (root.TryGetProperty("raciocinio_clinico", out var rac))
{
    var t = rac.GetString() ?? "";
    Console.WriteLine(t.Length > 400 ? t[..400] + "..." : t);
}

Console.WriteLine("\n=== DIAGNÓSTICO DIFERENCIAL ===");
if (root.TryGetProperty("diagnostico_diferencial", out var dd) && dd.ValueKind == JsonValueKind.Array)
{
    foreach (var item in dd.EnumerateArray())
    {
        var hip = item.TryGetProperty("hipotese", out var h) ? h.GetString() : "?";
        var c = item.TryGetProperty("cid", out var c2) ? c2.GetString() : "?";
        var prob = item.TryGetProperty("probabilidade", out var p) ? p.GetString() : "?";
        Console.WriteLine($"  • {hip} | {c} | {prob}");
    }
}

return 0;
