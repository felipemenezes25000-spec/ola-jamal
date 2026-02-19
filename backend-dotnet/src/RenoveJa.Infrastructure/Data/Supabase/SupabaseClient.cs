using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace RenoveJa.Infrastructure.Data.Supabase;

/// <summary>
/// Cliente HTTP para a API REST do Supabase (PostgREST).
/// </summary>
public class SupabaseClient
{
    private readonly HttpClient _httpClient;
    private readonly SupabaseConfig _config;
    private readonly JsonSerializerOptions _jsonOptions;

    /// <summary>
    /// Construtor que recebe o HttpClient e a configuração do Supabase e configura os headers.
    /// </summary>
    public SupabaseClient(HttpClient httpClient, IOptions<SupabaseConfig> config)
    {
        _httpClient = httpClient;
        _config = config.Value;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            WriteIndented = false
        };
        EnsureServiceRoleKey();
        ConfigureHttpClient();
    }

    /// <summary>
    /// Exige a chave service_role (secret) para evitar 401 em INSERT/UPDATE.
    /// Aceita chaves no formato novo (sb_secret_...) ou formato antigo (JWT que começa com eyJ...).
    /// </summary>
    private void EnsureServiceRoleKey()
    {
<<<<<<< HEAD
        var key = _config.ServiceKey?.Trim() ?? string.Empty;
=======
        var key = _config.ServiceKey;
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
        if (string.IsNullOrWhiteSpace(key))
            throw new InvalidOperationException(
                "Supabase:ServiceKey está vazia. Defina a chave secret em appsettings (Project Settings → API → Secret keys no Supabase).");

        // Chaves públicas não devem ser usadas no backend
        if (key.StartsWith("sb_publishable_", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                "Supabase:ServiceKey não pode ser a chave 'publishable' (pública). " +
                "Use a chave 'secret' em Project Settings → API → Secret keys no Supabase.");

        // Chaves anon (legacy) também não devem ser usadas no backend
        if (key.StartsWith("sb_anon_", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                "Supabase:ServiceKey não pode ser a chave 'anon' (legacy). " +
                "Use a chave 'secret' em Project Settings → API → Secret keys no Supabase.");

<<<<<<< HEAD
        // Validação positiva: secret (sb_secret_...), JWT (eyJ...) ou qualquer token longo com ponto (JWT)
        var isValidSecret = key.StartsWith("sb_secret_", StringComparison.OrdinalIgnoreCase) ||
                           key.StartsWith("eyJ", StringComparison.OrdinalIgnoreCase) ||
                           (key.Length > 80 && key.Contains('.'));
=======
        // Validação positiva: deve ser secret (sb_secret_...) ou service_role antigo (JWT eyJ...)
        var isValidSecret = key.StartsWith("sb_secret_", StringComparison.OrdinalIgnoreCase) ||
                           key.StartsWith("eyJ", StringComparison.OrdinalIgnoreCase);
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55

        if (!isValidSecret)
            throw new InvalidOperationException(
                "Supabase:ServiceKey deve ser uma chave 'secret' (formato sb_secret_...) ou 'service_role' (JWT). " +
                "Verifique em Project Settings → API → Secret keys no Supabase. " +
                "Use a chave service_role do projeto configurado em Supabase:Url. Veja docs/SUPABASE_PROJETO_MCP.md.");
    }

    private void ConfigureHttpClient()
    {
        _httpClient.BaseAddress = new Uri($"{_config.Url}/rest/v1/");
        _httpClient.DefaultRequestHeaders.Add("apikey", _config.ServiceKey);
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_config.ServiceKey}");
        _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
    }

    /// <summary>
    /// Obtém todos os registros de uma tabela com select, filtro, ordenação e limite opcionais.
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
        var query = BuildQuery(select, filter, orderBy, limit, offset);
        var url = $"{table}{query}";

        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Accept.ParseAdd("application/json");

        var response = await _httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        return JsonSerializer.Deserialize<List<T>>(content, _jsonOptions) ?? new List<T>();
    }

    /// <summary>
    /// Conta o número de registros que atendem ao filtro (usa HEAD + Prefer: count=exact).
    /// </summary>
    public async Task<int> CountAsync(
        string table,
        string? filter = null,
        CancellationToken cancellationToken = default)
    {
        var query = BuildQuery("*", filter);
        var url = $"{table}{query}";

        using var request = new HttpRequestMessage(HttpMethod.Head, url);
        request.Headers.Add("Prefer", "count=exact");

        var response = await _httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        if (response.Content.Headers.TryGetValues("Content-Range", out var values))
        {
            // Format: "0-N/total" or "*/total"
            var range = values.FirstOrDefault() ?? "";
            var slashIndex = range.LastIndexOf('/');
            if (slashIndex >= 0 && int.TryParse(range[(slashIndex + 1)..], out var total))
                return total;
        }

        return 0;
    }

    /// <summary>
    /// Obtém um único registro (ou null) de uma tabela com select e filtro opcionais.
    /// </summary>
    public async Task<T?> GetSingleAsync<T>(
        string table,
        string? select = "*",
        string? filter = null,
        CancellationToken cancellationToken = default)
    {
        var query = BuildQuery(select, filter);
        var url = $"{table}{query}";

        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Accept.ParseAdd("application/json");

        var response = await _httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        var list = JsonSerializer.Deserialize<List<T>>(content, _jsonOptions);
        return list is { Count: > 0 } ? list[0] : default;
    }

    public async Task<T> InsertAsync<T>(
        string table,
        object data,
        CancellationToken cancellationToken = default)
    {
        var json = JsonSerializer.Serialize(data, _jsonOptions);

        using var request = new HttpRequestMessage(HttpMethod.Post, table);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        request.Headers.Add("Prefer", "return=representation");

        var response = await _httpClient.SendAsync(request, cancellationToken);
        
        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException(
                $"Insert failed: {response.StatusCode}. Table: {table}. Error: {errorContent}. Payload: {json.Substring(0, Math.Min(500, json.Length))}");
        }

        var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
        var result = JsonSerializer.Deserialize<List<T>>(responseContent, _jsonOptions);
        
        if (result is null || result.Count == 0)
            throw new InvalidOperationException($"Insert failed: no data returned. Table: {table}. Payload: {json.Substring(0, Math.Min(500, json.Length))}");
        return result[0];
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
        var json = JsonSerializer.Serialize(data, _jsonOptions);
        var url = $"{table}?{filter}";

        using var request = new HttpRequestMessage(HttpMethod.Patch, url);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        request.Headers.Add("Prefer", "return=representation");

        var response = await _httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException(
                $"Supabase PATCH {table} failed: {response.StatusCode}. Response: {errorBody}");
        }

        var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
        var result = JsonSerializer.Deserialize<List<T>>(responseContent, _jsonOptions);
        if (result is null || result.Count == 0)
            return default!;
        return result[0];
    }

    /// <summary>
    /// Remove registros que atendem ao filtro.
    /// </summary>
    public async Task DeleteAsync(
        string table,
        string filter,
        CancellationToken cancellationToken = default)
    {
        var url = $"{table}?{filter}";
        var response = await _httpClient.DeleteAsync(url, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    private static string BuildQuery(string? select, string? filter, string? orderBy = null, int? limit = null, int? offset = null)
    {
        var parts = new List<string>();

        if (!string.IsNullOrWhiteSpace(select))
            parts.Add($"select={select}");

        if (!string.IsNullOrWhiteSpace(filter))
            parts.Add(filter);

        if (!string.IsNullOrWhiteSpace(orderBy))
            parts.Add($"order={orderBy}");

        if (limit.HasValue && limit.Value > 0)
            parts.Add($"limit={limit.Value}");

        if (offset.HasValue && offset.Value > 0)
            parts.Add($"offset={offset.Value}");

        return parts.Count > 0 ? "?" + string.Join("&", parts) : string.Empty;
    }
}
