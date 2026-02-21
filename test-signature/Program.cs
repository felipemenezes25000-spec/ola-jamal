using System.Security.Cryptography.X509Certificates;
using iText.IO.Font.Constants;
using iText.IO.Image;
using iText.Kernel.Colors;
using iText.Kernel.Font;
using iText.Kernel.Geom;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Draw;
using iText.Layout;
using iText.Layout.Borders;
using iText.Layout.Element;
using iText.Layout.Properties;
using iText.Signatures;
using iText.Bouncycastle.Crypto;
using iText.Bouncycastle.X509;
using Org.BouncyCastle.Pkcs;
using QRCoder;
using Path = System.IO.Path;

Console.WriteLine("=== TESTE FINAL PAdES - Padrão Receita Digital Brasileira ===\n");

// Configurar via variáveis de ambiente ou argumentos de linha de comando.
// Nunca commitar valores reais neste arquivo.
var pfxPath = Environment.GetEnvironmentVariable("TEST_PFX_PATH")
    ?? args.FirstOrDefault()
    ?? throw new InvalidOperationException(
        "Caminho do PFX não informado. Use: TEST_PFX_PATH=/caminho/cert.pfx dotnet run\n" +
        "ou passe o caminho como primeiro argumento.");

var pfxPassword = Environment.GetEnvironmentVariable("TEST_PFX_PASSWORD")
    ?? throw new InvalidOperationException(
        "Senha do PFX não informada. Use: TEST_PFX_PASSWORD=sua-senha dotnet run");

var outputDir = Environment.GetEnvironmentVariable("TEST_OUTPUT_DIR")
    ?? Path.Combine(AppContext.BaseDirectory, "output");
Directory.CreateDirectory(outputDir);

var pfxBytes = File.ReadAllBytes(pfxPath);
using var cert = new X509Certificate2(pfxBytes, pfxPassword, X509KeyStorageFlags.Exportable);

var cnMatch = System.Text.RegularExpressions.Regex.Match(cert.Subject, @"CN=([^:,]+)");
var certName = cnMatch.Success ? cnMatch.Groups[1].Value.Trim() : "MÉDICO TESTE";
var cpfMatch = System.Text.RegularExpressions.Regex.Match(cert.Subject, @":(\d{11})");
var cpf = cpfMatch.Success ? cpfMatch.Groups[1].Value : "";

Console.WriteLine($"Certificado: {certName} | ICP-Brasil | Válido até {cert.NotAfter:dd/MM/yyyy}");

// === Dados da receita (fixtures de teste — sem PII real) ===
var requestId = Guid.NewGuid();
var accessCode = new Random().Next(1000, 9999).ToString();
var emissionDate = DateTime.Now;
var doctorName = Environment.GetEnvironmentVariable("TEST_DOCTOR_NAME") ?? "Médico Teste Fictício";
var doctorCrm = Environment.GetEnvironmentVariable("TEST_DOCTOR_CRM") ?? "000000";
var doctorCrmState = Environment.GetEnvironmentVariable("TEST_DOCTOR_CRM_STATE") ?? "SP";
var doctorSpecialty = "Clínica Geral";
var patientName = "PACIENTE FICTÍCIO TESTE";
var patientCpf = "000.000.000-00";
var patientBirthDate = "01/01/1990";
var patientAddress = "Rua Fictícia, 0, Bairro Teste - 00000-000, São Paulo - SP";

var medications = new[]
{
    (name: "Cloridrato de Ondansetrona 8 mg", presentation: "Comprimido orodispersível (10un)", 
     posology: "Colocar 1 comprimido de 8/8h sobre a língua se náusea.", quantity: "1 caixa"),
    (name: "Tiorfan 100 mg", presentation: "Cápsula dura (9un)", 
     posology: "Tomar 1 cápsula via oral de 8/8h por 3 dias (diminui a diarréia).", quantity: "1 caixa"),
    (name: "Paracetamol 750 mg", presentation: "Comprimido revestido (20un)", 
     posology: "Tomar 1 comprimido de 6/6 horas se febre ou dor.", quantity: "1 caixa"),
};

var observation = "Obs: caso tenha febre, tomar primeiro a dipirona e, caso a febre persista após 1h de tomar a medicação, tomar o paracetamol";

// QR Code
var verificationUrl = "https://validar.iti.gov.br";
var qrPayload = verificationUrl;

byte[] qrCodePng;
using (var qrGenerator = new QRCodeGenerator())
{
    using var qrCodeData = qrGenerator.CreateQrCode(qrPayload, QRCodeGenerator.ECCLevel.H);
    using var qrCode = new PngByteQRCode(qrCodeData);
    qrCodePng = qrCode.GetGraphic(20);
}

// ============================================
// GERAR PDF - 1 MEDICAMENTO POR PÁGINA
// ============================================
Console.WriteLine("\nGerando PDF...");
var unsignedPath = Path.Combine(outputDir, "receita_final_unsigned.pdf");
var signedPath = Path.Combine(outputDir, "receita_final_pades.pdf");

using (var ms = new MemoryStream())
{
    using var writer = new PdfWriter(ms);
    using var pdf = new PdfDocument(writer);

    pdf.GetDocumentInfo().SetTitle("Receita Médica Digital - RenoveJá Saúde");
    pdf.GetDocumentInfo().SetAuthor($"Dr(a). {doctorName}");
    pdf.GetDocumentInfo().SetCreator("RenoveJá Saúde - Plataforma de Telemedicina");
    pdf.GetDocumentInfo().SetSubject("Receituário Médico Eletrônico");
    pdf.GetDocumentInfo().SetKeywords("receita médica, ICP-Brasil, assinatura digital, PAdES, telemedicina");

    using var document = new Document(pdf, PageSize.A4);
    document.SetMargins(30, 35, 30, 35);

    var font = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);
    var fontBold = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
    var fontItalic = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_OBLIQUE);
    var primaryColor = new DeviceRgb(0, 140, 82); // Verde similar ao Docway
    var darkGray = new DeviceRgb(51, 51, 51);
    var mediumGray = new DeviceRgb(102, 102, 102);
    var lightGray = new DeviceRgb(245, 245, 245);

    for (int medIdx = 0; medIdx < medications.Length; medIdx++)
    {
        if (medIdx > 0) document.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));

        var med = medications[medIdx];

        // ─── LOGO / HEADER ───
        document.Add(new Paragraph("RenoveJá Saúde")
            .SetFont(fontBold).SetFontSize(22).SetFontColor(primaryColor)
            .SetMarginBottom(2));

        // ─── MEDICAMENTO ───
        document.Add(new Paragraph($"{med.name}, {med.presentation}")
            .SetFont(fontBold).SetFontSize(14).SetFontColor(darkGray)
            .SetMarginTop(20).SetMarginBottom(5));

        document.Add(new Paragraph(med.posology)
            .SetFont(font).SetFontSize(11).SetFontColor(darkGray)
            .SetMarginBottom(3));

        document.Add(new Paragraph(med.quantity)
            .SetFont(fontBold).SetFontSize(11).SetFontColor(darkGray)
            .SetMarginBottom(12));

        // ─── OBSERVAÇÃO ───
        document.Add(new Paragraph("Observação: " + observation)
            .SetFont(font).SetFontSize(9).SetFontColor(mediumGray)
            .SetBackgroundColor(lightGray).SetPadding(8)
            .SetMarginBottom(20));

        // ─── DADOS DO PACIENTE ───
        // Nome
        document.Add(new Paragraph("Paciente:").SetFont(font).SetFontSize(9).SetFontColor(mediumGray).SetMarginBottom(1));
        document.Add(new Paragraph(patientName).SetFont(fontBold).SetFontSize(12).SetFontColor(darkGray).SetMarginBottom(8));

        // Grid de dados
        var dataTable = new Table(UnitValue.CreatePercentArray(new float[] { 33, 33, 34 }))
            .UseAllAvailableWidth().SetMarginBottom(5);

        void AddDataField(Table table, string label, string value)
        {
            table.AddCell(new Cell().SetBorder(Border.NO_BORDER).SetPaddingBottom(8)
                .Add(new Paragraph(label).SetFont(font).SetFontSize(8).SetFontColor(mediumGray).SetMarginBottom(1))
                .Add(new Paragraph(value).SetFont(fontBold).SetFontSize(10).SetFontColor(darkGray)));
        }

        AddDataField(dataTable, "CPF do Paciente:", patientCpf);
        AddDataField(dataTable, "Nascimento:", patientBirthDate);
        AddDataField(dataTable, "Emissão:", emissionDate.ToString("dd/MM/yyyy - HH:mm:ss"));

        document.Add(dataTable);

        document.Add(new Paragraph("Endereço:").SetFont(font).SetFontSize(8).SetFontColor(mediumGray).SetMarginBottom(1));
        document.Add(new Paragraph(patientAddress).SetFont(font).SetFontSize(10).SetFontColor(darkGray).SetMarginBottom(15));

        // ─── QR CODE + INSTRUÇÕES ───
        document.Add(new LineSeparator(new SolidLine(0.5f)).SetMarginBottom(15));

        var qrTable = new Table(UnitValue.CreatePercentArray(new float[] { 25, 75 }))
            .UseAllAvailableWidth().SetMarginBottom(15);

        // QR Code
        qrTable.AddCell(new Cell().SetBorder(Border.NO_BORDER)
            .SetVerticalAlignment(VerticalAlignment.MIDDLE)
            .Add(new Paragraph("Você sabia que pode\nacessar esta receita\nno seu celular?")
                .SetFont(fontBold).SetFontSize(9).SetFontColor(primaryColor).SetMarginBottom(8))
            .Add(new iText.Layout.Element.Image(ImageDataFactory.Create(qrCodePng))
                .SetWidth(90).SetHeight(90)));

        // Instruções
        var instructionsCell = new Cell().SetBorder(Border.NO_BORDER).SetPaddingLeft(15);

        instructionsCell.Add(new Paragraph()
            .Add(new Text("1").SetFont(fontBold).SetFontSize(16).SetFontColor(primaryColor))
            .Add(new Text("  Escaneie o QR Code para validar a\n    autenticidade no site do governo:\n").SetFont(font).SetFontSize(9))
            .Add(new Text("    validar.iti.gov.br\n").SetFont(fontBold).SetFontSize(9).SetFontColor(primaryColor))
            .SetMarginBottom(8));

        instructionsCell.Add(new Paragraph()
            .Add(new Text("2").SetFont(fontBold).SetFontSize(16).SetFontColor(primaryColor))
            .Add(new Text("  No site, faça upload deste PDF para\n    verificar a assinatura digital ICP-Brasil").SetFont(font).SetFontSize(9))
            .SetMarginBottom(8));

        instructionsCell.Add(new Paragraph()
            .Add(new Text("3").SetFont(fontBold).SetFontSize(16).SetFontColor(primaryColor))
            .Add(new Text($"  Seu código de acesso é: ").SetFont(font).SetFontSize(9))
            .Add(new Text(accessCode).SetFont(fontBold).SetFontSize(11).SetFontColor(primaryColor)));

        qrTable.AddCell(instructionsCell);
        document.Add(qrTable);

        // ─── RODAPÉ LEGAL ───
        document.Add(new LineSeparator(new SolidLine(0.5f)).SetMarginBottom(8));

        document.Add(new Paragraph()
            .Add(new Text("Importante: ").SetFont(fontBold).SetFontSize(7.5f))
            .Add(new Text("Verifique a autenticidade e integridade do documento em: ").SetFont(font).SetFontSize(7.5f))
            .Add(new Text("validar.iti.gov.br").SetFont(fontBold).SetFontSize(7.5f).SetFontColor(primaryColor))
            .Add(new Text($" Assinado digitalmente conforme ICP-Brasil (MP 2.200-2/2001) por Dr(a). {doctorName} em {emissionDate:dd/MM/yyyy} - {emissionDate:HH:mm:ss}").SetFont(font).SetFontSize(7.5f))
            .SetMarginBottom(8));

        // ─── DADOS DO MÉDICO ───
        document.Add(new Paragraph($"Dr(a). {doctorName} | CRM {doctorCrm} {doctorCrmState}")
            .SetFont(fontBold).SetFontSize(9).SetFontColor(darkGray).SetMarginBottom(3));

        document.Add(new Paragraph("contato@renovejasaude.com.br    www.renovejasaude.com.br    Telefone: (11) 0000-0000")
            .SetFont(font).SetFontSize(7).SetFontColor(mediumGray).SetMarginBottom(3));

        document.Add(new Paragraph("Farmacêutico, valide a receita digital em https://farmacias.renovejasaude.com.br")
            .SetFont(fontBold).SetFontSize(7).SetFontColor(primaryColor));

        // Page number
        document.Add(new Paragraph($"{medIdx + 1}")
            .SetFont(font).SetFontSize(8).SetFontColor(mediumGray)
            .SetTextAlignment(TextAlignment.RIGHT).SetFixedPosition(
                pdf.GetDefaultPageSize().GetWidth() - 50, 15, 30));
    }

    document.Close();
    File.WriteAllBytes(unsignedPath, ms.ToArray());
    Console.WriteLine($"PDF gerado: {new FileInfo(unsignedPath).Length / 1024} KB, {medications.Length} páginas");
}

// ============================================
// ASSINAR COM PAdES ICP-Brasil
// ============================================
Console.WriteLine("\nAssinando com PAdES...");

using var pfxStream = new MemoryStream(pfxBytes);
var store = new Pkcs12StoreBuilder().Build();
store.Load(pfxStream, pfxPassword.ToCharArray());

string? keyAlias = null;
foreach (var alias in store.Aliases)
    if (store.IsKeyEntry(alias)) { keyAlias = alias; break; }

var pk = store.GetKey(keyAlias!);
var chainEntries = store.GetCertificateChain(keyAlias!);
Console.WriteLine($"Cadeia: {chainEntries.Length} certificados");

// TSA
ITSAClient? tsaClient = null;
foreach (var url in new[] { "http://timestamp.digicert.com", "http://timestamp.sectigo.com", "http://ts.ssl.com" })
{
    try { tsaClient = new TSAClientBouncyCastle(url); Console.WriteLine($"TSA: {url} ✅"); break; }
    catch { }
}

using (var inputStream = new FileStream(unsignedPath, FileMode.Open, FileAccess.Read, FileShare.Read))
using (var outputStream = new FileStream(signedPath, FileMode.Create, FileAccess.Write, FileShare.None))
{
    var reader = new PdfReader(inputStream);
    var signer = new PdfSigner(reader, outputStream, new StampingProperties());

    signer.SetReason($"Receita médica assinada digitalmente - RenoveJá Saúde - ICP-Brasil (MP 2.200-2/2001)");
    signer.SetLocation("Brasil");
    signer.SetContact($"Dr(a). {doctorName} - CRM {doctorCrm}/{doctorCrmState}");
    signer.SetFieldName($"RenoveJa_PAdES_{DateTime.UtcNow:yyyyMMddHHmmss}");

    var privateKeyWrapped = new PrivateKeyBC(pk.Key);
    var pks = new PrivateKeySignature(privateKeyWrapped, DigestAlgorithms.SHA256);
    var certArray = chainEntries.Select(c => new X509CertificateBC(c.Certificate)).ToArray();

    signer.SignDetached(pks, certArray, null, null, tsaClient, 0, PdfSigner.CryptoStandard.CADES);
}

Console.WriteLine($"PDF assinado: {new FileInfo(signedPath).Length / 1024} KB");

// ============================================
// VERIFICAR
// ============================================
Console.WriteLine("\nVerificando assinatura...");

using (var vr = new PdfReader(signedPath))
using (var vd = new PdfDocument(vr))
{
    var su = new SignatureUtil(vd);
    foreach (var name in su.GetSignatureNames())
    {
        var p = su.ReadSignatureData(name);
        Console.WriteLine($"  Hash:         {p.GetDigestAlgorithmName()}");
        Console.WriteLine($"  Assinatura:   {p.GetSignatureAlgorithmName()}");
        Console.WriteLine($"  Data:         {p.GetSignDate():dd/MM/yyyy HH:mm:ss}");
        
        var tsd = p.GetTimeStampDate();
        Console.WriteLine($"  TSA:          {(tsd != DateTime.MinValue ? tsd.ToString("dd/MM/yyyy HH:mm:ss") + " ✅" : "N/A")}");
        
        if (p.GetSigningCertificate() is X509CertificateBC bc)
            Console.WriteLine($"  Assinante:    {bc.GetCertificate().SubjectDN}");
        
        Console.WriteLine($"  Integridade:  {(p.VerifySignatureIntegrityAndAuthenticity() ? "VÁLIDA ✅" : "INVÁLIDA ❌")}");
        Console.WriteLine($"  Cobre tudo:   {su.SignatureCoversWholeDocument(name)}");
        
        var dict = su.GetSignatureDictionary(name);
        Console.WriteLine($"  SubFilter:    {dict?.GetAsName(PdfName.SubFilter)}");
        Console.WriteLine($"  Certs:        {p.GetCertificates().Length}");
    }
}

Console.WriteLine($"\n✅ PRONTO! PDF em: {signedPath}");
Console.WriteLine("Submeta em https://validar.iti.gov.br para validação oficial.");
