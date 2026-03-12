namespace RenoveJa.Application.Configuration;

/// <summary>
/// Configuração para integração com OpenAI e Gemini — leitura de receitas, anamnese e evidências.
/// Padrão: Gemini__ApiKey configurada → anamnese e evidências usam gemini-2.5-flash. Pronto.
/// OpenAI__ApiKey: receitas, exames, sugestão conduta, transcribe-test (Whisper).
/// </summary>
public class OpenAIConfig
{
    public const string SectionName = "OpenAI";

    public string ApiKey { get; set; } = string.Empty;
    /// <summary>Modelo padrão (fallback). Usado quando ModelAnamnesis/ModelEvidence não definidos.</summary>
    public string Model { get; set; } = "gpt-4o";
    /// <summary>Modelo para anamnese. Se vazio e Gemini__ApiKey configurada, usa gemini-2.5-flash.</summary>
    public string ModelAnamnesis { get; set; } = string.Empty;
    /// <summary>Modelo para evidências. Se vazio e Gemini__ApiKey configurada, usa gemini-2.5-flash.</summary>
    public string ModelEvidence { get; set; } = string.Empty;

    /// <summary>Chave da API Gemini (env: Gemini__ApiKey). Usada para anamnese e evidências quando configurada.</summary>
    public string GeminiApiKey { get; set; } = string.Empty;
    /// <summary>URL base da API Gemini (compatível OpenAI). Padrão: generativelanguage.googleapis.com/v1beta/openai</summary>
    public string GeminiApiBaseUrl { get; set; } = string.Empty;
}
