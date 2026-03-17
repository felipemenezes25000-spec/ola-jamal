using Dapper;

namespace RenoveJa.Infrastructure.Data.Npgsql;

/// <summary>
/// Converte filtros PostgREST (usados pelo PostgresClient) em cláusulas SQL WHERE.
/// Suporta os operadores mais comuns: eq, neq, gt, gte, lt, lte, like, ilike, in, is, not.
/// </summary>
public static class PostgRestFilterParser
{
    /// <summary>
    /// Converte um filtro PostgREST em WHERE clause + DynamicParameters.
    /// Exemplo: "id=eq.abc123&status=in.(approved,pending)" →
    ///   " WHERE id = @p0 AND status = ANY(@p1)"
    /// </summary>
    /// <param name="filter">PostgREST filter string (query params without ?)</param>
    /// <param name="paramOffset">Offset for parameter naming to avoid collisions</param>
    /// <returns>SQL WHERE clause (with leading space) and parameter dictionary</returns>
    public static (string whereClause, Dictionary<string, object?> parameters) Parse(string? filter, int paramOffset = 0)
    {
        if (string.IsNullOrWhiteSpace(filter))
            return ("", new Dictionary<string, object?>());

        var conditions = new List<string>();
        var parameters = new Dictionary<string, object?>();
        var paramIndex = paramOffset;

        // Split by & but respect parentheses (for "in.(a,b,c)")
        var parts = SplitFilterParts(filter);

        foreach (var part in parts)
        {
            // Skip non-filter params like "select=*", "order=...", "limit=..."
            if (part.StartsWith("select=") || part.StartsWith("order=") ||
                part.StartsWith("limit=") || part.StartsWith("offset="))
                continue;

            var eqIndex = part.IndexOf('=');
            if (eqIndex <= 0) continue;

            var column = part[..eqIndex];
            var operatorAndValue = part[(eqIndex + 1)..];

            // PostgREST or=(cond1,cond2) ou and=(cond1,cond2): suporta aninhamento recursivo
            if ((column == "or" || column == "and") && operatorAndValue.StartsWith("(") && operatorAndValue.EndsWith(")"))
            {
                var inner = operatorAndValue.Trim('(', ')');
                var (groupSql, newParamIndex) = ParseConditionGroup(inner, paramIndex, parameters, column == "or");
                if (!string.IsNullOrEmpty(groupSql))
                {
                    conditions.Add($"({groupSql})");
                    paramIndex = newParamIndex;
                }
                continue;
            }

            // Handle "not." prefix: not.eq.xxx, not.is.null
            var negate = false;
            if (operatorAndValue.StartsWith("not."))
            {
                negate = true;
                operatorAndValue = operatorAndValue[4..];
            }

            var (sqlCondition, param) = ParseOperator(column, operatorAndValue, paramIndex, negate);

            if (!string.IsNullOrEmpty(sqlCondition))
            {
                conditions.Add(sqlCondition);
                if (param.HasValue)
                {
                    parameters[$"p{paramIndex}"] = param.Value.value;
                    paramIndex++;
                }
            }
        }

        if (conditions.Count == 0)
            return ("", parameters);

        return ($" WHERE {string.Join(" AND ", conditions)}", parameters);
    }

    /// <summary>
    /// Converte orderBy PostgREST para SQL ORDER BY.
    /// "created_at.desc" → " ORDER BY created_at DESC"
    /// "created_at.desc,name.asc" → " ORDER BY created_at DESC, name ASC"
    /// </summary>
    public static string ParseOrderBy(string? orderBy)
    {
        if (string.IsNullOrWhiteSpace(orderBy))
            return "";

        var parts = orderBy.Split(',');
        var sqlParts = new List<string>();

        foreach (var part in parts)
        {
            var dotIndex = part.LastIndexOf('.');
            if (dotIndex > 0)
            {
                var col = QuoteColumn(part[..dotIndex]);
                var dir = part[(dotIndex + 1)..].ToUpperInvariant();
                if (dir is "ASC" or "DESC")
                    sqlParts.Add($"{col} {dir}");
                else if (dir == "ASC.NULLSLAST")
                    sqlParts.Add($"{col} ASC NULLS LAST");
                else if (dir == "DESC.NULLSLAST")
                    sqlParts.Add($"{col} DESC NULLS LAST");
                else
                    sqlParts.Add($"{col} ASC");
            }
            else
            {
                sqlParts.Add(QuoteColumn(part));
            }
        }

        return sqlParts.Count > 0 ? $" ORDER BY {string.Join(", ", sqlParts)}" : "";
    }

    /// <summary>
    /// Parseia um grupo de condições (conteúdo interno de or=(...) ou and=(...)).
    /// Suporta segmentos simples (col.op.val) e aninhados (or=(...), and=(...)).
    /// </summary>
    private static (string sql, int newParamIndex) ParseConditionGroup(
        string inner,
        int paramIndex,
        Dictionary<string, object?> parameters,
        bool isOr)
    {
        var conditions = new List<string>();
        foreach (var segment in SplitByCommaRespectParens(inner))
        {
            var seg = segment.Trim();
            if (string.IsNullOrEmpty(seg)) continue;

            // Nested or=(...) or and=(...) — também aceita or(...) e and(...)
            if (seg.StartsWith("or(") || seg.StartsWith("and(") || seg.StartsWith("or=(") || seg.StartsWith("and=("))
            {
                var op = seg.StartsWith("or") ? "or" : "and";
                var start = op.Length + (seg[op.Length] == '=' ? 1 : 0);
                var val = seg[start..];
                if (val.StartsWith("(") && val.EndsWith(")"))
                {
                    var nestedInner = val.Trim('(', ')');
                    var (nestedSql, newIdx) = ParseConditionGroup(nestedInner, paramIndex, parameters, op == "or");
                    if (!string.IsNullOrEmpty(nestedSql))
                    {
                        conditions.Add($"({nestedSql})");
                        paramIndex = newIdx;
                    }
                }
                continue;
            }

            // Simple: column.operator.value OU column=operator.value (ex: status=in.(a,b))
            string segCol;
            string segOpVal;
            var eqIdx = seg.IndexOf('=');
            var dotIdx = seg.IndexOf('.');
            if (eqIdx > 0 && (dotIdx < 0 || eqIdx < dotIdx))
            {
                segCol = seg[..eqIdx];
                segOpVal = seg[(eqIdx + 1)..];
            }
            else if (dotIdx > 0)
            {
                segCol = seg[..dotIdx];
                segOpVal = seg[(dotIdx + 1)..];
            }
            else
                continue;
            var (sqlCond, segParam) = ParseOperator(segCol, segOpVal, paramIndex, false);
            if (string.IsNullOrEmpty(sqlCond)) continue;
            conditions.Add(sqlCond);
            if (segParam.HasValue)
            {
                parameters[$"p{paramIndex}"] = segParam.Value.value;
                paramIndex++;
            }
        }

        var joinOp = isOr ? " OR " : " AND ";
        return (conditions.Count > 0 ? string.Join(joinOp, conditions) : "", paramIndex);
    }

    private static (string condition, (string key, object? value)? param) ParseOperator(
        string column, string operatorValue, int paramIndex, bool negate)
    {
        var col = QuoteColumn(column);
        var paramName = $"@p{paramIndex}";
        var not = negate ? "NOT " : "";

        // eq.value
        if (operatorValue.StartsWith("eq."))
        {
            var value = operatorValue[3..];
            return ($"{not}{col} = {paramName}", ($"p{paramIndex}", ParseValue(value)));
        }

        // neq.value
        if (operatorValue.StartsWith("neq."))
        {
            var value = operatorValue[4..];
            return ($"{col} != {paramName}", ($"p{paramIndex}", ParseValue(value)));
        }

        // gt.value
        if (operatorValue.StartsWith("gt."))
        {
            var value = operatorValue[3..];
            return ($"{col} > {paramName}", ($"p{paramIndex}", ParseValue(value)));
        }

        // gte.value
        if (operatorValue.StartsWith("gte."))
        {
            var value = operatorValue[4..];
            return ($"{col} >= {paramName}", ($"p{paramIndex}", ParseValue(value)));
        }

        // lt.value
        if (operatorValue.StartsWith("lt."))
        {
            var value = operatorValue[3..];
            return ($"{col} < {paramName}", ($"p{paramIndex}", ParseValue(value)));
        }

        // lte.value
        if (operatorValue.StartsWith("lte."))
        {
            var value = operatorValue[4..];
            return ($"{col} <= {paramName}", ($"p{paramIndex}", ParseValue(value)));
        }

        // like.pattern (PostgREST uses * as wildcard)
        if (operatorValue.StartsWith("like."))
        {
            var pattern = operatorValue[5..].Replace('*', '%');
            return ($"{not}{col} LIKE {paramName}", ($"p{paramIndex}", (object?)pattern));
        }

        // ilike.pattern (case insensitive)
        if (operatorValue.StartsWith("ilike."))
        {
            var pattern = operatorValue[6..].Replace('*', '%');
            return ($"{not}{col} ILIKE {paramName}", ($"p{paramIndex}", (object?)pattern));
        }

        // in.(val1,val2,val3)
        if (operatorValue.StartsWith("in."))
        {
            var listStr = operatorValue[3..].Trim('(', ')');
            var values = listStr.Split(',').Select(v => v.Trim()).ToArray();

            // Use ANY() with array parameter for Npgsql
            if (values.All(v => Guid.TryParse(v, out _)))
            {
                return ($"{not}{col} = ANY({paramName})",
                    ($"p{paramIndex}", (object?)values.Select(Guid.Parse).ToArray()));
            }

            return ($"{not}{col} = ANY({paramName})",
                ($"p{paramIndex}", (object?)values));
        }

        // is.null / is.true / is.false
        if (operatorValue.StartsWith("is."))
        {
            var value = operatorValue[3..].ToLowerInvariant();
            return value switch
            {
                "null" => negate ? ($"{col} IS NOT NULL", null) : ($"{col} IS NULL", null),
                "true" => ($"{col} IS {not}TRUE", null),
                "false" => ($"{col} IS {not}FALSE", null),
                _ => ("", null)
            };
        }

        // cs. (contains) — for arrays/jsonb
        if (operatorValue.StartsWith("cs."))
        {
            var value = operatorValue[3..];
            return ($"{not}{col} @> {paramName}", ($"p{paramIndex}", (object?)value));
        }

        // Fallback: treat as eq
        return ($"{not}{col} = {paramName}", ($"p{paramIndex}", (object?)operatorValue));
    }

    private static object? ParseValue(string value)
    {
        if (value == "null") return null;
        if (value == "true") return true;
        if (value == "false") return false;
        if (Guid.TryParse(value, out var guid)) return guid;
        if (int.TryParse(value, out var intVal)) return intVal;
        if (long.TryParse(value, out var longVal)) return longVal;
        if (decimal.TryParse(value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var decVal)) return decVal;
        if (DateTime.TryParse(value, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind, out var dt)) return dt;
        return value;
    }

    private static string SanitizeColumn(string column)
    {
        // Allow only alphanumeric, underscore, dot (for schema.table)
        return new string(column.Where(c => char.IsLetterOrDigit(c) || c == '_' || c == '.').ToArray());
    }

    /// <summary>
    /// Quota identificador para PostgreSQL (evita conflito com palavras reservadas como OR).
    /// </summary>
    private static string QuoteColumn(string column)
    {
        var safe = SanitizeColumn(column);
        return string.IsNullOrEmpty(safe) ? safe : $"\"{safe}\"";
    }

    /// <summary>
    /// Split filter string by '&' but respect parentheses in values like "in.(a,b,c)"
    /// </summary>
    private static List<string> SplitFilterParts(string filter)
    {
        var parts = new List<string>();
        var current = new System.Text.StringBuilder();
        var depth = 0;

        foreach (var c in filter)
        {
            if (c == '(') depth++;
            else if (c == ')') depth--;
            else if (c == '&' && depth == 0)
            {
                if (current.Length > 0)
                {
                    parts.Add(current.ToString());
                    current.Clear();
                }
                continue;
            }
            current.Append(c);
        }

        if (current.Length > 0)
            parts.Add(current.ToString());

        return parts;
    }

    /// <summary>
    /// Split by comma but respect parentheses (e.g. or=(a.is.null,b.eq.x)).
    /// </summary>
    private static List<string> SplitByCommaRespectParens(string input)
    {
        var parts = new List<string>();
        var current = new System.Text.StringBuilder();
        var depth = 0;

        foreach (var c in input)
        {
            if (c == '(') depth++;
            else if (c == ')') depth--;
            else if (c == ',' && depth == 0)
            {
                if (current.Length > 0)
                {
                    parts.Add(current.ToString());
                    current.Clear();
                }
                continue;
            }
            current.Append(c);
        }

        if (current.Length > 0)
            parts.Add(current.ToString());

        return parts;
    }
}
