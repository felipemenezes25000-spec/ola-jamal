namespace RenoveJa.Application.Configuration;

/// <summary>
/// Configuração para verificação de receitas (QR Code, página de verificação, integração ITI).
/// <para>
/// O QR Code aponta para <c>{BaseUrl}/{requestId}</c> (endpoint da API).
/// O Validador ITI chama essa URL com <c>_format=application/validador-iti+json</c> e <c>_secretCode</c>.
/// Browsers normais são redirecionados para <c>{FrontendUrl}/{requestId}</c>.
/// </para>
/// </summary>
public class VerificationConfig
{
    public const string SectionName = "Verification";

    /// <summary>
    /// URL base do endpoint da API (codificada no QR Code).
    /// Ex: <c>https://api.renovejasaude.com.br/api/verify</c>.
    /// O QR apontará para <c>{BaseUrl}/{requestId}</c>.
    /// </summary>
    public string BaseUrl { get; set; } = "";

    /// <summary>
    /// URL base do frontend de verificação (para redirect de browsers e texto exibido no PDF).
    /// Ex: <c>https://renovejasaude.com.br/verify</c>.
    /// Se vazio, o redirect usa caminho relativo <c>/verify/{id}</c>.
    /// </summary>
    public string FrontendUrl { get; set; } = "";

    /// <summary>
    /// URL base para links curtos no QR Code (estilo Docway).
    /// Ex: <c>https://re.renoveja.com.br</c> ou <c>https://api.renovejasaude.com.br</c>.
    /// Quando configurado, o QR usa <c>{ShortUrlBase}/r/{encoded}</c> em vez da URL completa.
    /// O endpoint /r/{shortCode} redireciona para /api/verify/{id}.
    /// </summary>
    public string ShortUrlBase { get; set; } = "";

    /// <summary>
    /// Máximo de downloads de 2ª via por receita (anti-fraude). Padrão: 10.
    /// </summary>
    public int MaxDownloadsPerPrescription { get; set; } = 10;

    /// <summary>
    /// Máximo de downloads por documento médico (exames, atestados). Padrão: 10.
    /// </summary>
    public int MaxDownloadsPerDocument { get; set; } = 10;
}
