namespace RenoveJa.Application.Configuration;

/// <summary>
/// Configuração para integração com Daily.co (videochamada).
/// Variáveis de ambiente: DAILY_API_KEY, DAILY_DOMAIN (ex: "renove").
/// A URL base das salas será: https://{Domain}.daily.co/{roomName}
/// </summary>
public class DailyConfig
{
    /// <summary>API key do Daily.co (encontrada em Dashboard → Developers).</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Subdomínio do Daily (ex: "renove" → https://renove.daily.co/*).</summary>
    public string Domain { get; set; } = string.Empty;

    /// <summary>Prefixo para nomes de sala (evita colisão se usar múltiplos ambientes).</summary>
    public string RoomPrefix { get; set; } = "consult";

    /// <summary>Minutos até a sala expirar automaticamente (padrão: 120 = 2h).</summary>
    public int DefaultRoomExpiryMinutes { get; set; } = 120;

    /// <summary>Gera o nome da sala dado o requestId.</summary>
    public string GetRoomName(Guid requestId) => $"{RoomPrefix}-{requestId:N}";
}
