#r "nuget: itext7, 8.0.5"
#r "nuget: itext7.bouncy-castle-adapter, 8.0.5"

using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Listener;
using iText.Signatures;
using iText.Bouncycastle.X509;

var pdfPath = "/tmp/receita_referencia.pdf";
using var reader = new PdfReader(pdfPath);
using var doc = new PdfDocument(reader);

Console.WriteLine("=== ANÁLISE DA RECEITA DE REFERÊNCIA ===\n");

// Info do PDF
var info = doc.GetDocumentInfo();
Console.WriteLine($"Título: {info.GetTitle()}");
Console.WriteLine($"Autor: {info.GetAuthor()}");
Console.WriteLine($"Criador: {info.GetCreator()}");
Console.WriteLine($"Produtor: {info.GetProducer()}");
Console.WriteLine($"Páginas: {doc.GetNumberOfPages()}");

// Extrair texto de cada página
for (int i = 1; i <= doc.GetNumberOfPages(); i++)
{
    Console.WriteLine($"\n--- PÁGINA {i} ---");
    var page = doc.GetPage(i);
    Console.WriteLine($"Tamanho: {page.GetPageSize().GetWidth()}x{page.GetPageSize().GetHeight()}");
    var text = PdfTextExtractor.GetTextFromPage(page, new SimpleTextExtractionStrategy());
    Console.WriteLine(text);
}

// Assinaturas
Console.WriteLine("\n--- ASSINATURAS ---");
var signUtil = new SignatureUtil(doc);
var sigNames = signUtil.GetSignatureNames();
Console.WriteLine($"Total: {sigNames.Count}");

foreach (var name in sigNames)
{
    var pkcs7 = signUtil.ReadSignatureData(name);
    Console.WriteLine($"\nAssinatura: {name}");
    Console.WriteLine($"  Hash: {pkcs7.GetDigestAlgorithmName()}");
    Console.WriteLine($"  Algo: {pkcs7.GetSignatureAlgorithmName()}");
    Console.WriteLine($"  Data: {pkcs7.GetSignDate():dd/MM/yyyy HH:mm:ss}");
    Console.WriteLine($"  Razão: {pkcs7.GetReason()}");
    Console.WriteLine($"  Local: {pkcs7.GetLocation()}");
    
    var tsd = pkcs7.GetTimeStampDate();
    if (tsd != DateTime.MinValue)
        Console.WriteLine($"  TSA: {tsd:dd/MM/yyyy HH:mm:ss}");
    
    var sc = pkcs7.GetSigningCertificate();
    if (sc is X509CertificateBC bc)
    {
        Console.WriteLine($"  Subject: {bc.GetCertificate().SubjectDN}");
        Console.WriteLine($"  Issuer: {bc.GetCertificate().IssuerDN}");
    }
    
    Console.WriteLine($"  Integridade: {pkcs7.VerifySignatureIntegrityAndAuthenticity()}");
    Console.WriteLine($"  Cobre tudo: {signUtil.SignatureCoversWholeDocument(name)}");
    
    var dict = signUtil.GetSignatureDictionary(name);
    Console.WriteLine($"  SubFilter: {dict?.GetAsName(PdfName.SubFilter)}");
    Console.WriteLine($"  Filter: {dict?.GetAsName(PdfName.Filter)}");
    
    var certs = pkcs7.GetCertificates();
    Console.WriteLine($"  Certs na cadeia: {certs.Length}");
}

// Formulários / campos
Console.WriteLine("\n--- CAMPOS DE FORMULÁRIO ---");
var acroForm = doc.GetCatalog().GetPdfObject().GetAsDictionary(PdfName.AcroForm);
if (acroForm != null)
{
    var fields = acroForm.GetAsArray(PdfName.Fields);
    Console.WriteLine($"Total de campos: {fields?.Size() ?? 0}");
}
