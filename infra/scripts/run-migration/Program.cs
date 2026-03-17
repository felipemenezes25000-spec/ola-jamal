using Npgsql;

if (args.Length < 2)
{
    Console.WriteLine("Uso: dotnet run <connection-string> <caminho-migration.sql>");
    Console.WriteLine("Ex: dotnet run \"Host=...;Database=renoveja;...\" ../../migrations/20260317_prescriptions_verify_v2.sql");
    return 1;
}

var connStr = args[0];
var migrationPath = Path.GetFullPath(Path.Combine(Environment.CurrentDirectory, args[1]));

if (!File.Exists(migrationPath))
{
    Console.WriteLine($"Arquivo não encontrado: {migrationPath}");
    return 1;
}

var sql = await File.ReadAllTextAsync(migrationPath);

await using var conn = new NpgsqlConnection(connStr);
await conn.OpenAsync();

try
{
    await using var cmd = new NpgsqlCommand(sql, conn);
    await cmd.ExecuteNonQueryAsync();
    Console.WriteLine("Migration aplicada com sucesso.");
}
catch (Exception ex)
{
    Console.WriteLine($"Erro: {ex.Message}");
    return 1;
}

return 0;
