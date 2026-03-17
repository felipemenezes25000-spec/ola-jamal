// Valida schema do banco local contra o da AWS (RDS).
// Carrega .env de ../../src/RenoveJa.Api/.env se existir.
// Modos:
//   1) Local vs AWS: ConnectionStrings__LocalConnection + ConnectionStrings__AwsConnection (ou DefaultConnection)
//   2) AWS vs schema esperado: ConnectionStrings__DefaultConnection (AWS) + valida contra infra/schema.sql
//
// Uso: dotnet run (na pasta ValidateSchemaLocalVsAws)

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Npgsql;

// Carregar .env da API se existir
var repoRootForEnv = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", ".."));
var envPath = Path.Combine(repoRootForEnv, "backend-dotnet", "src", "RenoveJa.Api", ".env");
if (File.Exists(envPath))
{
    foreach (var line in File.ReadAllLines(envPath))
    {
        var s = line.Trim();
        if (s.Length == 0 || s[0] == '#') continue;
        var eq = s.IndexOf('=');
        if (eq > 0)
            Environment.SetEnvironmentVariable(s[..eq].Trim(), s[(eq + 1)..].Trim(), EnvironmentVariableTarget.Process);
    }
}

var localConn = Environment.GetEnvironmentVariable("ConnectionStrings__LocalConnection");
var awsConn = Environment.GetEnvironmentVariable("ConnectionStrings__AwsConnection")
    ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

// BaseDirectory = .../ValidateSchemaLocalVsAws/bin/Debug/net8.0/ -> subir 6 níveis = repo root (ola-jamal)
var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", ".."));
var schemaPath = Path.Combine(repoRoot, "infra", "schema.sql");

var modeLocalVsAws = !string.IsNullOrWhiteSpace(localConn) && !string.IsNullOrWhiteSpace(awsConn) && localConn != awsConn;

if (modeLocalVsAws)
{
    Console.WriteLine("=== Modo: Local vs AWS ===\n");
    Console.WriteLine("Local: " + MaskPassword(localConn));
    Console.WriteLine("AWS:  " + MaskPassword(awsConn));
    Console.WriteLine();

    var localSchema = await GetSchemaAsync(localConn);
    var awsSchema = await GetSchemaAsync(awsConn);
    var diff = CompareSchemas(localSchema, awsSchema);

    if (diff.Count == 0)
    {
        Console.WriteLine("OK: Schemas idênticos.");
        return 0;
    }
    Console.WriteLine("DIFERENÇAS ENCONTRADAS:\n");
    foreach (var d in diff) Console.WriteLine(d);
    Console.WriteLine($"\nTotal: {diff.Count} diferença(s).");
    return 2;
}

// Modo: AWS vs schema esperado (infra/schema.sql)
if (string.IsNullOrWhiteSpace(awsConn))
{
    Console.WriteLine("ERRO: Defina ConnectionStrings__DefaultConnection (AWS RDS) ou ConnectionStrings__AwsConnection");
    return 1;
}

Console.WriteLine("=== Modo: AWS vs schema esperado (infra/schema.sql) ===\n");
Console.WriteLine("AWS: " + MaskPassword(awsConn));
Console.WriteLine("Schema: " + schemaPath);
Console.WriteLine();

if (!File.Exists(schemaPath))
{
    Console.WriteLine("ERRO: Arquivo infra/schema.sql não encontrado.");
    return 1;
}

var expectedSchema = ParseExpectedSchema(File.ReadAllText(schemaPath));
var awsSchema2 = await GetSchemaAsync(awsConn);
var diff2 = CompareExpectedVsActual(expectedSchema, awsSchema2);

if (diff2.Count == 0)
{
    Console.WriteLine("OK: AWS está alinhado com infra/schema.sql.");
    return 0;
}

Console.WriteLine("DIFERENÇAS (AWS vs esperado):\n");
foreach (var d in diff2) Console.WriteLine(d);
Console.WriteLine($"\nTotal: {diff2.Count} diferença(s).");
return 2;

static string MaskPassword(string conn)
{
    var idx = conn.IndexOf("Password=", StringComparison.OrdinalIgnoreCase);
    if (idx < 0) return conn;
    var start = idx + 9;
    var end = conn.IndexOf(';', start);
    if (end < 0) end = conn.Length;
    return conn[..start] + "***" + conn[end..];
}

static Dictionary<string, HashSet<string>> ParseExpectedSchema(string sql)
{
    var result = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
    var tableRegex = new Regex(@"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\)\s*;", RegexOptions.IgnoreCase);
    var matches = tableRegex.Matches(sql);
    foreach (Match m in matches)
    {
        var table = m.Groups[1].Value.Trim();
        var body = m.Groups[2].Value;
        var cols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var line in body.Split('\n'))
        {
            var trimmed = line.Trim();
            if (trimmed.StartsWith("--") || string.IsNullOrEmpty(trimmed)) continue;
            var colMatch = Regex.Match(trimmed, @"^(\w+)\s+", RegexOptions.IgnoreCase);
            if (colMatch.Success)
                cols.Add(colMatch.Groups[1].Value.Trim());
        }
        result[table] = cols;
    }
    return result;
}

static List<string> CompareExpectedVsActual(
    Dictionary<string, HashSet<string>> expected,
    Dictionary<string, List<string>> actual)
{
    var diff = new List<string>();
    var allTables = expected.Keys.Union(actual.Keys).OrderBy(x => x).ToList();

    foreach (var table in allTables)
    {
        var expCols = expected.TryGetValue(table, out var e) ? e : new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var actCols = actual.TryGetValue(table, out var a) ? a.Select(c => c.Split(':')[0]).ToHashSet(StringComparer.OrdinalIgnoreCase) : new HashSet<string>();

        if (!expected.ContainsKey(table))
        {
            diff.Add($"[EXTRA NA AWS] Tabela '{table}' existe na AWS mas não no schema esperado.");
            continue;
        }
        if (!actual.ContainsKey(table))
        {
            diff.Add($"[FALTA NA AWS] Tabela '{table}' existe no schema esperado mas não na AWS.");
            continue;
        }

        foreach (var col in expCols.Except(actCols))
            diff.Add($"[FALTA NA AWS] {table}.{col}");
        foreach (var col in actCols.Except(expCols))
            diff.Add($"[EXTRA NA AWS] {table}.{col}");
    }
    return diff;
}

static async Task<Dictionary<string, List<string>>> GetSchemaAsync(string connStr)
{
    var result = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
    await using var conn = new NpgsqlConnection(connStr);
    await conn.OpenAsync();

    await using var cmd = new NpgsqlCommand(@"
        SELECT t.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default
        FROM information_schema.tables t
        JOIN information_schema.columns c ON c.table_schema = t.table_schema AND c.table_name = t.table_name
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name, c.ordinal_position
    ", conn);
    await using var r = await cmd.ExecuteReaderAsync();
    while (await r.ReadAsync())
    {
        var table = r.GetString(0);
        var col = r.GetString(1);
        var type = r.GetString(2);
        var nullable = r.GetString(3);
        var def = r.IsDBNull(4) ? "" : r.GetString(4);
        if (!result.ContainsKey(table))
            result[table] = new List<string>();
        result[table].Add($"{col}:{type}|{nullable}|{def}");
    }
    return result;
}

static List<string> CompareSchemas(
    Dictionary<string, List<string>> local,
    Dictionary<string, List<string>> aws)
{
    var diff = new List<string>();
    var allTables = local.Keys.Union(aws.Keys).OrderBy(x => x).ToList();

    foreach (var table in allTables)
    {
        var localCols = local.TryGetValue(table, out var l) ? l.OrderBy(x => x.Split(':')[0]).ToList() : new List<string>();
        var awsCols = aws.TryGetValue(table, out var a) ? a.OrderBy(x => x.Split(':')[0]).ToList() : new List<string>();

        if (!local.ContainsKey(table))
        {
            diff.Add($"[LOCAL FALTA] Tabela '{table}' existe na AWS mas não no local.");
            continue;
        }
        if (!aws.ContainsKey(table))
        {
            diff.Add($"[AWS FALTA] Tabela '{table}' existe no local mas não na AWS.");
            continue;
        }

        var localColNames = localCols.Select(c => c.Split(':')[0]).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var awsColNames = awsCols.Select(c => c.Split(':')[0]).ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var col in localColNames.Except(awsColNames))
            diff.Add($"[AWS FALTA] {table}.{col}");
        foreach (var col in awsColNames.Except(localColNames))
            diff.Add($"[LOCAL FALTA] {table}.{col}");

        foreach (var lc in localCols)
        {
            var colName = lc.Split(':')[0];
            var lcDef = lc.Split(':', 2)[1];
            var ac = awsCols.FirstOrDefault(c => c.StartsWith(colName + ":", StringComparison.OrdinalIgnoreCase));
            if (ac == null) continue;
            var acDef = ac.Split(':', 2)[1];
            if (lcDef != acDef)
                diff.Add($"[DIFERENÇA] {table}.{colName}: local={lcDef} vs aws={acDef}");
        }
    }
    return diff;
}
