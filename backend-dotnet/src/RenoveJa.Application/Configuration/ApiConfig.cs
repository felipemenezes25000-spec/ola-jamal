namespace RenoveJa.Application.Configuration;

/// <summary>
/// Configuração base da API (URL pública para links de documentos).
/// Quando ApiBaseUrl está definido, os links de PDF assinado usam o domínio próprio
/// (ex: https://renovejasaude.com.br/api/requests/{id}/document) em vez da URL direta do Supabase.
/// </summary>
public class ApiConfig
{
    public const string SectionName = "Api";

    /// <summary>
    /// URL base pública da API (ex: https://renovejasaude.com.br ou https://api.renovejasaude.com.br).
    /// Usado para gerar links de documentos com o domínio próprio.
    /// </summary>
    public string BaseUrl { get; set; } = "";

    /// <summary>
    /// Chave secreta para assinar tokens de acesso a documentos (HMAC).
    /// Necessária para links abertos em navegador (mobile usa Linking.openURL sem Bearer).
    /// </summary>
    public string DocumentTokenSecret { get; set; } = "";
}
