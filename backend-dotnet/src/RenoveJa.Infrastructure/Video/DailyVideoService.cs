using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.Video;

/// <summary>
/// Configuração do Daily.co para teleconsultas.
/// </summary>
public class DailyCoConfig
{
    public const string SectionName = "DailyCo";
    public string ApiKey { get; set; } = string.Empty;
}

/// <summary>
/// Implementação do serviço de vídeo usando a API Daily.co.
/// Documentação: https://docs.daily.co/reference/rest-api
/// </summary>
public class DailyVideoService : IDailyVideoService
{
    private const string ApiBaseUrl = "https://api.daily.co/v1";
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly DailyCoConfig _config;
    private readonly ILogger<DailyVideoService> _logger;

    public DailyVideoService(
        IHttpClientFactory httpClientFactory,
        IOptions<DailyCoConfig> config,
        ILogger<DailyVideoService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config.Value;
        _logger = logger;
    }

    public async Task<DailyRoomResult> CreateRoomAsync(
        string roomName,
        int expirationMinutes = 60,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_config.ApiKey) || _config.ApiKey.Contains("YOUR_"))
            {
                // Fallback: return a mock URL when API key is not configured
                _logger.LogWarning("Daily.co API key não configurado. Retornando URL simulada.");
                return new DailyRoomResult(
                    true,
                    roomName,
                    $"https://renoveja.daily.co/{roomName}",
                    null);
            }

            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _config.ApiKey);

            var expiryTimestamp = DateTimeOffset.UtcNow.AddMinutes(expirationMinutes).ToUnixTimeSeconds();

            var requestBody = new
            {
                name = roomName,
                privacy = "public",
                properties = new
                {
                    exp = expiryTimestamp,
                    enable_chat = true,
                    enable_screenshare = true,
                    max_participants = 2,
                    enable_recording = "cloud"
                }
            };

            var json = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
            });

            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{ApiBaseUrl}/rooms", content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                
                // If room already exists (409), get it instead
                if (response.StatusCode == System.Net.HttpStatusCode.BadRequest && errorBody.Contains("already-exists"))
                {
                    return await GetRoomAsync(roomName, cancellationToken);
                }

                _logger.LogWarning("Daily.co create room failed: {Status} {Body}", response.StatusCode, errorBody);
                return new DailyRoomResult(false, null, null, $"Erro ao criar sala: {response.StatusCode}");
            }

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            var name = root.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : roomName;
            var url = root.TryGetProperty("url", out var urlProp) ? urlProp.GetString() : $"https://renoveja.daily.co/{roomName}";

            _logger.LogInformation("Sala Daily.co criada: {RoomName} → {Url}", name, url);

            return new DailyRoomResult(true, name, url, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar sala Daily.co: {RoomName}", roomName);
            return new DailyRoomResult(false, null, null, $"Erro: {ex.Message}");
        }
    }

    public async Task<DailyRoomResult> GetRoomAsync(
        string roomName,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_config.ApiKey) || _config.ApiKey.Contains("YOUR_"))
            {
                return new DailyRoomResult(
                    true,
                    roomName,
                    $"https://renoveja.daily.co/{roomName}",
                    null);
            }

            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _config.ApiKey);

            var response = await client.GetAsync($"{ApiBaseUrl}/rooms/{roomName}", cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return new DailyRoomResult(false, null, null, "Sala não encontrada.");
            }

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            var name = root.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : roomName;
            var url = root.TryGetProperty("url", out var urlProp) ? urlProp.GetString() : null;

            return new DailyRoomResult(true, name, url, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter sala Daily.co: {RoomName}", roomName);
            return new DailyRoomResult(false, null, null, $"Erro: {ex.Message}");
        }
    }

    public async Task<bool> DeleteRoomAsync(
        string roomName,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_config.ApiKey) || _config.ApiKey.Contains("YOUR_"))
                return true;

            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _config.ApiKey);

            var response = await client.DeleteAsync($"{ApiBaseUrl}/rooms/{roomName}", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao deletar sala Daily.co: {RoomName}", roomName);
            return false;
        }
    }
}
