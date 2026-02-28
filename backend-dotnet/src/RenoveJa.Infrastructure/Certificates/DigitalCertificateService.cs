using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using iText.Kernel.Pdf;
using iText.Signatures;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using iText.Bouncycastle.Crypto;
using iText.Bouncycastle.X509;
using Org.BouncyCastle.Pkcs;
using Org.BouncyCastle.X509;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using X509Certificate = Org.BouncyCastle.X509.X509Certificate;

namespace RenoveJa.Infrastructure.Certificates;

/// <summary>
/// Implementação do serviço de certificados digitais ICP-Brasil.
/// Usa X509Certificate2 para validação e iText7 para assinatura de PDFs.
/// </summary>
public class DigitalCertificateService : IDigitalCertificateService
{
    private readonly ICertificateRepository _certificateRepository;
    private readonly IDoctorRepository _doctorRepository;
    private readonly IStorageService _storageService;
    private readonly ILogger<DigitalCertificateService> _logger;
    private readonly byte[] _encryptionKey;

    public DigitalCertificateService(
        ICertificateRepository certificateRepository,
        IDoctorRepository doctorRepository,
        IStorageService storageService,
        IOptions<CertificateEncryptionConfig> encryptionConfig,
        ILogger<DigitalCertificateService> logger)
    {
        _certificateRepository = certificateRepository;
        _doctorRepository = doctorRepository;
        _storageService = storageService;
        _logger = logger;
        _encryptionKey = Convert.FromBase64String(encryptionConfig.Value.Key);

        if (_encryptionKey.Length != 32)
            throw new InvalidOperationException("CertificateEncryption:Key must be a 32-byte (256-bit) base64-encoded key.");
    }

    public Task<CertificateValidationResult> ValidatePfxAsync(
        byte[] pfxBytes,
        string password,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Carrega o certificado PFX
            using var certificate = new X509Certificate2(pfxBytes, password, X509KeyStorageFlags.Exportable);
            
            // Verifica se tem chave privada
            if (!certificate.HasPrivateKey)
            {
                return Task.FromResult(new CertificateValidationResult(
                    false,
                    "Certificado não possui chave privada. O arquivo PFX deve conter a chave privada para assinatura.",
                    null, null, null, null, null, null, null, false, false));
            }

            var now = DateTime.UtcNow;
            var isExpired = certificate.NotAfter < now;
            var isNotYetValid = certificate.NotBefore > now;

            // Extrai informações do certificado
            var subjectName = certificate.Subject;
            var issuerName = certificate.Issuer;
            var serialNumber = certificate.SerialNumber;
            var notBefore = certificate.NotBefore.ToUniversalTime();
            var notAfter = certificate.NotAfter.ToUniversalTime();

            // Tenta extrair CPF e CRM do subject
            var cpf = ExtractCpfFromSubject(subjectName);
            var crmNumber = ExtractCrmFromSubject(subjectName);

            // Verifica se é ICP-Brasil
            var isIcpBrasil = IsIcpBrasilCertificate(certificate);

            // Validações
            var errors = new List<string>();

            if (isExpired)
                errors.Add("Certificado expirado.");

            if (isNotYetValid)
                errors.Add("Certificado ainda não é válido.");

            if (!isIcpBrasil)
                errors.Add("Certificado não é ICP-Brasil. Apenas certificados ICP-Brasil são aceitos.");

            // Verifica se a chave pode ser usada para assinatura
            var keyUsage = certificate.Extensions.OfType<X509KeyUsageExtension>().FirstOrDefault();
            if (keyUsage != null && !keyUsage.KeyUsages.HasFlag(X509KeyUsageFlags.DigitalSignature))
            {
                errors.Add("Certificado não permite uso para assinatura digital.");
            }

            return Task.FromResult(new CertificateValidationResult(
                errors.Count == 0,
                errors.Count > 0 ? string.Join(" ", errors) : null,
                subjectName,
                issuerName,
                serialNumber,
                notBefore,
                notAfter,
                cpf,
                crmNumber,
                isExpired,
                isIcpBrasil));
        }
        catch (CryptographicException ex)
        {
            _logger.LogWarning(ex, "Erro ao validar certificado PFX");
            return Task.FromResult(new CertificateValidationResult(
                false,
                "Senha incorreta ou arquivo PFX inválido.",
                null, null, null, null, null, null, null, false, false));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao validar certificado");
            return Task.FromResult(new CertificateValidationResult(
                false,
                $"Erro ao validar certificado: {ex.Message}",
                null, null, null, null, null, null, null, false, false));
        }
    }

    public async Task<(Guid CertificateId, CertificateValidationResult Validation)> UploadAndValidateAsync(
        Guid doctorProfileId,
        byte[] pfxBytes,
        string password,
        string fileName,
        CancellationToken cancellationToken = default)
    {
        // Valida primeiro
        var validation = await ValidatePfxAsync(pfxBytes, password, cancellationToken);
        
        if (!validation.IsValid)
        {
            return (Guid.Empty, validation);
        }

        // Verifica se o médico existe
        var doctor = await _doctorRepository.GetByIdAsync(doctorProfileId, cancellationToken);
        if (doctor == null)
        {
            return (Guid.Empty, new CertificateValidationResult(
                false,
                "Médico não encontrado.",
                null, null, null, null, null, null, null, false, false));
        }

        // Criptografa o PFX antes de armazenar
        var encryptedPfx = EncryptPfx(pfxBytes, password);

        // Faz upload do PFX criptografado para o storage
        var storagePath = $"certificates/{doctorProfileId}/{Guid.NewGuid()}.pfx.enc";
        var uploadResult = await _storageService.UploadAsync(
            storagePath,
            encryptedPfx,
            "application/octet-stream",
            cancellationToken);

        if (!uploadResult.Success)
        {
            return (Guid.Empty, new CertificateValidationResult(
                false,
                "Erro ao armazenar certificado.",
                null, null, null, null, null, null, null, false, false));
        }

        // Cria a entidade de certificado
        var certificate = DoctorCertificate.Create(
            doctorProfileId,
            validation.SubjectName!,
            validation.IssuerName!,
            validation.SerialNumber!,
            validation.NotBefore!.Value,
            validation.NotAfter!.Value,
            storagePath,
            fileName,
            validation.Cpf,
            validation.CrmNumber);

        certificate.MarkAsValidatedAtRegistration(validation.IsIcpBrasil ? "ICP-Brasil validado" : "Validado");

        // Salva no repositório
        certificate = await _certificateRepository.CreateAsync(certificate, cancellationToken);

        // Atualiza o médico com a referência ao certificado ativo
        doctor.SetActiveCertificate(certificate.Id);
        await _doctorRepository.UpdateAsync(doctor, cancellationToken);

        _logger.LogInformation("Certificado {CertificateId} registrado para médico {DoctorId}", 
            certificate.Id, doctorProfileId);

        return (certificate.Id, validation);
    }

    public async Task<DigitalSignatureResult> SignPdfAsync(
        Guid certificateId,
        byte[] pdfBytes,
        string outputFileName,
        string? pfxPassword = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var certificate = await _certificateRepository.GetByIdAsync(certificateId, cancellationToken);
            if (certificate == null)
            {
                return new DigitalSignatureResult(false, "Certificado não encontrado.", null, null, null);
            }

            if (!certificate.IsReadyForSigning())
            {
                return new DigitalSignatureResult(false, "Certificado não está pronto para assinatura.", null, null, null);
            }

            // Baixa o PFX criptografado do storage
            var encryptedPfxData = await _storageService.DownloadAsync(certificate.PfxStoragePath, cancellationToken);
            if (encryptedPfxData == null)
            {
                return new DigitalSignatureResult(false, "Arquivo do certificado não encontrado no storage.", null, null, null);
            }

            // Descriptografa o PFX (extrai bytes e senha armazenada)
            var (pfxBytes, storedPassword) = DecryptPfxFull(encryptedPfxData);
            // Prioriza a senha armazenada (validada no upload). Evita "PKCS12 key store MAC invalid" por diferença de whitespace/encoding na digitada.
            var passwordToUse = !string.IsNullOrWhiteSpace(storedPassword)
                ? storedPassword
                : (pfxPassword ?? "").Trim();
            if (string.IsNullOrWhiteSpace(passwordToUse))
            {
                return new DigitalSignatureResult(false, "Senha do certificado PFX é obrigatória para assinar. Envie PfxPassword no corpo da requisição.", null, null, null);
            }

            // Assina o PDF com iText7 + BouncyCastle
            var signedPdfBytes = SignPdfWithBouncyCastle(pfxBytes, passwordToUse, pdfBytes, certificate);

            // Upload do PDF assinado
            var signedPath = $"signed/{outputFileName}";
            var uploadResult = await _storageService.UploadAsync(
                signedPath,
                signedPdfBytes,
                "application/pdf",
                cancellationToken);

            if (!uploadResult.Success)
            {
                return new DigitalSignatureResult(false, "Erro ao armazenar PDF assinado.", null, null, null);
            }

            var signedAt = DateTime.UtcNow;
            var signatureId = $"SIG-{Guid.NewGuid():N}";

            _logger.LogInformation("PDF assinado com certificado {CertificateId}: {SignatureId}", 
                certificateId, signatureId);

            return new DigitalSignatureResult(true, null, uploadResult.Url, signatureId, signedAt);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao assinar PDF com certificado {CertificateId}", certificateId);
            var msg = ex.Message.Contains("MAC", StringComparison.OrdinalIgnoreCase) || ex.Message.Contains("password", StringComparison.OrdinalIgnoreCase)
                ? "Senha do certificado inválida. Use a mesma senha configurada no upload do certificado."
                : $"Erro ao assinar: {ex.Message}";
            return new DigitalSignatureResult(false, msg, null, null, null);
        }
    }

    public async Task<DigitalSignatureResult> SignPdfFromUrlAsync(
        Guid certificateId,
        string pdfUrl,
        string outputFileName,
        CancellationToken cancellationToken = default)
    {
        // Baixa o PDF da URL
        using var httpClient = new HttpClient();
        var pdfBytes = await httpClient.GetByteArrayAsync(pdfUrl, cancellationToken);
        
        return await SignPdfAsync(certificateId, pdfBytes, outputFileName, null, cancellationToken);
    }

    public async Task<bool> HasValidCertificateAsync(
        Guid doctorProfileId,
        CancellationToken cancellationToken = default)
    {
        var certificate = await _certificateRepository.GetActiveByDoctorIdAsync(doctorProfileId, cancellationToken);
        return certificate?.IsReadyForSigning() ?? false;
    }

    public async Task<Application.Interfaces.CertificateInfo?> GetActiveCertificateAsync(
        Guid doctorProfileId,
        CancellationToken cancellationToken = default)
    {
        var certificate = await _certificateRepository.GetActiveByDoctorIdAsync(doctorProfileId, cancellationToken);
        
        if (certificate == null)
            return null;

        var daysUntilExpiry = (int)(certificate.NotAfter - DateTime.UtcNow).TotalDays;

        return new Application.Interfaces.CertificateInfo(
            certificate.Id,
            certificate.SubjectName,
            certificate.IssuerName,
            certificate.NotBefore,
            certificate.NotAfter,
            certificate.IsValid && !certificate.IsExpired,
            certificate.IsExpired,
            daysUntilExpiry);
    }

    public async Task<bool> RevokeCertificateAsync(
        Guid certificateId,
        string reason,
        CancellationToken cancellationToken = default)
    {
        var certificate = await _certificateRepository.GetByIdAsync(certificateId, cancellationToken);
        if (certificate == null)
            return false;

        certificate.Revoke(reason);
        await _certificateRepository.UpdateAsync(certificate, cancellationToken);
        
        _logger.LogWarning("Certificado {CertificateId} revogado: {Reason}", certificateId, reason);
        
        return true;
    }

    #region PDF Signing with iText7 + BouncyCastle Adapter

    // TSA URLs for timestamping (fallback chain)
    private static readonly string[] TsaUrls = new[]
    {
        "http://timestamp.digicert.com",
        "http://tsa.starfieldtech.com",
        "http://timestamp.globalsign.com/tsa/r6advanced1"
    };

    /// <summary>
    /// Assina um PDF usando o PFX via iText7 BouncyCastle adapter.
    /// Padrão mais alto: PAdES (ISO/ETSI) com PKCS#7/CMS, SHA256, cadeia completa, timestamp TSA e revogação (OCSP + CRL) quando disponível.
    /// Aceito pelo validar.iti.gov.br (ICP-Brasil) e por validadores Adobe quando a cadeia e a revogação forem válidas.
    /// Em falha de OCSP/CRL (rede, AC indisponível), assina sem revogação embutida (fallback seguro).
    /// </summary>
    private byte[] SignPdfWithBouncyCastle(byte[] pfxBytes, string pfxPassword, byte[] pdfBytes, DoctorCertificate certificate)
    {
        // Load PKCS12 store with password (PFX is password-protected)
        using var pfxStream = new MemoryStream(pfxBytes);
        var store = new Pkcs12StoreBuilder().Build();
        store.Load(pfxStream, (pfxPassword ?? "").ToCharArray());

        // Find the key alias
        string? keyAlias = null;
        foreach (var alias in store.Aliases)
        {
            if (store.IsKeyEntry(alias))
            {
                keyAlias = alias;
                break;
            }
        }

        if (keyAlias == null)
            throw new InvalidOperationException("Nenhuma chave privada encontrada no certificado PFX.");

        var pk = store.GetKey(keyAlias);
        var chainEntries = store.GetCertificateChain(keyAlias);

        // Sign the PDF
        using var inputStream = new MemoryStream(pdfBytes);
        using var outputStream = new MemoryStream();

        var reader = new PdfReader(inputStream);
        var signer = new PdfSigner(reader, outputStream, new StampingProperties());

        // Configure signature metadata via PdfSigner (iText 8.x API)
        var doctorName = certificate.ExtractDoctorName() ?? "Médico";
        signer.SetReason($"Receita digital assinada conforme ICP-Brasil (MP 2.200-2/2001) - CRM {certificate.CrmNumber ?? "N/A"}");
        signer.SetLocation("RenoveJá Saúde - Sistema de Receitas Digitais");
        signer.SetContact(doctorName);

        signer.SetFieldName($"sig_{Guid.NewGuid():N}");

        // Wrap BouncyCastle types into iText adapter types
        var privateKeyWrapped = new PrivateKeyBC(pk.Key);
        var pks = new PrivateKeySignature(privateKeyWrapped, DigestAlgorithms.SHA256);

        // Full certificate chain (signing cert + intermediates + root)
        var certArray = chainEntries
            .Select(c => new X509CertificateBC(c.Certificate))
            .ToArray();

        // TSA for timestamping (recomendado para PAdES e validação Adobe)
        ITSAClient? tsaClient = CreateTsaClient();

        // Padrão mais alto: OCSP + CRL embutidos para revogação (Adobe e validadores exigem)
        // estimatedSize 32KB para caber cadeia + OCSP + CRL + timestamp. Fallback sem revogação se falhar.
        const int EstimatedSizeWithLtv = 32768;
        bool withRevocation = false;
        try
        {
            var crlList = new List<ICrlClient> { new CrlClientOnline(certArray) };
            var ocspClient = new OcspClientBouncyCastle();
            signer.SignDetached(pks, certArray, crlList, ocspClient, tsaClient, EstimatedSizeWithLtv, PdfSigner.CryptoStandard.CMS);
            withRevocation = true;
        }
        catch (Exception ex)
        {
            // iText7: após falha do primeiro SignDetached o documento fica "pre closed"; não reutilizar o mesmo signer.
            _logger.LogWarning(ex, "OCSP/CRL indisponível ou falha na revogação. Assinando sem revogação embutida (fallback com novo signer).");
            byte[] fallbackResult;
            using (var inputStream2 = new MemoryStream(pdfBytes))
            using (var outputStream2 = new MemoryStream())
            using (var reader2 = new PdfReader(inputStream2))
            {
                var signer2 = new PdfSigner(reader2, outputStream2, new StampingProperties());
                signer2.SetReason($"Receita digital assinada conforme ICP-Brasil (MP 2.200-2/2001) - CRM {certificate.CrmNumber ?? "N/A"}");
                signer2.SetLocation("RenoveJá Saúde - Sistema de Receitas Digitais");
                signer2.SetContact(certificate.ExtractDoctorName() ?? "Médico");
                signer2.SetFieldName($"sig_{Guid.NewGuid():N}");
                signer2.SignDetached(pks, certArray, null, null, tsaClient, EstimatedSizeWithLtv, PdfSigner.CryptoStandard.CMS);
                fallbackResult = outputStream2.ToArray();
            }
            return fallbackResult;
        }

        _logger.LogInformation(
            "PDF assinado com PAdES (PKCS#7/CMS), SHA256, cadeia de {ChainLength} certificado(s){Tsa}{Revocation}",
            certArray.Length,
            tsaClient != null ? ", com timestamp TSA" : ", sem timestamp TSA",
            withRevocation ? ", com OCSP/CRL" : ", sem OCSP/CRL (fallback)");

        return outputStream.ToArray();
    }

    /// <summary>
    /// Creates a TSA client for timestamping. Returns null if no TSA is reachable.
    /// </summary>
    private ITSAClient? CreateTsaClient()
    {
        try
        {
            // Use DigiCert as primary TSA (reliable, free)
            return new TSAClientBouncyCastle(TsaUrls[0]);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao criar cliente TSA para {Url}. Assinatura sem timestamp.", TsaUrls[0]);
            return null;
        }
    }

    #endregion

    #region Private Helpers

    private static string? ExtractCpfFromSubject(string subject)
    {
        var patterns = new[]
        {
            @"CPF[:\s]*(\d{11})",
            @"(\d{3}\.\d{3}\.\d{3}-\d{2})",
            @"OID\.2\.16\.76\.1\.3\.1=(\d+)"
        };

        foreach (var pattern in patterns)
        {
            var match = System.Text.RegularExpressions.Regex.Match(subject, pattern, 
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (match.Success)
            {
                var cpf = match.Groups[1].Value.Replace(".", "").Replace("-", "");
                return cpf.Length == 11 ? cpf : null;
            }
        }

        return null;
    }

    private static string? ExtractCrmFromSubject(string subject)
    {
        var patterns = new[]
        {
            @"CRM[:\s]*(\d+)[/\-]?([A-Z]{2})",
            @"OU=CRM[\-]?(\d+)[\-]?([A-Z]{2})"
        };

        foreach (var pattern in patterns)
        {
            var match = System.Text.RegularExpressions.Regex.Match(subject, pattern, 
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (match.Success)
            {
                return $"{match.Groups[1].Value}/{match.Groups[2].Value}";
            }
        }

        return null;
    }

    private static bool IsIcpBrasilCertificate(X509Certificate2 certificate)
    {
        var issuer = certificate.Issuer.ToUpperInvariant();
        var icpBrasilIndicators = new[]
        {
            "ICP-BRASIL",
            "ICP BRASIL",
            "ICPBRASIL",
            "AC RAIZ BRASIL",
            "AUTORIDADE CERTIFICADORA RAIZ BRASILEIRA",
            "CERTISIGN",
            "SERASA",
            "VALID",
            "SOLUTI",
            "PRIME",
            "CAIXA"
        };

        return icpBrasilIndicators.Any(ind => issuer.Contains(ind));
    }

    /// <summary>
    /// Criptografa o PFX original (bytes + password embarcada) com AES-256.
    /// Layout: [16 bytes IV] [4 bytes password length] [password bytes] [pfx bytes] — tudo criptografado após o IV.
    /// </summary>
    private byte[] EncryptPfx(byte[] pfxBytes, string password)
    {
        var passwordBytes = Encoding.UTF8.GetBytes(password);
        
        // Build payload: [4-byte password-len][password][pfx]
        var payload = new byte[4 + passwordBytes.Length + pfxBytes.Length];
        BitConverter.GetBytes(passwordBytes.Length).CopyTo(payload, 0);
        passwordBytes.CopyTo(payload, 4);
        pfxBytes.CopyTo(payload, 4 + passwordBytes.Length);

        using var aes = Aes.Create();
        aes.Key = _encryptionKey;
        aes.GenerateIV();
        
        using var encryptor = aes.CreateEncryptor();
        var encrypted = encryptor.TransformFinalBlock(payload, 0, payload.Length);
        
        // Prepend IV to encrypted data
        var result = new byte[aes.IV.Length + encrypted.Length];
        Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
        Buffer.BlockCopy(encrypted, 0, result, aes.IV.Length, encrypted.Length);
        
        return result;
    }

    /// <summary>
    /// Descriptografa para obter o PFX original e a senha armazenada.
    /// Usado na assinatura: a senha é necessária para carregar o PKCS12.
    /// </summary>
    private (byte[] PfxBytes, string? StoredPassword) DecryptPfxFull(byte[] encryptedData)
    {
        using var aes = Aes.Create();
        aes.Key = _encryptionKey;
        aes.IV = encryptedData.Take(16).ToArray();
        var ciphertext = encryptedData.Skip(16).ToArray();
        
        using var decryptor = aes.CreateDecryptor();
        var payload = decryptor.TransformFinalBlock(ciphertext, 0, ciphertext.Length);

        var passwordLen = BitConverter.ToInt32(payload, 0);
        var storedPassword = passwordLen > 0 && 4 + passwordLen <= payload.Length
            ? Encoding.UTF8.GetString(payload, 4, passwordLen)
            : null;
        var pfxStart = 4 + passwordLen;
        var pfxBytes = new byte[payload.Length - pfxStart];
        Buffer.BlockCopy(payload, pfxStart, pfxBytes, 0, pfxBytes.Length);
        return (pfxBytes, storedPassword);
    }

    #endregion
}
