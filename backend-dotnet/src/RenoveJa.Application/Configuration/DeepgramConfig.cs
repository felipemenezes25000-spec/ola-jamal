namespace RenoveJa.Application.Configuration;

/// <summary>
/// Configuração do Deepgram para transcrição de áudio (Speech-to-Text).
/// Variáveis de ambiente: DEEPGRAM_API_KEY, Deepgram__ApiKey; appsettings: Deepgram:ApiKey.
/// Model: nova-2 (estável) ou nova-3. Language: pt-BR.
/// </summary>
public class DeepgramConfig
{
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "nova-2";
    public string Language { get; set; } = "pt-BR";
}
