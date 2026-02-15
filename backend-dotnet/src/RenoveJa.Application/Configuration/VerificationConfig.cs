namespace RenoveJa.Application.Configuration;

/// <summary>
/// Configuração para verificação de receitas (QR Code, página de verificação, integração ITI).
/// Define a URL base onde o QR Code da receita aponta (ex: https://api.renovejasaude.com.br/api/verify ou domínio customizado).
/// </summary>
public class VerificationConfig
{
    public const string SectionName = "Verification";

    /// <summary>
    /// URL base para verificação (ex: https://api.renovejasaude.com.br/api/verify ou https://verificar.seudominio.com.br).
    /// O QR Code apontará para {BaseUrl}/{requestId}.
    /// O Validador ITI (validar.iti.gov.br) chama essa URL com _format=application/validador-iti+json e _secretCode para obter o PDF e validar.
    /// Se vazio, usa fallback https://renoveja.com/verificar (apenas para compatibilidade).
    /// </summary>
    public string BaseUrl { get; set; } = "";
}
