using System.Text.Json;
using System.Text.Json.Serialization;
using Dapper;
using Microsoft.Extensions.Options;
using Npgsql;
using RenoveJa.Infrastructure.Data.Npgsql;

namespace RenoveJa.Infrastructure.Data.Postgres;

/// <summary>
/// Cliente de acesso a dados PostgreSQL via Npgsql/Dapper.
/// Cliente Postgres customizado — mesma interface pública, zero mudanças nos repositórios.
/// </summary>
public class PostgresClient
{
    private readonly string _connectionString;
    private readonly JsonSerializerOptions _jsonOptions;

    public PostgresClient(IOptions<DatabaseConfig> config)
    {
        _connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection") ?? config.Value.DatabaseUrl ?? "";
        if (!_connectionString.Contains("Maximum Pool Size", StringComparison.OrdinalIgnoreCase) && !_connectionString.Contains("Pooling", StringComparison.OrdinalIgnoreCase))
            _connectionString += ";Maximum Pool Size=20;Minimum Pool Size=2;Connection Idle Lifetime=300;Timeout=15";

        if (string.IsNullOrWhiteSpace(_connectionString))
            throw new InvalidOperationException("Database connection string not configured.");

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            WriteIndented = false,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
        DefaultTypeMap.MatchNamesWithUnderscores = true;
    }

    public PostgresClient(HttpClient httpClient, IOptions<DatabaseConfig> config) : this(config) { }

    private NpgsqlConnection CreateConnection() => new(_connectionString);

    /// <summary>Expõe criação de conexão para repositórios que precisam de SQL raw (ex: queries com OR complexo).</summary>
    internal NpgsqlConnection CreateConnectionPublic() => new(_connectionString);

    public async Task<List<T>> GetAllAsync<T>(
        string table, string? select = "*", string? filter = null,
        string? orderBy = null, int? limit = null, int? offset = null,
        CancellationToken cancellationToken = default)
    {
        var (whereClause, parameters) = PostgRestFilterParser.Parse(filter);
        var orderSql = PostgRestFilterParser.ParseOrderBy(orderBy);
        var columns = ParseSelect(select);
        var sql = $"SELECT {columns} FROM public.{SanitizeTable(table)}{whereClause}{orderSql}";
        if (limit.HasValue && limit.Value > 0) sql += $" LIMIT {limit.Value}";
        if (offset.HasValue && offset.Value > 0) sql += $" OFFSET {offset.Value}";
        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);
        return (await conn.QueryAsync<T>(new CommandDefinition(sql, new DynamicParameters(parameters), cancellationToken: cancellationToken))).AsList();
    }

    public async Task<int> CountAsync(string table, string? filter = null, CancellationToken cancellationToken = default)
    {
        var (whereClause, parameters) = PostgRestFilterParser.Parse(filter);
        var sql = $"SELECT COUNT(*) FROM public.{SanitizeTable(table)}{whereClause}";
        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);
        return await conn.ExecuteScalarAsync<int>(new CommandDefinition(sql, new DynamicParameters(parameters), cancellationToken: cancellationToken));
    }

    public async Task<T?> GetSingleAsync<T>(string table, string? select = "*", string? filter = null, CancellationToken cancellationToken = default)
    {
        var (whereClause, parameters) = PostgRestFilterParser.Parse(filter);
        var sql = $"SELECT {ParseSelect(select)} FROM public.{SanitizeTable(table)}{whereClause} LIMIT 1";
        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);
        return await conn.QueryFirstOrDefaultAsync<T>(new CommandDefinition(sql, new DynamicParameters(parameters), cancellationToken: cancellationToken));
    }

    public async Task<T> InsertAsync<T>(string table, object data, CancellationToken cancellationToken = default)
    {
        var tableName = SanitizeTable(table);
        var (columns, paramNames, paramDict) = BuildInsertParams(data, tableName);
        var sql = $"INSERT INTO public.{tableName} ({columns}) VALUES ({paramNames}) RETURNING *";
        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);
        var result = await conn.QueryFirstOrDefaultAsync<T>(new CommandDefinition(sql, new DynamicParameters(paramDict), cancellationToken: cancellationToken));
        return result ?? throw new InvalidOperationException($"Insert failed: no data returned. Table: {tableName}");
    }

    public async Task<T> UpdateAsync<T>(string table, string filter, object data, CancellationToken cancellationToken = default)
    {
        var tableName = SanitizeTable(table);
        var (setClauses, setParams) = BuildUpdateParams(data, tableName);
        var (whereClause, whereParams) = PostgRestFilterParser.Parse(filter, setParams.Count);
        foreach (var kv in whereParams) setParams[kv.Key] = kv.Value;
        var sql = $"UPDATE public.{tableName} SET {setClauses}{whereClause} RETURNING *";
        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);
        return (await conn.QueryFirstOrDefaultAsync<T>(new CommandDefinition(sql, new DynamicParameters(setParams), cancellationToken: cancellationToken)))!;
    }

    public async Task UpsertAsync(string table, object data, CancellationToken cancellationToken = default)
    {
        var tableName = SanitizeTable(table);
        var (columns, paramNames, paramDict) = BuildInsertParams(data, tableName);
        var updateClauses = string.Join(", ", columns.Split(", ").Where(c => c != "id").Select(c => $"{c} = EXCLUDED.{c}"));
        var sql = string.IsNullOrEmpty(updateClauses)
            ? $"INSERT INTO public.{tableName} ({columns}) VALUES ({paramNames}) ON CONFLICT (id) DO NOTHING"
            : $"INSERT INTO public.{tableName} ({columns}) VALUES ({paramNames}) ON CONFLICT (id) DO UPDATE SET {updateClauses}";
        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);
        await conn.ExecuteAsync(new CommandDefinition(sql, new DynamicParameters(paramDict), cancellationToken: cancellationToken));
    }

    public async Task DeleteAsync(string table, string filter, CancellationToken cancellationToken = default)
    {
        var (whereClause, parameters) = PostgRestFilterParser.Parse(filter);
        var sql = $"DELETE FROM public.{SanitizeTable(table)}{whereClause}";
        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);
        await conn.ExecuteAsync(new CommandDefinition(sql, new DynamicParameters(parameters), cancellationToken: cancellationToken));
    }

    // ===== Helpers =====

    private static string SanitizeTable(string table) => new(table.Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());
    private static string ParseSelect(string? select) => string.IsNullOrWhiteSpace(select) || select == "*" ? "*" : select.Contains('(') ? "*" : select;

    private static readonly HashSet<string> JsonbColumnsRequests = new(StringComparer.OrdinalIgnoreCase)
    {
        "medications", "prescription_images", "exams", "exam_images", "ai_extracted_json"
    };

    private static readonly HashSet<string> JsonbColumnsNotifications = new(StringComparer.OrdinalIgnoreCase)
    {
        "data"
    };

    private static bool NeedsJsonbCast(string tableName, string columnName)
    {
        if (tableName.Equals("requests", StringComparison.OrdinalIgnoreCase))
            return JsonbColumnsRequests.Contains(columnName);
        if (tableName.Equals("notifications", StringComparison.OrdinalIgnoreCase))
            return JsonbColumnsNotifications.Contains(columnName);
        return false;
    }

    private (string columns, string paramNames, Dictionary<string, object?> parameters) BuildInsertParams(object data, string tableName)
    {
        var json = JsonSerializer.Serialize(data, _jsonOptions);
        var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json, _jsonOptions) ?? new();
        var cols = new List<string>();
        var pnames = new List<string>();
        var parameters = new Dictionary<string, object?>();
        var i = 0;
        foreach (var kv in dict)
        {
            cols.Add(kv.Key);
            var needsJsonb = NeedsJsonbCast(tableName, kv.Key);
            pnames.Add(needsJsonb ? $"@ins{i}::jsonb" : $"@ins{i}");
            parameters[$"ins{i}"] = ConvertValue(kv.Value);
            i++;
        }
        return (string.Join(", ", cols), string.Join(", ", pnames), parameters);
    }

    private (string setClauses, Dictionary<string, object?> parameters) BuildUpdateParams(object data, string tableName)
    {
        var json = JsonSerializer.Serialize(data, _jsonOptions);
        var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json, _jsonOptions) ?? new();
        var clauses = new List<string>();
        var parameters = new Dictionary<string, object?>();
        var i = 0;
        foreach (var kv in dict)
        {
            if (kv.Key.Equals("id", StringComparison.OrdinalIgnoreCase)) continue;
            var needsJsonb = NeedsJsonbCast(tableName, kv.Key);
            clauses.Add(needsJsonb ? $"{kv.Key} = @set{i}::jsonb" : $"{kv.Key} = @set{i}");
            parameters[$"set{i}"] = ConvertValue(kv.Value);
            i++;
        }
        return (string.Join(", ", clauses), parameters);
    }

    /// <summary>
    /// Converts a JsonElement to a CLR type compatible with Npgsql.
    /// </summary>
    private static object? ConvertValue(JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Null:
                return null;
            case JsonValueKind.True:
                return true;
            case JsonValueKind.False:
                return false;
            case JsonValueKind.Number:
                if (element.TryGetInt32(out var i32)) return i32;
                if (element.TryGetInt64(out var i64)) return i64;
                if (element.TryGetDecimal(out var dec)) return dec;
                return element.GetDouble();
            case JsonValueKind.String:
                var str = element.GetString();
                if (str == null) return null;
                if (Guid.TryParse(str, out var guid)) return guid;
                if (DateTime.TryParse(str, System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.RoundtripKind, out var dt)) return dt;
                return str;
            case JsonValueKind.Array:
            case JsonValueKind.Object:
                return element.GetRawText();
            default:
                return element.GetRawText();
        }
    }
}
