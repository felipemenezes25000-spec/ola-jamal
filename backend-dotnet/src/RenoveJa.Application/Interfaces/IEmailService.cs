namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de envio de e-mails (SMTP).
/// </summary>
public interface IEmailService
{
    /// <summary>
    /// Envia e-mail com link para redefinição de senha.
    /// </summary>
    Task SendPasswordResetEmailAsync(string toEmail, string userName, string resetLink, CancellationToken cancellationToken = default);

    /// <summary>
    /// Envia e-mail HTML de contato institucional (formulário da landing).
    /// </summary>
    Task SendContactFormEmailAsync(string name, string? cpf, string? cnpj, string email, string? phone, string message, CancellationToken cancellationToken = default);
}
