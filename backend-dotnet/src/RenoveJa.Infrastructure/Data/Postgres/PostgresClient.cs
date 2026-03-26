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
    private readonly NpgsqlDataSource _dataSource;

    public PostgresClient(IOptions<DatabaseConfig> config)
    {
        _connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection") ?? config.Value.DatabaseUrl ?? "";

        if (string.IsNullOrWhiteSpace(_connectionString))
            throw new InvalidOperationException("Database connection string not configured.");

        if (!_connectionString.Contains("Maximum Pool Size", StringComparison.OrdinalIgnoreCase) && !_connectionString.Contains("Pooling", StringComparison.OrdinalIgnoreCase))
            _connectionString += ";Maximum Pool Size=10;Minimum Pool Size=1;Connection Idle Lifetime=120;Timeout=15";

        // Include Error Detail apenas em Development — em produção revela dados sensíveis (CPFs, emails) nos logs
        if (!_connectionString.Contains("Include Error Detail", StringComparison.OrdinalIgnoreCase))
        {
            var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
            var includeDetail = env.Equals("Development", StringComparison.OrdinalIgnoreCase);
            _connectionString += $";Include Error Detail={includeDetail}";
        }

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            WriteIndented = false,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        // Npgsql 8.x: JSONB não é mais mapeado para string automaticamente.
        // EnableDynamicJson permite cast implícito JSONB↔CLR types (string, JsonDocument, etc.)
        var dsBuilder = new NpgsqlDataSourceBuilder(_connectionString);
        dsBuilder.EnableDynamicJson();
        _dataSource = dsBuilder.Build();
    }

    public PostgresClient(HttpClient httpClient, IOptions<DatabaseConfig> config) : this(config) { }

    private NpgsqlConnection CreateConnection() => _dataSource.CreateConnection();

    /// <summary>Expõe criação de conexão para repositórios que precisam de SQL raw (ex: queries com OR complexo).</summary>
    internal NpgsqlConnection CreateConnectionPublic() => _dataSource.CreateConnection();

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

    /// <summary>
    /// INSERT sem RETURNING * — evita problemas de mapeamento JSONB→string no Npgsql 8.x
    /// quando o resultado do INSERT não é necessário.
    /// </summary>
    public async Task InsertWithoutReturnAsync(string table, object data, CancellationToken cancellationToken = default)
    {
        var tableName = SanitizeTable(table);
        var (columns, paramNames, paramDict) = BuildInsertParams(data, tableName);
        var sql = $"INSERT INTO public.{tableName} ({columns}) VALUES ({paramNames})";
        await using var conn = CreateConnection();
        await conn.OpenAsync(cancellationToken);
        await conn.ExecuteAsync(new CommandDefinition(sql, new DynamicParameters(paramDict), cancellationToken: cancellationToken));
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
    private static readonly System.Text.RegularExpressions.Regex SafeSelectPattern = new(@"^[a-zA-Z0-9_., *]+$", System.Text.RegularExpressions.RegexOptions.Compiled);

    private static string ParseSelect(string? select)
    {
        if (string.IsNullOrWhiteSpace(select) || select == "*")
            return "*";
        if (select.Contains('('))
            return "*";
        if (!SafeSelectPattern.IsMatch(select))
            throw new ArgumentException($"Invalid select parameter: contains disallowed characters.");
        return select;
    }

    private static readonly HashSet<string> JsonbColumnsRequests = new(StringComparer.OrdinalIgnoreCase)
    {
        "medications", "prescription_images", "exams", "exam_images", "ai_extracted_json"
    };

    private static readonly HashSet<string> JsonbColumnsNotifications = new(StringComparer.OrdinalIgnoreCase)
    {
        "data"
    };

    /// <summary>
    /// document_access_log.metadata é JSONB; sem ::jsonb o INSERT pode falhar (PG 42804 text vs jsonb).
    /// </summary>
    private static readonly HashSet<string> JsonbColumnsDocumentAccessLog = new(StringComparer.OrdinalIgnoreCase)
    {
        "metadata"
    };

    /// <summary>
    /// audit_logs.metadata é JSONB; old_values e new_values são TEXT.
    /// Sem ::jsonb o INSERT falha com PG 42804.
    /// </summary>
    private static readonly HashSet<string> JsonbColumnsAuditLogs = new(StringComparer.OrdinalIgnoreCase)
    {
        "metadata"
    };

    private static bool NeedsJsonbCast(string tableName, string columnName)
    {
        if (tableName.Equals("requests", StringComparison.OrdinalIgnoreCase))
            return JsonbColumnsRequests.Contains(columnName);
        if (tableName.Equals("notifications", StringComparison.OrdinalIgnoreCase))
            return JsonbColumnsNotifications.Contains(columnName);
        if (tableName.Equals("document_access_log", StringComparison.OrdinalIgnoreCase))
            return JsonbColumnsDocumentAccessLog.Contains(columnName);
        if (tableName.Equals("audit_logs", StringComparison.OrdinalIgnoreCase))
            return JsonbColumnsAuditLogs.Contains(columnName);
        return false;
    }

    /// <summary>
    /// Colunas TEXT que podem conter valores UUID-like como strings.
    /// Sem cast explícito, ConvertValue converte para System.Guid e Npgsql envia como uuid,
    /// causando PG 42804: "column X is of type text but expression is of type uuid".
    /// </summary>
    private static readonly HashSet<string> TextColumnsWithUuids = new(StringComparer.OrdinalIgnoreCase)
    {
        "entity_id", "correlation_id", "source_request_id", "SourceRequestId"
    };

    private static bool NeedsTextCast(string columnName)
        => TextColumnsWithUuids.Contains(columnName);

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
            var paramExpr = $"@ins{i}";
            if (NeedsJsonbCast(tableName, kv.Key)) paramExpr += "::jsonb";
            else if (NeedsTextCast(kv.Key)) paramExpr += "::text";
            pnames.Add(paramExpr);
            var value = ConvertValue(kv.Value);
            parameters[$"ins{i}"] = NeedsTextCast(kv.Key) && value is Guid gu ? gu.ToString() : value;
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
            var paramExpr = $"@set{i}";
            if (NeedsJsonbCast(tableName, kv.Key)) paramExpr += "::jsonb";
            else if (NeedsTextCast(kv.Key)) paramExpr += "::text";
            clauses.Add($"{kv.Key} = {paramExpr}");
            var value = ConvertValue(kv.Value);
            // Colunas TEXT que armazenam UUID: enviar como string para evitar PG 42883 (text = uuid)
            parameters[$"set{i}"] = NeedsTextCast(kv.Key) && value is Guid g ? g.ToString() : value;
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
                // Converter GUIDs para System.Guid é necessário no INSERT/UPDATE —
                // PostgreSQL NÃO faz cast implícito text→uuid em INSERT VALUES.
                // (A correção de text=uuid ficou no ParseValue, usado apenas em filtros WHERE.)
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
