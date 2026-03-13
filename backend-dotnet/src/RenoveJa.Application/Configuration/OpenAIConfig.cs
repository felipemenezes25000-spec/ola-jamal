namespace RenoveJa.Application.Configuration;

/// <summary>
/// Configuração para integração com OpenAI (GPT) e Gemini — leitura de receitas, anamnese e evidências.
/// Padrão: OpenAI__ApiKey configurada → GPT-4o como principal. Gemini__ApiKey: fallback quando OpenAI falha ou ausente.
/// Transcrição: Daily.co (não Whisper).
/// </summary>
public class OpenAIConfig
{
    public const string SectionName = "OpenAI";

    public string ApiKey { get; set; } = string.Empty;
    /// <summary>Modelo padrão (principal). OpenAI GPT-4o.</summary>
    public string Model { get; set; } = "gpt-4o";
    /// <summary>Modelo para anamnese. Padrão: gpt-4o (OpenAI). Fallback Gemini se OpenAI__ApiKey ausente.</summary>
    public string ModelAnamnesis { get; set; } = "gpt-4o";
    /// <summary>Modelo para evidências. Padrão: gpt-4o (OpenAI). Fallback Gemini se OpenAI__ApiKey ausente.</summary>
    public string ModelEvidence { get; set; } = "gpt-4o";

    /// <summary>Chave da API Gemini (env: Gemini__ApiKey). Fallback quando OpenAI__ApiKey ausente ou falha.</summary>
    public string GeminiApiKey { get; set; } = string.Empty;
    /// <summary>URL base da API Gemini (compatível OpenAI). Padrão: generativelanguage.googleapis.com/v1beta/openai</summary>
    public string GeminiApiBaseUrl { get; set; } = string.Empty;
}
