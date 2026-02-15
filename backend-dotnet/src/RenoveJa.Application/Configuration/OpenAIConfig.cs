namespace RenoveJa.Application.Configuration;

/// <summary>
/// Configuração para integração com OpenAI (GPT-4o) — leitura de receitas e pedidos de exame.
/// Chave: definir em appsettings ou variável de ambiente OpenAI__ApiKey (nunca commitar em repositório).
/// </summary>
public class OpenAIConfig
{
    public const string SectionName = "OpenAI";

    public string ApiKey { get; set; } = string.Empty;
    /// <summary>Modelo a usar. Padrão: gpt-4o (com visão).</summary>
    public string Model { get; set; } = "gpt-4o";
}
