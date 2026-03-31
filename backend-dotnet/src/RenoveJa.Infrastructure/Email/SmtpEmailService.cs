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
        try
        {
            if (!string.IsNullOrWhiteSpace(cfg.UserName))
                await client.AuthenticateAsync(cfg.UserName, cfg.Password, cancellationToken);

            await client.SendAsync(message, cancellationToken);
        }
        finally
        {
            if (client.IsConnected)
                await client.DisconnectAsync(true, cancellationToken);
        }
    }

    public async Task SendContactFormEmailAsync(string name, string? cpf, string? cnpj, string email, string? phone, string message, CancellationToken cancellationToken = default)
    {
        var cfg = config.Value;
        if (string.IsNullOrWhiteSpace(cfg.Host))
            throw new InvalidOperationException("Smtp:Host não configurado. Defina a seção Smtp em appsettings.");

        var toEmail = string.IsNullOrWhiteSpace(cfg.ContactToEmail) ? "contato@renovejasaude.com.br" : cfg.ContactToEmail.Trim();

        var m = new MimeMessage();
        m.From.Add(new MailboxAddress(cfg.FromName, cfg.FromEmail));
        m.To.Add(MailboxAddress.Parse(toEmail));
        m.ReplyTo.Add(MailboxAddress.Parse(email));
        m.Subject = $"Contato - {name}";

        var html = $@"
<!DOCTYPE html>
<html>
<head>
  <meta charset=""utf-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1"">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 24px; background: #f5f5f5; }}
    .container {{ max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }}
    .header {{ background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: #fff; padding: 24px; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 1.5rem; font-weight: 600; }}
    .header p {{ margin: 8px 0 0; opacity: 0.9; font-size: 0.9rem; }}
    .body {{ padding: 24px; }}
    .field {{ margin-bottom: 16px; }}
    .label {{ font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 4px; }}
    .value {{ font-size: 1rem; color: #1e293b; }}
    .message-box {{ background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 8px; border-left: 4px solid #0d9488; }}
    .footer {{ padding: 16px 24px; background: #f8fafc; font-size: 0.8rem; color: #64748b; text-align: center; }}
    a {{ color: #0d9488; text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
  </style>
</head>
<body>
  <div class=""container"">
    <div class=""header"">
      <h1>RenoveJá+</h1>
      <p>Novo contato pelo site</p>
    </div>
    <div class=""body"">
      <div class=""field"">
        <div class=""label"">Nome</div>
        <div class=""value"">{System.Net.WebUtility.HtmlEncode(name)}</div>
      </div>
      {(string.IsNullOrWhiteSpace(cpf) ? "" : $@"<div class=""field"">
        <div class=""label"">CPF</div>
        <div class=""value"">{System.Net.WebUtility.HtmlEncode(cpf)}</div>
      </div>")}
      {(string.IsNullOrWhiteSpace(cnpj) ? "" : $@"<div class=""field"">
        <div class=""label"">CNPJ</div>
        <div class=""value"">{System.Net.WebUtility.HtmlEncode(cnpj)}</div>
      </div>")}
      <div class=""field"">
        <div class=""label"">E-mail</div>
        <div class=""value""><a href=""mailto:{System.Net.WebUtility.HtmlEncode(email)}"">{System.Net.WebUtility.HtmlEncode(email)}</a></div>
      </div>
      {(string.IsNullOrWhiteSpace(phone) ? "" : $@"<div class=""field"">
        <div class=""label"">Telefone</div>
        <div class=""value""><a href=""tel:{System.Net.WebUtility.HtmlEncode(phone)}"">{System.Net.WebUtility.HtmlEncode(phone)}</a></div>
      </div>")}
      <div class=""field"">
        <div class=""label"">Mensagem</div>
        <div class=""message-box"">{System.Net.WebUtility.HtmlEncode(message).Replace("\n", "<br>")}</div>
      </div>
    </div>
    <div class=""footer"">
      Enviado em {DateTime.Now:dd/MM/yyyy HH:mm} · <a href=""https://wa.me/5511986318000"">Responder no WhatsApp</a>
    </div>
  </div>
</body>
</html>".Trim();

        var builder = new BodyBuilder { HtmlBody = html };
        m.Body = builder.ToMessageBody();

        using var client = new SmtpClient();
        var secureSocketOptions = cfg.EnableSsl ? SecureSocketOptions.StartTlsWhenAvailable : SecureSocketOptions.None;
        await client.ConnectAsync(cfg.Host, cfg.Port, secureSocketOptions, cancellationToken);
        try
        {
            if (!string.IsNullOrWhiteSpace(cfg.UserName))
                await client.AuthenticateAsync(cfg.UserName, cfg.Password, cancellationToken);

            await client.SendAsync(m, cancellationToken);
        }
        finally
        {
            if (client.IsConnected)
                await client.DisconnectAsync(true, cancellationToken);
        }
    }
}
