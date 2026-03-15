using System.Text.Json;
using System.Text.Json.Serialization;
using Dapper;
using Microsoft.Extensions.Options;
using Npgsql;

namespace RenoveJa.Infrastructure.Data.Npgsql;

/// <summary>
/// Drop-in replacement for PostgresClient that uses Npgsql/Dapper directly.
/// Translates PostgREST-style filters to SQL WHERE clauses.
/// </summary>
public class NpgsqlDataClient
{
    private readonly string _connectionString;
    private readonly JsonSerializerOptions _jsonOptions;

    public NpgsqlDataClient(IOptions<NpgsqlConfig> config)
    {
        _connectionString = config.Value.ConnectionString
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            WriteIndented = false,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        // Dapper: mapear snake_case columns para PascalCase properties
        DefaultTypeMap.MatchNamesWithUnderscores = true;
    }

    private NpgsqlConnection CreateConnection() => new(_connectionString);

    /// <summary>
    /// Obtém todos os registros de uma tabela com select, filtro, ordenação e limite opcionais.
    /// Compatible with PostgresClient.GetAllAsync signature.
    /// </summary>
    public async Task<List<T>> GetAllAsync<T>(
        string table,
        string? select = "*",
        string? filter = null,
        string? orderBy = null,
        int? limit = null,
        int? offset = null,
        CancellationToken cancellationToken = default)
    {
        var (whereClause, parameters) = PostgRestFilterParser.Parse(filter);
        var orderSql = PostgRestFilterParser.ParseOrderBy(orderBy);
        var columns = ParseSelect(select);

        var sql = $"SELECT {columns} FROM public.{SanitizeTable(table)}{whereClause}{orderSql}";

        if (limit.HasValue && limit.Value > 0)
            sql += $" LIMIT {limit.Value}";
        if (offset.HasValue && offset.Value > 0)
            sql += $" OFFSET {offset.Value}";

        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);

        var result = await conn.QueryAsync<T>(new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));
        return result.AsList();
    }

    /// <summary>
    /// Conta o número de registros que atendem ao filtro.
    /// </summary>
    public async Task<int> CountAsync(
        string table,
        string? filter = null,
        CancellationToken cancellationToken = default)
    {
        var (whereClause, parameters) = PostgRestFilterParser.Parse(filter);
        var sql = $"SELECT COUNT(*) FROM public.{SanitizeTable(table)}{whereClause}";

        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);

        return await conn.ExecuteScalarAsync<int>(new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));
    }

    /// <summary>
    /// Obtém um único registro (ou null) de uma tabela.
    /// </summary>
    public async Task<T?> GetSingleAsync<T>(
        string table,
        string? select = "*",
        string? filter = null,
        CancellationToken cancellationToken = default)
    {
        var (whereClause, parameters) = PostgRestFilterParser.Parse(filter);
        var columns = ParseSelect(select);
        var sql = $"SELECT {columns} FROM public.{SanitizeTable(table)}{whereClause} LIMIT 1";

        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);

        return await conn.QueryFirstOrDefaultAsync<T>(new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));
    }

    /// <summary>
    /// Insere um registro e retorna o resultado.
    /// </summary>
    public async Task<T> InsertAsync<T>(
        string table,
        object data,
        CancellationToken cancellationToken = default)
    {
        var tableName = SanitizeTable(table);
        var (columns, paramNames, paramDict) = BuildInsertParams(data);
        var sql = $"INSERT INTO public.{tableName} ({columns}) VALUES ({paramNames}) RETURNING *";

        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);

        var result = await conn.QueryFirstOrDefaultAsync<T>(
            new CommandDefinition(sql, paramDict, cancellationToken: cancellationToken));

        if (result is null)
            throw new InvalidOperationException($"Insert failed: no data returned. Table: {tableName}");

        return result;
    }

    /// <summary>
    /// Atualiza registros que atendem ao filtro e retorna o primeiro atualizado.
    /// </summary>
    public async Task<T> UpdateAsync<T>(
        string table,
        string filter,
        object data,
        CancellationToken cancellationToken = default)
    {
        var tableName = SanitizeTable(table);
        var (setClauses, setParams) = BuildUpdateParams(data);
        var (whereClause, whereParams) = PostgRestFilterParser.Parse(filter, setParams.Count);

        // Merge parameters
        foreach (var kv in whereParams)
            setParams.Add(kv.Key, kv.Value);

        var sql = $"UPDATE public.{tableName} SET {setClauses}{whereClause} RETURNING *";

        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);

        var result = await conn.QueryFirstOrDefaultAsync<T>(
            new CommandDefinition(sql, new DynamicParameters(setParams), cancellationToken: cancellationToken));

        return result!;
    }

    /// <summary>
    /// Insere ou atualiza (upsert) um registro usando a chave primária como resolução de conflito.
    /// </summary>
    public async Task UpsertAsync(
        string table,
        object data,
        CancellationToken cancellationToken = default)
    {
        var tableName = SanitizeTable(table);
        var (columns, paramNames, paramDict) = BuildInsertParams(data);

        // Upsert: ON CONFLICT (id) DO UPDATE SET ...
        var updateClauses = string.Join(", ",
            columns.Split(", ").Where(c => c != "id").Select(c => $"{c} = EXCLUDED.{c}"));

        var sql = $"INSERT INTO public.{tableName} ({columns}) VALUES ({paramNames}) ON CONFLICT (id) DO UPDATE SET {updateClauses}";

        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);

        await conn.ExecuteAsync(new CommandDefinition(sql, paramDict, cancellationToken: cancellationToken));
    }

    /// <summary>
    /// Remove registros que atendem ao filtro.
    /// </summary>
    public async Task DeleteAsync(
        string table,
        string filter,
        CancellationToken cancellationToken = default)
    {
        var (whereClause, parameters) = PostgRestFilterParser.Parse(filter);
        var sql = $"DELETE FROM public.{SanitizeTable(table)}{whereClause}";

        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);

        await conn.ExecuteAsync(new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));
    }

    // ===== Helper methods =====

    private static string SanitizeTable(string table)
    {
        // Remove any non-alphanumeric/underscore characters to prevent SQL injection
        return new string(table.Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());
    }

    private static string ParseSelect(string? select)
    {
        if (string.IsNullOrWhiteSpace(select) || select == "*")
            return "*";

        // PostgREST select: "id,name,email" or "id,name,doctor_profiles(id,crm)"
        // For now, handle simple comma-separated columns
        // Nested selects (joins) are not supported — fallback to *
        if (select.Contains('('))
            return "*";

        return select;
    }

    private (string columns, string paramNames, Dictionary<string, object?> parameters) BuildInsertParams(object data)
    {
        var json = JsonSerializer.Serialize(data, _jsonOptions);
        var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json, _jsonOptions)
            ?? new Dictionary<string, JsonElement>();

        var cols = new List<string>();
        var pnames = new List<string>();
        var parameters = new Dictionary<string, object?>();
        var i = 0;

        foreach (var kv in dict)
        {
            cols.Add(kv.Key);
            var paramName = $"@ins{i}";
            pnames.Add(paramName);
            parameters[paramName.TrimStart('@')] = JsonElementToClr(kv.Value);
            i++;
        }

        return (string.Join(", ", cols), string.Join(", ", pnames), parameters);
    }

    private (string setClauses, Dictionary<string, object?> parameters) BuildUpdateParams(object data)
    {
        var json = JsonSerializer.Serialize(data, _jsonOptions);
        var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json, _jsonOptions)
            ?? new Dictionary<string, JsonElement>();

        var clauses = new List<string>();
        var parameters = new Dictionary<string, object?>();
        var i = 0;

        foreach (var kv in dict)
        {
            // Skip 'id' in SET clause
            if (kv.Key.Equals("id", StringComparison.OrdinalIgnoreCase))
                continue;

            var paramName = $"set{i}";
            clauses.Add($"{kv.Key} = @{paramName}");
            parameters[paramName] = JsonElementToClr(kv.Value);
            i++;
        }

        return (string.Join(", ", clauses), parameters);
    }

    private static object? JsonElementToClr(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.TryGetDateTime(out var dt) ? dt : element.GetString(),
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDecimal(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            JsonValueKind.Array => element.GetRawText(), // Store as JSON string
            JsonValueKind.Object => element.GetRawText(), // Store as JSON string
            _ => element.GetRawText()
        };
    }
}
