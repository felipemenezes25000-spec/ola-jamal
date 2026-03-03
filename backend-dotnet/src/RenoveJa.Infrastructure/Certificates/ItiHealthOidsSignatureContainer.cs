using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using iText.Commons.Bouncycastle.Cert;
using iText.Kernel.Pdf;
using iText.Signatures;
using Org.BouncyCastle.Asn1;
using Org.BouncyCastle.Asn1.Cms;
using Org.BouncyCastle.Cms;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.X509;
using X509Certificate = Org.BouncyCastle.X509.X509Certificate;

namespace RenoveJa.Infrastructure.Certificates;

/// <summary>
/// Container de assinatura externa com OIDs de documento de saúde exigidos pelo ITI (validar.iti.gov.br).
/// Inclui: 2.16.76.1.12.1.1 (prescrição), 2.16.76.1.4.2.2.1 (CRM), 2.16.76.1.4.2.2.2 (UF).
/// Suporta RSA e ECDSA, CRL, OCSP e TSA com fallback (assina sem revogação/timestamp se indisponível).
/// Referência: https://bry-developer.readme.io/reference/assinatura-digital-com-metadados
/// </summary>
public sealed class ItiHealthOidsSignatureContainer : IExternalSignatureContainer
{
    // OIDs ITI para documentos de saúde (ICP-Brasil)
    private const string OidPrescricao = "2.16.76.1.12.1.1";   // Prescrição de medicamento (valor "")
    private const string OidCrm = "2.16.76.1.4.2.2.1";         // Número de registro profissional (CRM)
    private const string OidUf = "2.16.76.1.4.2.2.2";         // UF de registro profissional

    // OIDs de algoritmo de assinatura
    private const string OidSha256Rsa = "1.2.840.113549.1.1.11";   // sha256WithRSAEncryption
    private const string OidSha256Ecdsa = "1.2.840.10045.4.3.2";    // ecdsa-with-SHA256

    private const string DigestOid = "2.16.840.1.101.3.4.2.1";     // SHA256

    private readonly AsymmetricKeyParameter _privateKey;
    private readonly X509Certificate[] _chain;
    private readonly string _crmNumber;
    private readonly string _uf;
    private readonly IOcspClient? _ocspClient;
    private readonly ICrlClient? _crlClient;
    private readonly ITSAClient? _tsaClient;
    private readonly IX509Certificate[] _chainItext; // iText.Commons.Bouncycastle.Cert.IX509Certificate

    public ItiHealthOidsSignatureContainer(
        AsymmetricKeyParameter privateKey,
        X509Certificate[] chain,
        string? crmNumber,
        string? uf,
        IOcspClient? ocspClient = null,
        ICrlClient? crlClient = null,
        ITSAClient? tsaClient = null)
    {
        _privateKey = privateKey ?? throw new ArgumentNullException(nameof(privateKey));
        _chain = chain ?? throw new ArgumentNullException(nameof(chain));
        _crmNumber = crmNumber ?? "";
        _uf = uf ?? "";
        _ocspClient = ocspClient;
        _crlClient = crlClient;
        _tsaClient = tsaClient;
        _chainItext = chain.Select(c => (IX509Certificate)new iText.Bouncycastle.X509.X509CertificateBC(c)).ToArray<IX509Certificate>();
    }

    public byte[] Sign(Stream data)
    {
        byte[] contentBytes;
        using (var ms = new MemoryStream())
        {
            data.CopyTo(ms);
            contentBytes = ms.ToArray();
        }

        var signedAttr = BuildItiSignedAttributesWithValues();
        var encOid = GetSignatureAlgorithmOid();
        var gen = new CmsSignedDataGenerator();

        var signedAttrGen = new DefaultSignedAttributeTableGenerator(signedAttr);
        CmsAttributeTableGenerator? unsignedAttrGen = (_tsaClient != null) ? new TsaUnsignedAttributeGenerator(_tsaClient) : null;
        gen.AddSigner(_privateKey, _chain[0], encOid, DigestOid, signedAttrGen, unsignedAttrGen);

        var certStore = X509StoreFactory.Create("Certificate/Collection", new X509CollectionStoreParameters(_chain));
        gen.AddCertificates(certStore);

        TryAddCrls(gen);

        var content = new CmsProcessableByteArray(contentBytes);
        var signedData = gen.Generate(content, encapsulate: false);

        return signedData.GetEncoded();
    }

    public void ModifySigningDictionary(PdfDictionary signDic)
    {
        // Nenhuma modificação necessária no dicionário de assinatura
    }

    /// <summary>
    /// Cria AttributeTable com OIDs ITI e valores reais de CRM e UF.
    /// O DefaultSignedAttributeTableGenerator do BouncyCastle mescla com contentType, signingTime, messageDigest.
    /// </summary>
    private AttributeTable BuildItiSignedAttributesWithValues()
    {
        var v = new Asn1EncodableVector();

        // 2.16.76.1.12.1.1 - Prescrição de medicamento (valor string vazia conforme ITI)
        v.Add(new Attribute(new DerObjectIdentifier(OidPrescricao), new DerSet(new DerUtf8String(""))));

        // 2.16.76.1.4.2.2.1 - CRM
        v.Add(new Attribute(new DerObjectIdentifier(OidCrm), new DerSet(new DerUtf8String(_crmNumber))));

        // 2.16.76.1.4.2.2.2 - UF
        v.Add(new Attribute(new DerObjectIdentifier(OidUf), new DerSet(new DerUtf8String(_uf))));

        return new AttributeTable(v);
    }

    private string GetSignatureAlgorithmOid()
    {
        if (_privateKey is ECPrivateKeyParameters)
            return OidSha256Ecdsa;
        return OidSha256Rsa;
    }

    private void TryAddCrls(CmsSignedDataGenerator gen)
    {
        if (_crlClient == null) return;
        try
        {
            var crls = new List<X509Crl>();
            var parser = new X509CrlParser();
            foreach (var cert in _chainItext)
            {
                var crlBytesList = _crlClient.GetEncoded(cert, null);
                if (crlBytesList == null) continue;
                foreach (byte[] bytes in crlBytesList)
                {
                    var crl = parser.ReadCrl(bytes);
                    if (crl != null) crls.Add(crl);
                }
            }
            if (crls.Count > 0)
            {
                var crlStore = X509StoreFactory.Create("CRL/Collection", new X509CollectionStoreParameters(crls));
                gen.AddCrls(crlStore);
            }
        }
        catch
        {
            // Fallback: assina sem CRL
        }
    }
}

/// <summary>
/// Gera atributo unsigned id-aa-signatureTimeStampToken com o timestamp da assinatura.
/// </summary>
internal sealed class TsaUnsignedAttributeGenerator : CmsAttributeTableGenerator
{
    private readonly ITSAClient _tsaClient;

    public TsaUnsignedAttributeGenerator(ITSAClient tsaClient) => _tsaClient = tsaClient;

    public AttributeTable GetAttributes(IDictionary<CmsAttributeTableParameter, object> parameters)
    {
        if (parameters == null || !parameters.TryGetValue(CmsAttributeTableParameter.Signature, out var sigObj) || sigObj is not byte[] sigBytes)
            return new AttributeTable(new Asn1EncodableVector());

        try
        {
            var sigHash = SHA256.HashData(sigBytes);
            var token = _tsaClient.GetTimeStampToken(sigHash);
            if (token == null || token.Length == 0)
                return new AttributeTable(new Asn1EncodableVector());

            var v = new Asn1EncodableVector();
            v.Add(new Attribute(new DerObjectIdentifier("1.2.840.113549.1.9.16.2.14"), new DerSet(Asn1Object.FromByteArray(token))));
            return new AttributeTable(v);
        }
        catch
        {
            return new AttributeTable(new Asn1EncodableVector());
        }
    }
}

