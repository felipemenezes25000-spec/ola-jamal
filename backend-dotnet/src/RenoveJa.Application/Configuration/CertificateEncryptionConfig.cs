namespace RenoveJa.Application.Configuration;

/// <summary>
/// Configuração da chave de criptografia para certificados PFX.
/// Lida de appsettings.json seção "CertificateEncryption".
/// </summary>
public class CertificateEncryptionConfig
{
    public const string SectionName = "CertificateEncryption";

    /// <summary>
    /// Chave AES-256 em base64 (32 bytes = 256 bits).
    /// </summary>
    public string Key { get; set; } = string.Empty;
}
