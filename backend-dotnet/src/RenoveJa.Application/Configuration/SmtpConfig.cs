namespace RenoveJa.Application.Configuration;

/// <summary>
/// Configuração SMTP para envio de e-mails (recuperação de senha, etc.).
/// </summary>
public class SmtpConfig
{
    public const string SectionName = "Smtp";

    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = "RenoveJá";
    /// <summary>URL base do front/app para o link de redefinição (ex.: https://app.renoveja.com.br/recuperar-senha).</summary>
    public string ResetPasswordBaseUrl { get; set; } = "https://renovejasaude.com.br/recuperar-senha";
}
