// Executa um arquivo SQL no banco configurado em ConnectionStrings__DefaultConnection
// Uso: dotnet run -- <caminho-do-arquivo.sql>
// Carrega .env de ../../src/RenoveJa.Api/.env

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

var sqlPath = args.FirstOrDefault();
if (string.IsNullOrWhiteSpace(sqlPath) || !File.Exists(sqlPath))
{
    Console.WriteLine("Uso: dotnet run -- <caminho-do-arquivo.sql>");
    return 1;
}

var sql = File.ReadAllText(sqlPath);
Console.WriteLine($"Executando: {sqlPath}");

await using var conn = new NpgsqlConnection(connStr);
await conn.OpenAsync();

try
{
    await using var cmd = new NpgsqlCommand(sql, conn);
    await cmd.ExecuteNonQueryAsync();
    Console.WriteLine("Migration concluída com sucesso.");
}
catch (Exception ex)
{
    Console.WriteLine($"ERRO: {ex.Message}");
    return 2;
}
return 0;
