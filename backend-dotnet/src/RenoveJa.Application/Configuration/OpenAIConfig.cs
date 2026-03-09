namespace RenoveJa.Application.Configuration;

/// <summary>
/// Configuração para integração com OpenAI — leitura de receitas, anamnese e evidências.
/// Suporta modelo híbrido: ModelAnamnesis (rápido/barato) + ModelEvidence (preciso).
/// Chave: definir em appsettings ou variável de ambiente OpenAI__ApiKey (nunca commitar em repositório).
/// </summary>
public class OpenAIConfig
{
    public const string SectionName = "OpenAI";

    public string ApiKey { get; set; } = string.Empty;
    /// <summary>Modelo padrão (fallback). Usado quando ModelAnamnesis/ModelEvidence não definidos.</summary>
    public string Model { get; set; } = "gpt-4o";
    /// <summary>Modelo para anamnese na consulta. Se vazio, usa Model. Padrão: gpt-4o-mini.</summary>
    public string ModelAnamnesis { get; set; } = "gpt-4o-mini";
    /// <summary>Modelo para evidências científicas (tradução + relevância). Se vazio, usa Model. Padrão: gpt-4o.</summary>
    public string ModelEvidence { get; set; } = "gpt-4o";
}
