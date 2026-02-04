using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace RenoveJa.Infrastructure.Data.Supabase;

public class SupabaseClient
{
    private readonly HttpClient _httpClient;
    private readonly SupabaseConfig _config;
    private readonly JsonSerializerOptions _jsonOptions;

    public SupabaseClient(HttpClient httpClient, IOptions<SupabaseConfig> config)
    {
        _httpClient = httpClient;
        _config = config.Value;
        
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            WriteIndented = false
        };

        ConfigureHttpClient();
    }

    private void ConfigureHttpClient()
    {
        _httpClient.BaseAddress = new Uri($"{_config.Url}/rest/v1/");
        _httpClient.DefaultRequestHeaders.Add("apikey", _config.ServiceKey);
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_config.ServiceKey}");
    }

    public async Task<List<T>> GetAllAsync<T>(
        string table,
        string? select = "*",
        string? filter = null,
        CancellationToken cancellationToken = default)
    {
        var query = BuildQuery(select, filter);
        var url = $"{table}{query}";

        var response = await _httpClient.GetAsync(url, cancellationToken);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        return JsonSerializer.Deserialize<List<T>>(content, _jsonOptions) ?? new List<T>();
    }

    public async Task<T?> GetSingleAsync<T>(
        string table,
        string? select = "*",
        string? filter = null,
        CancellationToken cancellationToken = default)
    {
        var query = BuildQuery(select, filter);
        var url = $"{table}{query}";

        _httpClient.DefaultRequestHeaders.Add("Accept", "application/vnd.pgrst.object+json");
        
        try
        {
            var response = await _httpClient.GetAsync(url, cancellationToken);
            
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                return default;

            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            return JsonSerializer.Deserialize<T>(content, _jsonOptions);
        }
        finally
        {
            _httpClient.DefaultRequestHeaders.Remove("Accept");
        }
    }

    public async Task<T> InsertAsync<T>(
        string table,
        object data,
        CancellationToken cancellationToken = default)
    {
        var json = JsonSerializer.Serialize(data, _jsonOptions);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        _httpClient.DefaultRequestHeaders.Remove("Prefer");
        _httpClient.DefaultRequestHeaders.Add("Prefer", "return=representation");

        try
        {
            var response = await _httpClient.PostAsync(table, content, cancellationToken);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<List<T>>(responseContent, _jsonOptions);
            
            if (result is null || result.Count == 0)
                throw new InvalidOperationException("Insert failed");
            return result[0];
        }
        finally
        {
            _httpClient.DefaultRequestHeaders.Remove("Prefer");
        }
    }

    public async Task<T> UpdateAsync<T>(
        string table,
        string filter,
        object data,
        CancellationToken cancellationToken = default)
    {
        var json = JsonSerializer.Serialize(data, _jsonOptions);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        _httpClient.DefaultRequestHeaders.Remove("Prefer");
        _httpClient.DefaultRequestHeaders.Add("Prefer", "return=representation");

        try
        {
            var url = $"{table}?{filter}";
            var response = await _httpClient.PatchAsync(url, content, cancellationToken);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<List<T>>(responseContent, _jsonOptions);
            
            if (result is null || result.Count == 0)
                throw new InvalidOperationException("Update failed");
            return result[0];
        }
        finally
        {
            _httpClient.DefaultRequestHeaders.Remove("Prefer");
        }
    }

    public async Task DeleteAsync(
        string table,
        string filter,
        CancellationToken cancellationToken = default)
    {
        var url = $"{table}?{filter}";
        var response = await _httpClient.DeleteAsync(url, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    private static string BuildQuery(string? select, string? filter)
    {
        var parts = new List<string>();

        if (!string.IsNullOrWhiteSpace(select))
            parts.Add($"select={select}");

        if (!string.IsNullOrWhiteSpace(filter))
            parts.Add(filter);

        return parts.Count > 0 ? "?" + string.Join("&", parts) : string.Empty;
    }
}
