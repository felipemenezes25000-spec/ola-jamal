using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.Email;

public class SmtpEmailService(IOptions<SmtpConfig> config) : IEmailService
{
    public async Task SendPasswordResetEmailAsync(string toEmail, string userName, string resetLink, CancellationToken cancellationToken = default)
    {
        var cfg = config.Value;
        if (string.IsNullOrWhiteSpace(cfg.Host))
            throw new InvalidOperationException("Smtp:Host não configurado. Defina a seção Smtp em appsettings.");

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(cfg.FromName, cfg.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "RenoveJá - Redefinição de senha";

        var body = $@"
Olá, {userName}!

Você solicitou a redefinição de senha na RenoveJá.

Clique no link abaixo para criar uma nova senha (o link expira em 1 hora):

{resetLink}

Se você não solicitou essa alteração, ignore este e-mail. Sua senha permanecerá a mesma.

—
Equipe RenoveJá
".Trim();

        message.Body = new TextPart("plain") { Text = body };

        using var client = new SmtpClient();
        var secureSocketOptions = cfg.EnableSsl ? SecureSocketOptions.StartTlsWhenAvailable : SecureSocketOptions.None;
        await client.ConnectAsync(cfg.Host, cfg.Port, secureSocketOptions, cancellationToken);

        if (!string.IsNullOrWhiteSpace(cfg.UserName))
            await client.AuthenticateAsync(cfg.UserName, cfg.Password, cancellationToken);

        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}
