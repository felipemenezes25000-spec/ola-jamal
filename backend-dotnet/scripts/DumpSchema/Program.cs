// Extrai schema do PostgreSQL e gera infra/schema.sql
// Carrega ConnectionStrings__DefaultConnection do .env da API

using System.Text;
using Npgsql;

var connStr = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
if (string.IsNullOrWhiteSpace(connStr))
{
    var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", ".."));
    var envPath = Path.Combine(repoRoot, "backend-dotnet", "src", "RenoveJa.Api", ".env");
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
        connStr = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
    }
}

if (string.IsNullOrWhiteSpace(connStr))
{
    Console.WriteLine("ERRO: Defina ConnectionStrings__DefaultConnection no .env");
    return 1;
}

var repoRootOut = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", ".."));
var outputPath = Path.Combine(repoRootOut, "infra", "schema.sql");
Console.WriteLine($"Conectando ao banco e extraindo schema...");
Console.WriteLine($"Saída: {outputPath}");

var sb = new StringBuilder();
sb.AppendLine("-- ============================================================");
sb.AppendLine("-- Schema completo RenoveJá+ para RDS PostgreSQL");
sb.AppendLine("-- Gerado automaticamente a partir do banco AWS. Data: " + DateTime.UtcNow.ToString("yyyy-MM-dd"));
sb.AppendLine("-- ============================================================");
sb.AppendLine();
sb.AppendLine("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";");
sb.AppendLine();

await using var conn = new NpgsqlConnection(connStr);
await conn.OpenAsync();

var tables = new List<string>();
await using (var cmd = new NpgsqlCommand(@"
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
", conn))
await using (var r = await cmd.ExecuteReaderAsync())
{
    while (await r.ReadAsync())
        tables.Add(r.GetString(0));
}

foreach (var table in tables)
{
    sb.AppendLine($"-- ============================================================");
    sb.AppendLine($"-- {table}");
    sb.AppendLine($"-- ============================================================");
    sb.AppendLine();

    var columns = new List<(string name, string type, bool nullable, string? def)>();
    await using (var cmd = new NpgsqlCommand(@"
        SELECT column_name, data_type, character_maximum_length, numeric_precision, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = @t
        ORDER BY ordinal_position
    ", conn))
    {
        cmd.Parameters.AddWithValue("t", table);
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync())
        {
            var colName = r.GetString(0);
            var dataType = r.GetString(1);
            var maxLen = r.IsDBNull(2) ? (int?)null : r.GetInt32(2);
            var numPrec = r.IsDBNull(3) ? (int?)null : r.GetInt32(3);
            var nullable = r.GetString(4) == "YES";
            var def = r.IsDBNull(5) ? null : r.GetString(5);

            var pgType = dataType.ToLowerInvariant() switch
            {
                "character varying" => maxLen > 0 ? $"VARCHAR({maxLen})" : "TEXT",
                "varchar" => maxLen > 0 ? $"VARCHAR({maxLen})" : "TEXT",
                "character" => maxLen > 0 ? $"CHAR({maxLen})" : "TEXT",
                "numeric" => numPrec > 0 ? $"DECIMAL({numPrec})" : "DECIMAL(10,2)",
                "timestamp with time zone" => "TIMESTAMPTZ",
                "timestamp without time zone" => "TIMESTAMP",
                "double precision" => "DOUBLE PRECISION",
                "boolean" => "BOOLEAN",
                "integer" => "INTEGER",
                "bigint" => "BIGINT",
                "smallint" => "SMALLINT",
                "uuid" => "UUID",
                "jsonb" => "JSONB",
                "text" => "TEXT",
                _ => dataType.ToUpperInvariant()
            };

            columns.Add((colName, pgType, nullable, def));
        }
    }

    var pkCols = new List<string>();
    await using (var cmd = new NpgsqlCommand(@"
        SELECT a.attname FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) AND a.attisdropped = false
        WHERE i.indrelid = ('public.' || @t)::regclass AND i.indisprimary
    ", conn))
    {
        cmd.Parameters.AddWithValue("t", table);
        try
        {
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
                pkCols.Add(r.GetString(0));
        }
        catch { }
    }

    sb.AppendLine($"CREATE TABLE IF NOT EXISTS public.{table} (");
    for (var i = 0; i < columns.Count; i++)
    {
        var (name, type, nullable, def) = columns[i];
        var notNull = !nullable ? " NOT NULL" : "";
        var defaultClause = !string.IsNullOrEmpty(def) ? $" DEFAULT {def}" : "";
        var pk = pkCols.Contains(name, StringComparer.OrdinalIgnoreCase) ? " PRIMARY KEY" : "";
        var comma = i < columns.Count - 1 ? "," : "";
        sb.AppendLine($"    {name} {type}{pk}{notNull}{defaultClause}{comma}");
    }
    sb.AppendLine(");");
    sb.AppendLine();

    var indexes = new List<(string name, string def)>();
    await using (var cmd = new NpgsqlCommand(@"
        SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = @t
        AND indexname NOT LIKE '%_pkey'
    ", conn))
    {
        cmd.Parameters.AddWithValue("t", table);
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync())
        {
            var idxName = r.GetString(0);
            var idxDef = r.GetString(1);
            var createIdx = idxDef.Replace("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ")
                .Replace("CREATE UNIQUE INDEX ", "CREATE UNIQUE INDEX IF NOT EXISTS ");
            indexes.Add((idxName, createIdx));
        }
    }

    foreach (var (_, idxDef) in indexes)
        sb.AppendLine(idxDef + ";");
    if (indexes.Count > 0) sb.AppendLine();

    var fks = new List<string>();
    await using (var cmd = new NpgsqlCommand(@"
        SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
        WHERE conrelid = ('public.' || @t)::regclass AND contype = 'f'
    ", conn))
    {
        cmd.Parameters.AddWithValue("t", table);
        try
        {
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                var def = r.GetString(1);
                if (!def.Contains("REFERENCES"))
                    fks.Add($"ALTER TABLE public.{table} ADD CONSTRAINT {r.GetString(0)} {def};");
            }
        }
        catch { }
    }

    foreach (var fk in fks)
        sb.AppendLine(fk);
    if (fks.Count > 0) sb.AppendLine();
}

sb.AppendLine("-- Fim do schema RenoveJá+");

var dir = Path.GetDirectoryName(outputPath);
if (!string.IsNullOrEmpty(dir))
    Directory.CreateDirectory(dir);

await File.WriteAllTextAsync(outputPath, sb.ToString(), Encoding.UTF8);
Console.WriteLine($"Schema atualizado: {outputPath}");
Console.WriteLine($"Tabelas: {tables.Count}");

return 0;
