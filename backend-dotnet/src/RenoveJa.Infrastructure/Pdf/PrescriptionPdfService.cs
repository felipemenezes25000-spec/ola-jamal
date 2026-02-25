using System.Reflection;
using iText.IO.Font.Constants;
using iText.IO.Image;
using iText.Kernel.Colors;
using iText.Kernel.Font;
using iText.Kernel.Geom;
using iText.Kernel.Pdf;
using iText.Layout;
using iText.Layout.Borders;
using iText.Layout.Element;
using iText.Layout.Properties;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using QRCoder;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Infrastructure.Pdf;

/// <summary>
/// Serviço de geração de PDF de receitas médicas no padrão profissional de receita digital brasileira.
/// Layout: 1 medicamento por página, QR Code, rodapé legal ICP-Brasil, dados completos do paciente e médico.
/// O QR Code aponta para a URL de verificação configurável (Verification:BaseUrl). O Validador ITI (validar.iti.gov.br)
/// chama essa URL com _format=application/validador-iti+json e _secretCode para obter o PDF e validar PAdES.
/// </summary>
public class PrescriptionPdfService : IPrescriptionPdfService
{
    private readonly IStorageService _storageService;
    private readonly IDigitalCertificateService _certificateService;
    private readonly ILogger<PrescriptionPdfService> _logger;
    private readonly VerificationConfig _verificationConfig;

    // Identidade visual RenoveJá (alinhado ao app)
    private static readonly Color RenovejaPrimary = new DeviceRgb(14, 165, 233);    // #0EA5E9
    private static readonly Color RenovejaSecondary = new DeviceRgb(16, 185, 129);  // #10B981
    private static readonly Color RenovejaPrimaryDark = new DeviceRgb(2, 132, 199); // #0284C7
    private static readonly Color LightGrayBg = new DeviceRgb(248, 250, 252);       // #F8FAFC
    private static readonly Color MediumGray = new DeviceRgb(100, 116, 139);        // #64748B
    private static readonly Color DarkText = new DeviceRgb(30, 41, 59);             // #1E293B

    private const string DefaultVerificationBaseUrl = "https://renoveja.com/verificar";

    // Dados institucionais fixos da empresa
    private const string CompanyAddress = "Travessa Dona Paula · Higienópolis · São Paulo · SP · Brasil";
    private const string CompanyContact = "(11) 98631-8000 · www.renovejasaude.com.br · CNPJ 14.376.070/0001-53";
    private static readonly Color CompanyInfoColor = new DeviceRgb(85, 85, 85); // #555555

    private static byte[]? _logoCache;
    private static readonly object _logoLock = new();

    private static byte[]? LoadLogoImage()
    {
        if (_logoCache != null) return _logoCache;
        lock (_logoLock)
        {
            if (_logoCache != null) return _logoCache;
            try
            {
                var asm = Assembly.GetExecutingAssembly();
                var resourceName = asm.GetManifestResourceNames()
                    .FirstOrDefault(n => n.EndsWith("logo.png", StringComparison.OrdinalIgnoreCase));
                if (resourceName == null) return null;
                using var stream = asm.GetManifestResourceStream(resourceName);
                if (stream == null) return null;
                using var ms = new MemoryStream();
                stream.CopyTo(ms);
                _logoCache = ms.ToArray();
                return _logoCache;
            }
            catch
            {
                return null;
            }
        }
    }

    public PrescriptionPdfService(
        IStorageService storageService,
        IDigitalCertificateService certificateService,
        ILogger<PrescriptionPdfService> logger,
        IOptions<VerificationConfig> verificationConfig)
    {
        _storageService = storageService;
        _certificateService = certificateService;
        _logger = logger;
        _verificationConfig = verificationConfig?.Value ?? new VerificationConfig();
    }

    public Task<PrescriptionPdfResult> GenerateAsync(
        PrescriptionPdfData data,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var kind = data.PrescriptionKind ?? PrescriptionKind.Simple;
            var medicationItems = BuildMedicationItems(data);

            if (medicationItems.Count == 0)
            {
                medicationItems = new List<PrescriptionMedicationItem> { new("Prescrição a critério médico", null, "Conforme orientação médica", null, null) };
            }

            byte[] pdfBytes;
            using (var ms = new MemoryStream())
            {
                switch (kind)
                {
                    case PrescriptionKind.Antimicrobial:
                        RenderAntimicrobialPdf(ms, data, medicationItems);
                        break;
                    case PrescriptionKind.ControlledSpecial:
                        RenderControlledSpecialPdf(ms, data, medicationItems);
                        break;
                    default:
                        RenderSimplePdf(ms, data, medicationItems);
                        break;
                }
                pdfBytes = ms.ToArray();
            }

            return Task.FromResult(new PrescriptionPdfResult(true, pdfBytes, null, null));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar PDF de receita para solicitação {RequestId}", data.RequestId);
            return Task.FromResult(new PrescriptionPdfResult(false, null, null, $"Erro ao gerar PDF: {ex.Message}"));
        }
    }

    private (string verificationUrl, string accessCode) GetPdfUrls(PrescriptionPdfData data)
    {
        var baseUrl = !string.IsNullOrWhiteSpace(_verificationConfig.BaseUrl)
            ? _verificationConfig.BaseUrl.TrimEnd('/')
            : DefaultVerificationBaseUrl;
        var verificationUrl = data.VerificationUrl ?? $"{baseUrl}/{data.RequestId}";
        var accessCode = data.AccessCode ?? GenerateAccessCode(data.RequestId);
        return (verificationUrl, accessCode);
    }

    private void RenderSimplePdf(MemoryStream ms, PrescriptionPdfData data, List<PrescriptionMedicationItem> medicationItems)
    {
        var (verificationUrl, accessCode) = GetPdfUrls(data);
        using var writer = new PdfWriter(ms);
        using var pdf = new PdfDocument(writer);
        SetPdfMetadata(pdf, data, "simples");

        using var document = new Document(pdf, PageSize.A4);
        document.SetMargins(40, 40, 60, 40);

        var font = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);
        var fontBold = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
        var fontItalic = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_OBLIQUE);

        for (int i = 0; i < medicationItems.Count; i++)
        {
            if (i > 0) document.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));
            AddHeader(document, data, fontBold, font, i + 1, medicationItems.Count, "RECEITA SIMPLES");
            AddSeparator(document);
            AddPatientSection(document, data, fontBold, font, includeGenderAge: false);
            AddSeparator(document);
            AddMedicationSection(document, medicationItems[i], fontBold, font, fontItalic, i + 1);
            AddObservationSection(document, medicationItems[i], data, font, fontBold, fontItalic);
            AddQrCodeSection(document, verificationUrl, accessCode, font, fontBold);
            AddDoctorSection(document, data, fontBold, font);
            AddLegalFooter(document, data, font, fontItalic);
        }
        document.Close();
    }

    private void RenderAntimicrobialPdf(MemoryStream ms, PrescriptionPdfData data, List<PrescriptionMedicationItem> medicationItems)
    {
        var (verificationUrl, accessCode) = GetPdfUrls(data);
        using var writer = new PdfWriter(ms);
        using var pdf = new PdfDocument(writer);
        SetPdfMetadata(pdf, data, "antimicrobiana");

        using var document = new Document(pdf, PageSize.A4);
        document.SetMargins(40, 40, 60, 40);

        var font = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);
        var fontBold = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
        var fontItalic = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_OBLIQUE);

        var validityDate = data.EmissionDate.AddDays(10);
        var validityText = $"VALIDADE: 10 dias a contar da data de emissão (válida até {validityDate:dd/MM/yyyy})";

        for (int i = 0; i < medicationItems.Count; i++)
        {
            if (i > 0) document.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));
            AddHeader(document, data, fontBold, font, i + 1, medicationItems.Count, "RECEITA DE ANTIMICROBIANO - RDC 471/2021");
            AddSeparator(document);
            AddValidityNotice(document, validityText, fontBold, font);
            AddSeparator(document);
            AddPatientSection(document, data, fontBold, font, includeGenderAge: true);
            AddSeparator(document);
            AddMedicationSection(document, medicationItems[i], fontBold, font, fontItalic, i + 1);
            AddObservationSection(document, medicationItems[i], data, font, fontBold, fontItalic);
            AddQrCodeSection(document, verificationUrl, accessCode, font, fontBold);
            AddDoctorSection(document, data, fontBold, font);
            AddLegalFooter(document, data, font, fontItalic);
        }
        document.Close();
    }

    private void RenderControlledSpecialPdf(MemoryStream ms, PrescriptionPdfData data, List<PrescriptionMedicationItem> medicationItems)
    {
        var (verificationUrl, accessCode) = GetPdfUrls(data);
        using var writer = new PdfWriter(ms);
        using var pdf = new PdfDocument(writer);
        SetPdfMetadata(pdf, data, "controle especial");

        using var document = new Document(pdf, PageSize.A4);
        document.SetMargins(40, 40, 60, 40);

        var font = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);
        var fontBold = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
        var fontItalic = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_OBLIQUE);

        // Portaria SVS 344/98 art. 35: uma receita por medicamento controlado.
        // Cada medicamento gera uma página completa com formulário próprio.
        var validUntil = data.EmissionDate.AddDays(30).ToString("dd/MM/yyyy");

        for (int i = 0; i < medicationItems.Count; i++)
        {
            if (i > 0)
                document.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));

            AddSncrHeader(document, fontBold, font);
            AddSncrValidityBanner(document, validUntil, fontBold, font);
            AddSncrEmitenteSection(document, data, fontBold, font);
            AddSncrPatientSection(document, data, fontBold, font);
            AddSncrSingleMedicationSection(document, medicationItems[i], i + 1, medicationItems.Count, fontBold, font, fontItalic);
            AddQrCodeSection(document, verificationUrl, accessCode, font, fontBold);
            AddSncrDataSignatureSection(document, data, fontBold, font);
            AddLegalFooter(document, data, font, fontItalic);
        }

        // Segurança: se não há medicamentos, renderiza ao menos 1 página vazia do formulário
        if (medicationItems.Count == 0)
        {
            AddSncrHeader(document, fontBold, font);
            AddSncrValidityBanner(document, validUntil, fontBold, font);
            AddSncrEmitenteSection(document, data, fontBold, font);
            AddSncrPatientSection(document, data, fontBold, font);
            AddSncrCompradorSection(document, fontBold, font);
            AddSncrFornecedorSection(document, fontBold, font);
            AddSncrDataSignatureSection(document, data, fontBold, font);
        }

        document.Close();
    }

    private static void AddSncrValidityBanner(Document document, string validUntil, PdfFont fontBold, PdfFont font)
    {
        var banner = new Paragraph()
            .SetBackgroundColor(new DeviceRgb(255, 243, 205))
            .SetBorderLeft(new SolidBorder(new DeviceRgb(217, 119, 6), 3))
            .SetPaddingLeft(8)
            .SetPaddingTop(4)
            .SetPaddingBottom(4)
            .SetMarginBottom(6);
        banner.Add(new Text("⚠ VALIDADE: ").SetFont(fontBold).SetFontSize(9).SetFontColor(new DeviceRgb(146, 64, 14)));
        banner.Add(new Text($"Esta receita é válida por 30 (trinta) dias, até {validUntil} — Portaria SVS 344/98 art. 35 §3º")
            .SetFont(font).SetFontSize(9).SetFontColor(new DeviceRgb(120, 53, 15)));
        document.Add(banner);
    }

    private static void AddSncrSingleMedicationSection(Document document, PrescriptionMedicationItem med, int index, int total, PdfFont fontBold, PdfFont font, PdfFont fontItalic)
    {
        var label = total > 1 ? $"PRESCRIÇÃO — MEDICAMENTO {index} DE {total}" : "PRESCRIÇÃO";
        document.Add(new Paragraph(label).SetFont(fontBold).SetFontSize(8).SetFontColor(MediumGray).SetMarginBottom(6));

        var medWithExtenso = string.IsNullOrWhiteSpace(med.Quantity)
            ? med
            : med with { Quantity = $"{med.Quantity} ({QuantityToWords.Convert(med.Quantity)})" };
        AddMedicationSection(document, medWithExtenso, fontBold, font, fontItalic, 0);

        AddSeparator(document);
        AddSncrCompradorSection(document, fontBold, font);
        AddSncrFornecedorSection(document, fontBold, font);
    }

    private static void SetPdfMetadata(PdfDocument pdf, PrescriptionPdfData data, string tipo)
    {
        var info = pdf.GetDocumentInfo();
        info.SetTitle($"Receita Digital - {data.PatientName} - {data.EmissionDate:dd/MM/yyyy}");
        info.SetAuthor($"Dr(a). {data.DoctorName} | CRM {data.DoctorCrm}/{data.DoctorCrmState}");
        info.SetCreator("RenoveJá Saúde - Sistema de Receitas Digitais");
        info.SetSubject($"Receita médica digital - {tipo}");
        info.SetKeywords("receita digital, ICP-Brasil, RenoveJá Saúde, prescrição médica");
    }

    private void AddValidityNotice(Document document, string text, PdfFont fontBold, PdfFont font)
    {
        var p = new Paragraph(text).SetFont(fontBold).SetFontSize(10).SetFontColor(RenovejaPrimary).SetMarginBottom(6);
        document.Add(p);
    }

    private static void AddSncrHeader(Document document, PdfFont fontBold, PdfFont font)
    {
        var logoTable = new Table(UnitValue.CreatePercentArray(new float[] { 60, 40 })).UseAllAvailableWidth().SetMarginBottom(4);
        var logoCell = new Cell().SetBorder(Border.NO_BORDER).SetVerticalAlignment(VerticalAlignment.MIDDLE);

        var logoBytes = LoadLogoImage();
        if (logoBytes != null)
        {
            var logoImg = new Image(ImageDataFactory.Create(logoBytes))
                .SetWidth(80).SetMaxHeight(45)
                .SetAutoScaleHeight(true)
                .SetMarginBottom(2);
            logoCell.Add(logoImg);
        }
        else
        {
            var logoP = new Paragraph();
            logoP.Add(new Text("RenoveJá").SetFont(fontBold).SetFontSize(22).SetFontColor(RenovejaPrimary));
            logoP.Add(new Text(" Saúde").SetFont(fontBold).SetFontSize(22).SetFontColor(RenovejaSecondary));
            logoCell.Add(logoP);
        }

        logoCell.Add(new Paragraph(CompanyAddress).SetFont(font).SetFontSize(7).SetFontColor(CompanyInfoColor).SetMarginBottom(1));
        logoCell.Add(new Paragraph(CompanyContact).SetFont(font).SetFontSize(7).SetFontColor(CompanyInfoColor));
        logoTable.AddCell(logoCell);

        var rightCell = new Cell().SetBorder(Border.NO_BORDER).SetTextAlignment(TextAlignment.RIGHT).SetVerticalAlignment(VerticalAlignment.MIDDLE);
        rightCell.Add(new Paragraph("RECEITA DE CONTROLE ESPECIAL").SetFont(fontBold).SetFontSize(11).SetFontColor(DarkText).SetMarginBottom(2));
        rightCell.Add(new Paragraph("1ª VIA - FARMÁCIA / 2ª VIA - PACIENTE").SetFont(font).SetFontSize(8).SetFontColor(MediumGray));
        logoTable.AddCell(rightCell);
        document.Add(logoTable);
        AddSeparator(document);
    }

    private static void AddSncrEmitenteSection(Document document, PrescriptionPdfData data, PdfFont fontBold, PdfFont font)
    {
        document.Add(new Paragraph("IDENTIFICAÇÃO DO EMITENTE").SetFont(fontBold).SetFontSize(8).SetFontColor(MediumGray).SetMarginBottom(4));
        var doctorLine = $"Dr(a). {data.DoctorName} | CRM {data.DoctorCrm}/{data.DoctorCrmState}";
        if (!string.IsNullOrWhiteSpace(data.DoctorSpecialty))
            doctorLine += $" | {data.DoctorSpecialty}";
        document.Add(new Paragraph(doctorLine).SetFont(font).SetFontSize(10).SetFontColor(DarkText));
        if (!string.IsNullOrWhiteSpace(data.DoctorAddress))
            document.Add(new Paragraph($"Endereço: {data.DoctorAddress}").SetFont(font).SetFontSize(9).SetFontColor(MediumGray));
        if (!string.IsNullOrWhiteSpace(data.DoctorPhone))
            document.Add(new Paragraph($"Telefone: {data.DoctorPhone}").SetFont(font).SetFontSize(9).SetFontColor(MediumGray));
        AddSeparator(document);
    }

    private static void AddSncrPatientSection(Document document, PrescriptionPdfData data, PdfFont fontBold, PdfFont font)
    {
        document.Add(new Paragraph("IDENTIFICAÇÃO DO PACIENTE").SetFont(fontBold).SetFontSize(8).SetFontColor(MediumGray).SetMarginBottom(4));
        document.Add(new Paragraph(data.PatientName.ToUpperInvariant()).SetFont(fontBold).SetFontSize(11).SetFontColor(DarkText));
        if (!string.IsNullOrWhiteSpace(data.PatientCpf))
            document.Add(new Paragraph($"CPF: {FormatCpf(data.PatientCpf)}").SetFont(font).SetFontSize(9).SetFontColor(DarkText));
        if (data.PatientBirthDate.HasValue)
            document.Add(new Paragraph($"Nascimento: {data.PatientBirthDate.Value:dd/MM/yyyy}").SetFont(font).SetFontSize(9).SetFontColor(DarkText));
        if (!string.IsNullOrWhiteSpace(data.PatientAddress))
            document.Add(new Paragraph($"Endereço: {data.PatientAddress}").SetFont(font).SetFontSize(9).SetFontColor(DarkText));
        if (!string.IsNullOrWhiteSpace(data.PatientPhone))
            document.Add(new Paragraph($"Telefone: {data.PatientPhone}").SetFont(font).SetFontSize(9).SetFontColor(DarkText));
        AddSeparator(document);
    }

    private static void AddSncrPrescriptionSection(Document document, PrescriptionPdfData data, List<PrescriptionMedicationItem> items, PdfFont fontBold, PdfFont font, PdfFont fontItalic)
    {
        document.Add(new Paragraph("PRESCRIÇÃO").SetFont(fontBold).SetFontSize(8).SetFontColor(MediumGray).SetMarginBottom(6));
        foreach (var med in items)
        {
            // Para Controle Especial, exibir quantidade também por extenso (obrigatório ANVISA)
            var medWithExtenso = string.IsNullOrWhiteSpace(med.Quantity)
                ? med
                : med with { Quantity = $"{med.Quantity} ({QuantityToWords.Convert(med.Quantity)})" };
            AddMedicationSection(document, medWithExtenso, fontBold, font, fontItalic, 0);
        }
        AddSeparator(document);
        AddSncrCompradorSection(document, fontBold, font);
        AddSncrFornecedorSection(document, fontBold, font);
    }

    private static void AddSncrCompradorSection(Document document, PdfFont fontBold, PdfFont font)
    {
        document.Add(new Paragraph("IDENTIFICAÇÃO DO COMPRADOR").SetFont(fontBold).SetFontSize(8).SetFontColor(MediumGray).SetMarginBottom(4));

        var lines = new[]
        {
            "Nome Completo: _______________________________________________",
            "RG: ________________________  Órgão Emissor: _________________",
            "Endereço: ___________________________________________________",
            "Cidade: _______________________________  UF: _____  Tel: ___________"
        };

        foreach (var line in lines)
            document.Add(new Paragraph(line).SetFont(font).SetFontSize(9).SetFontColor(DarkText).SetMarginBottom(3));

        AddSeparator(document);
    }

    private static void AddSncrFornecedorSection(Document document, PdfFont fontBold, PdfFont font)
    {
        document.Add(new Paragraph("IDENTIFICAÇÃO DO FORNECEDOR").SetFont(fontBold).SetFontSize(8).SetFontColor(MediumGray).SetMarginBottom(4));

        var lines = new[]
        {
            "Nome Farmacêutico(a): _______________________  CRF: __________",
            "Nome da Farmácia: ___________________________  CNPJ: _________",
            "Endereço: ___________________________________________________",
            "Cidade: _______________________________  Tel: __________________",
            "Assinatura do(a) Farmacêutico(a): _______________________________"
        };

        foreach (var line in lines)
            document.Add(new Paragraph(line).SetFont(font).SetFontSize(9).SetFontColor(DarkText).SetMarginBottom(3));

        AddSeparator(document);
    }

    private static void AddSncrDataSignatureSection(Document document, PrescriptionPdfData data, PdfFont fontBold, PdfFont font)
    {
        AddSeparator(document);
        document.Add(new Paragraph($"Data: {data.EmissionDate:dd/MM/yyyy 'às' HH:mm}").SetFont(font).SetFontSize(9).SetFontColor(DarkText));
        document.Add(new Paragraph($"Assinatura: Dr(a). {data.DoctorName}").SetFont(fontBold).SetFontSize(10).SetFontColor(DarkText).SetMarginTop(4));
    }

    public async Task<PrescriptionPdfResult> GenerateAndUploadAsync(
        PrescriptionPdfData data,
        CancellationToken cancellationToken = default)
    {
        var result = await GenerateAsync(data, cancellationToken);

        if (!result.Success || result.PdfBytes == null)
            return result;

        var fileName = $"receitas/{data.RequestId}.pdf";
        var uploadResult = await _storageService.UploadAsync(
            fileName,
            result.PdfBytes,
            "application/pdf",
            cancellationToken);

        if (!uploadResult.Success)
            return new PrescriptionPdfResult(false, null, null, "Erro ao fazer upload do PDF.");

        return new PrescriptionPdfResult(true, result.PdfBytes, uploadResult.Url, null);
    }

    public async Task<PrescriptionPdfResult> SignAsync(
        byte[] pdfBytes,
        Guid certificateId,
        string outputFileName,
        CancellationToken cancellationToken = default)
    {
        var signatureResult = await _certificateService.SignPdfAsync(
            certificateId,
            pdfBytes,
            outputFileName,
            null,
            cancellationToken);

        if (!signatureResult.Success)
            return new PrescriptionPdfResult(false, null, null, signatureResult.ErrorMessage);

        return new PrescriptionPdfResult(true, null, signatureResult.SignedDocumentUrl, null);
    }

    public Task<PrescriptionPdfResult> GenerateExamRequestAsync(
        ExamPdfData data,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var exams = data.Exams?.Where(e => !string.IsNullOrWhiteSpace(e)).ToList() ?? new List<string>();
            if (exams.Count == 0)
                exams = new List<string> { "Exames conforme solicitação médica" };

            var accessCode = data.AccessCode ?? GenerateAccessCode(data.RequestId);
            var baseUrl = !string.IsNullOrWhiteSpace(_verificationConfig.BaseUrl)
                ? _verificationConfig.BaseUrl.TrimEnd('/')
                : DefaultVerificationBaseUrl;
            var verificationUrl = $"{baseUrl}/{data.RequestId}";

            using var ms = new MemoryStream();
            using var writer = new PdfWriter(ms);
            using var pdf = new PdfDocument(writer);

            var info = pdf.GetDocumentInfo();
            info.SetTitle($"Solicitação de Exames Médicos - {data.PatientName} - {data.EmissionDate:dd/MM/yyyy}");
            info.SetAuthor($"Dr(a). {data.DoctorName} | CRM {data.DoctorCrm}/{data.DoctorCrmState}");
            info.SetCreator("RenoveJá Saúde - Conforme Res. CFM 2.381/2024 e RDC ANVISA 786/2023");
            info.SetSubject("Solicitação de exames médicos — documento válido para laboratórios clínicos (CFM, ANVISA, ICP-Brasil)");

            using var document = new Document(pdf, PageSize.A4);
            document.SetMargins(40, 40, 60, 40);

            var font = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);
            var fontBold = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
            var fontItalic = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_OBLIQUE);

            AddExamHeader(document, fontBold, font);
            AddSeparator(document);
            AddPatientSectionFromExam(document, data, fontBold, font);
            AddSeparator(document);
            AddExamListSection(document, exams, data.Notes, fontBold, font, fontItalic);
            AddQrCodeSectionFromExam(document, verificationUrl, accessCode, font, fontBold);
            AddDoctorSectionFromExam(document, data, fontBold, font);
            AddLegalFooterFromExam(document, data, font, fontItalic);

            document.Close();

            return Task.FromResult(new PrescriptionPdfResult(true, ms.ToArray(), null, null));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar PDF de pedido de exame para solicitação {RequestId}", data.RequestId);
            return Task.FromResult(new PrescriptionPdfResult(false, null, null, $"Erro ao gerar PDF: {ex.Message}"));
        }
    }

    private static void AddExamHeader(Document document, PdfFont fontBold, PdfFont font)
    {
        var logoTable = new Table(UnitValue.CreatePercentArray(new float[] { 60, 40 }))
            .UseAllAvailableWidth()
            .SetMarginBottom(4);

        var logoCell = new Cell().SetBorder(Border.NO_BORDER).SetVerticalAlignment(VerticalAlignment.MIDDLE);

        var logoBytes = LoadLogoImage();
        if (logoBytes != null)
        {
            var logoImg = new Image(ImageDataFactory.Create(logoBytes))
                .SetWidth(80).SetMaxHeight(45)
                .SetAutoScaleHeight(true)
                .SetMarginBottom(2);
            logoCell.Add(logoImg);
        }
        else
        {
            var logoParagraph = new Paragraph();
            logoParagraph.Add(new Text("RenoveJá").SetFont(fontBold).SetFontSize(20).SetFontColor(RenovejaPrimary));
            logoParagraph.Add(new Text(" Saúde").SetFont(fontBold).SetFontSize(20).SetFontColor(RenovejaSecondary));
            logoCell.Add(logoParagraph);
        }

        logoCell.Add(new Paragraph(CompanyAddress).SetFont(font).SetFontSize(7).SetFontColor(CompanyInfoColor).SetMarginBottom(1));
        logoCell.Add(new Paragraph(CompanyContact).SetFont(font).SetFontSize(7).SetFontColor(CompanyInfoColor));
        logoTable.AddCell(logoCell);

        var rightCell = new Cell()
            .SetBorder(Border.NO_BORDER)
            .SetTextAlignment(TextAlignment.RIGHT)
            .SetVerticalAlignment(VerticalAlignment.MIDDLE);
        rightCell.Add(new Paragraph("SOLICITAÇÃO DE EXAMES MÉDICOS")
            .SetFont(fontBold)
            .SetFontSize(12)
            .SetFontColor(DarkText)
            .SetMarginBottom(2));
        rightCell.Add(new Paragraph("Conforme Resolução CFM nº 2.381/2024")
            .SetFont(font)
            .SetFontSize(8)
            .SetFontColor(MediumGray));
        logoTable.AddCell(rightCell);
        document.Add(logoTable);

        // Aviso normativo: documento médico com requisitos CFM
        var noticeCell = new Table(1).UseAllAvailableWidth().SetMarginBottom(6);
        var notice = new Cell()
            .SetBorder(Border.NO_BORDER)
            .SetBackgroundColor(new DeviceRgb(248, 250, 252))
            .SetPadding(6);
        notice.Add(new Paragraph("Documento médico para solicitação de exames. Contém identificação do médico (CRM/UF), do paciente (nome e CPF quando houver), data de emissão e espaço para assinatura qualificada. Válido para apresentação em laboratórios clínicos.")
            .SetFont(font).SetFontSize(7).SetFontColor(MediumGray));
        noticeCell.AddCell(notice);
        document.Add(noticeCell);
    }

    private static void AddPatientSectionFromExam(Document document, ExamPdfData data, PdfFont fontBold, PdfFont font)
    {
        var sectionTitle = new Paragraph("DADOS DO PACIENTE (identificação conforme Res. CFM nº 2.381/2024)")
            .SetFont(fontBold)
            .SetFontSize(8)
            .SetFontColor(MediumGray)
            .SetMarginBottom(4);
        document.Add(sectionTitle);

        var patientTable = new Table(UnitValue.CreatePercentArray(new float[] { 50, 50 }))
            .UseAllAvailableWidth()
            .SetMarginBottom(4);

        var nameCell = new Cell(1, 2).SetBorder(Border.NO_BORDER).SetPaddingBottom(4);
        nameCell.Add(new Paragraph(data.PatientName.ToUpperInvariant())
            .SetFont(fontBold)
            .SetFontSize(12)
            .SetFontColor(DarkText));
        patientTable.AddCell(nameCell);

        AddPatientInfoCell(patientTable, "CPF:", !string.IsNullOrWhiteSpace(data.PatientCpf) ? FormatCpf(data.PatientCpf) : "Não informado", fontBold, font);
        AddPatientInfoCell(patientTable, "Data de Nascimento:", data.PatientBirthDate.HasValue ? data.PatientBirthDate.Value.ToString("dd/MM/yyyy") : "Não informado", fontBold, font);
        AddPatientInfoCell(patientTable, "Telefone:", !string.IsNullOrWhiteSpace(data.PatientPhone) ? data.PatientPhone : "Não informado", fontBold, font);
        AddPatientInfoCell(patientTable, "Data de Emissão:", data.EmissionDate.ToString("dd/MM/yyyy 'às' HH:mm"), fontBold, font);

        if (!string.IsNullOrWhiteSpace(data.PatientAddress))
        {
            var addrCell = new Cell(1, 2).SetBorder(Border.NO_BORDER).SetPaddingBottom(2);
            var addrPara = new Paragraph();
            addrPara.Add(new Text("Endereço: ").SetFont(fontBold).SetFontSize(9).SetFontColor(MediumGray));
            addrPara.Add(new Text(data.PatientAddress).SetFont(font).SetFontSize(9).SetFontColor(DarkText));
            addrCell.Add(addrPara);
            patientTable.AddCell(addrCell);
        }

        if (!string.IsNullOrWhiteSpace(data.ClinicalIndication))
        {
            var cidCell = new Cell(1, 2).SetBorder(Border.NO_BORDER).SetPaddingBottom(2);
            var cidPara = new Paragraph();
            cidPara.Add(new Text("Indicação clínica / hipótese diagnóstica: ").SetFont(fontBold).SetFontSize(9).SetFontColor(MediumGray));
            cidPara.Add(new Text(data.ClinicalIndication).SetFont(font).SetFontSize(9).SetFontColor(DarkText));
            cidCell.Add(cidPara);
            patientTable.AddCell(cidCell);
        }

        document.Add(patientTable);
    }

    private static void AddExamListSection(Document document, List<string> exams, string? notes, PdfFont fontBold, PdfFont font, PdfFont fontItalic)
    {
        var sectionTitle = new Paragraph("EXAMES SOLICITADOS (para realização em laboratório clínico ou serviço de diagnóstico)")
            .SetFont(fontBold)
            .SetFontSize(8)
            .SetFontColor(MediumGray)
            .SetMarginBottom(6);
        document.Add(sectionTitle);

        var examTable = new Table(1).UseAllAvailableWidth().SetMarginBottom(8);
        var examCell = new Cell()
            .SetBackgroundColor(LightGrayBg)
            .SetBorder(Border.NO_BORDER)
            .SetPadding(12);

        foreach (var ex in exams)
        {
            examCell.Add(new Paragraph($"• {ex}").SetFont(font).SetFontSize(10).SetFontColor(DarkText).SetMarginBottom(2));
        }
        if (!string.IsNullOrWhiteSpace(notes))
        {
            examCell.Add(new Paragraph("Observações: " + notes).SetFont(fontItalic).SetFontSize(9).SetFontColor(MediumGray).SetMarginTop(6));
        }
        examTable.AddCell(examCell);
        document.Add(examTable);
    }

    private static void AddQrCodeSectionFromExam(Document document, string verificationUrl, string accessCode, PdfFont font, PdfFont fontBold)
    {
        // QR Code aponta apenas para a URL de verificação (sem código na URL).
        // O código de acesso é informado na tela de verificação pelo usuário.
        var qrBytes = GenerateQrCode(verificationUrl);
        if (qrBytes == null)
            return;

        var qrTable = new Table(UnitValue.CreatePercentArray(new float[] { 1, 1 }))
            .UseAllAvailableWidth()
            .SetMarginBottom(8);

        var textCell = new Cell().SetBorder(Border.NO_BORDER).SetVerticalAlignment(VerticalAlignment.MIDDLE);
        textCell.Add(new Paragraph("Autenticidade").SetFont(fontBold).SetFontSize(9).SetFontColor(DarkText).SetMarginBottom(4));
        textCell.Add(new Paragraph("Escaneie o QR Code para verificar a autenticidade deste documento.")
            .SetFont(font).SetFontSize(8).SetFontColor(MediumGray).SetMarginBottom(4));
        textCell.Add(new Paragraph($"Código de acesso: {accessCode}")
            .SetFont(fontBold).SetFontSize(9).SetFontColor(RenovejaPrimary));
        qrTable.AddCell(textCell);

        var qrCell = new Cell().SetBorder(Border.NO_BORDER).SetTextAlignment(TextAlignment.RIGHT);
        var qrImage = new Image(iText.IO.Image.ImageDataFactory.Create(qrBytes)).SetWidth(90).SetHeight(90);
        qrCell.Add(qrImage);
        qrTable.AddCell(qrCell);
        document.Add(qrTable);
    }

    private static void AddDoctorSectionFromExam(Document document, ExamPdfData data, PdfFont fontBold, PdfFont font)
    {
        AddSeparator(document);

        var sectionTitle = new Paragraph("MÉDICO SOLICITANTE (Res. CFM nº 2.381/2024 — identificação, endereço e contato profissional)")
            .SetFont(fontBold)
            .SetFontSize(8)
            .SetFontColor(MediumGray)
            .SetMarginBottom(6);
        document.Add(sectionTitle);

        var signTable = new Table(UnitValue.CreatePercentArray(new float[] { 50, 50 }))
            .UseAllAvailableWidth()
            .SetMarginBottom(8);

        var signLineCell = new Cell()
            .SetBorder(Border.NO_BORDER)
            .SetTextAlignment(TextAlignment.CENTER);
        signLineCell.Add(new Paragraph("_____________________________________________")
            .SetFont(font).SetFontSize(10).SetFontColor(DarkText).SetMarginBottom(2));
        signLineCell.Add(new Paragraph($"Dr(a). {data.DoctorName}")
            .SetFont(fontBold).SetFontSize(10).SetFontColor(DarkText));
        var crmInfoPara = new Paragraph();
        crmInfoPara.Add(new Text($"CRM {data.DoctorCrm}/{data.DoctorCrmState}").SetFont(font).SetFontSize(9).SetFontColor(MediumGray));
        if (!string.IsNullOrWhiteSpace(data.DoctorSpecialty))
            crmInfoPara.Add(new Text($" · {data.DoctorSpecialty}").SetFont(font).SetFontSize(9).SetFontColor(MediumGray));
        signLineCell.Add(crmInfoPara);
        signLineCell.Add(new Paragraph("Assinatura digital conforme ICP-Brasil (aplicada ao documento assinado)")
            .SetFont(font).SetFontSize(7).SetFontColor(MediumGray).SetMarginTop(4));
        signTable.AddCell(signLineCell);

        var contactCell = new Cell()
            .SetBorder(Border.NO_BORDER)
            .SetTextAlignment(TextAlignment.LEFT)
            .SetVerticalAlignment(VerticalAlignment.MIDDLE)
            .SetPaddingLeft(16);
        contactCell.Add(new Paragraph("Endereço e contato profissional (obrigatórios conforme CFM):")
            .SetFont(fontBold).SetFontSize(8).SetFontColor(MediumGray).SetMarginBottom(4));
        if (!string.IsNullOrWhiteSpace(data.DoctorAddress))
            contactCell.Add(new Paragraph(data.DoctorAddress)
                .SetFont(font).SetFontSize(9).SetFontColor(DarkText).SetMarginBottom(2));
        else
            contactCell.Add(new Paragraph("—").SetFont(font).SetFontSize(9).SetFontColor(MediumGray).SetMarginBottom(2));
        if (!string.IsNullOrWhiteSpace(data.DoctorPhone))
            contactCell.Add(new Paragraph($"Tel.: {data.DoctorPhone}").SetFont(font).SetFontSize(9).SetFontColor(DarkText));
        else
            contactCell.Add(new Paragraph("Tel.: —").SetFont(font).SetFontSize(9).SetFontColor(MediumGray));

        signTable.AddCell(contactCell);
        document.Add(signTable);
    }

    private static void AddLegalFooterFromExam(Document document, ExamPdfData data, PdfFont font, PdfFont fontItalic)
    {
        AddSeparator(document);
        var legalText = new Paragraph().SetMarginTop(4);
        legalText.Add(new Text("Referências normativas: ").SetFont(fontItalic).SetFontSize(7).SetFontColor(MediumGray));
        legalText.Add(new Text("CFM — Resolução CFM nº 2.381/2024 (documentos médicos e prescrição). ")
            .SetFont(font).SetFontSize(7).SetFontColor(MediumGray));
        legalText.Add(new Text("ANVISA — RDC nº 786/2023 (requisitos para laboratórios clínicos). ")
            .SetFont(font).SetFontSize(7).SetFontColor(MediumGray));
        legalText.Add(new Text("ICP-Brasil / ITI — Assinatura digital; verificação em validar.iti.gov.br. ")
            .SetFont(font).SetFontSize(7).SetFontColor(MediumGray));
        legalText.Add(new Text("CFF — normas aplicáveis quando houver dispensação ou coleta em farmácia.\n")
            .SetFont(font).SetFontSize(7).SetFontColor(MediumGray));
        legalText.Add(new Text($"Documento emitido em {data.EmissionDate:dd/MM/yyyy 'às' HH:mm}. Assinatura digital aplicada conforme ICP-Brasil por Dr(a). {data.DoctorName}.")
            .SetFont(font).SetFontSize(7).SetFontColor(MediumGray));
        document.Add(legalText);
    }

    #region Page Sections

    private static void AddHeader(Document document, PrescriptionPdfData data, PdfFont fontBold, PdfFont font, int pageNum, int totalPages, string? typeLabelOverride = null)
    {
        var logoTable = new Table(UnitValue.CreatePercentArray(new float[] { 60, 40 }))
            .UseAllAvailableWidth()
            .SetMarginBottom(4);

        var logoCell = new Cell()
            .SetBorder(Border.NO_BORDER)
            .SetVerticalAlignment(VerticalAlignment.MIDDLE);

        var logoBytes = LoadLogoImage();
        if (logoBytes != null)
        {
            var logoImg = new Image(ImageDataFactory.Create(logoBytes))
                .SetWidth(80).SetMaxHeight(45)
                .SetAutoScaleHeight(true)
                .SetMarginBottom(2);
            logoCell.Add(logoImg);
        }
        else
        {
            var logoParagraph = new Paragraph();
            logoParagraph.Add(new Text("RenoveJá").SetFont(fontBold).SetFontSize(22).SetFontColor(RenovejaPrimary));
            logoParagraph.Add(new Text(" Saúde").SetFont(fontBold).SetFontSize(22).SetFontColor(RenovejaSecondary));
            logoCell.Add(logoParagraph);
        }

        logoCell.Add(new Paragraph(CompanyAddress).SetFont(font).SetFontSize(7).SetFontColor(CompanyInfoColor).SetMarginBottom(1));
        logoCell.Add(new Paragraph(CompanyContact).SetFont(font).SetFontSize(7).SetFontColor(CompanyInfoColor));
        logoTable.AddCell(logoCell);

        var typeLabel = typeLabelOverride ?? GetPrescriptionTypeLabel(data.PrescriptionType);
        var rightCell = new Cell()
            .SetBorder(Border.NO_BORDER)
            .SetTextAlignment(TextAlignment.RIGHT)
            .SetVerticalAlignment(VerticalAlignment.MIDDLE);

        rightCell.Add(new Paragraph(typeLabel)
            .SetFont(fontBold)
            .SetFontSize(11)
            .SetFontColor(DarkText)
            .SetMarginBottom(2));

        rightCell.Add(new Paragraph($"Medicamento {pageNum} de {totalPages}")
            .SetFont(font)
            .SetFontSize(8)
            .SetFontColor(MediumGray));

        logoTable.AddCell(rightCell);
        document.Add(logoTable);
    }

    private static void AddSeparator(Document document)
    {
        var separator = new Table(1).UseAllAvailableWidth()
            .SetMarginTop(8)
            .SetMarginBottom(8);
        var sepCell = new Cell()
            .SetBorder(Border.NO_BORDER)
            .SetBorderBottom(new SolidBorder(RenovejaPrimary, 0.8f))
            .SetHeight(1);
        separator.AddCell(sepCell);
        document.Add(separator);
    }

    private static void AddPatientSection(Document document, PrescriptionPdfData data, PdfFont fontBold, PdfFont font, bool includeGenderAge = false)
    {
        var sectionTitle = new Paragraph("DADOS DO PACIENTE")
            .SetFont(fontBold)
            .SetFontSize(8)
            .SetFontColor(MediumGray)
            .SetMarginBottom(4);
        document.Add(sectionTitle);

        // Patient info in a structured 2-column layout
        var patientTable = new Table(UnitValue.CreatePercentArray(new float[] { 50, 50 }))
            .UseAllAvailableWidth()
            .SetMarginBottom(4);

        // Name (bold, uppercase) - full width
        var nameCell = new Cell(1, 2)
            .SetBorder(Border.NO_BORDER)
            .SetPaddingBottom(4);
        nameCell.Add(new Paragraph(data.PatientName.ToUpperInvariant())
            .SetFont(fontBold)
            .SetFontSize(12)
            .SetFontColor(DarkText));
        patientTable.AddCell(nameCell);

        // CPF
        if (!string.IsNullOrWhiteSpace(data.PatientCpf))
        {
            AddPatientInfoCell(patientTable, "CPF:", FormatCpf(data.PatientCpf), fontBold, font);
        }
        else
        {
            AddPatientInfoCell(patientTable, "CPF:", "Não informado", fontBold, font);
        }

        // Sexo e idade (antimicrobiano - RDC 471/2021)
        if (includeGenderAge)
        {
            var genderDisplay = !string.IsNullOrWhiteSpace(data.PatientGender) ? data.PatientGender : "Não informado";
            AddPatientInfoCell(patientTable, "Sexo:", genderDisplay, fontBold, font);
            var ageDisplay = data.PatientBirthDate.HasValue
                ? $"{CalculateAge(data.PatientBirthDate.Value)} anos"
                : "Não informado";
            AddPatientInfoCell(patientTable, "Idade:", ageDisplay, fontBold, font);
        }

        // Birth date
        if (data.PatientBirthDate.HasValue)
        {
            AddPatientInfoCell(patientTable, "Nascimento:", data.PatientBirthDate.Value.ToString("dd/MM/yyyy"), fontBold, font);
        }
        else if (!includeGenderAge)
        {
            AddPatientInfoCell(patientTable, "Nascimento:", "Não informado", fontBold, font);
        }

        // Emission date
        AddPatientInfoCell(patientTable, "Data de Emissão:", data.EmissionDate.ToString("dd/MM/yyyy 'às' HH:mm"), fontBold, font);

        // Address (if provided)
        if (!string.IsNullOrWhiteSpace(data.PatientAddress))
        {
            AddPatientInfoCell(patientTable, "Endereço:", data.PatientAddress, fontBold, font);
        }
        else
        {
            var emptyCell = new Cell().SetBorder(Border.NO_BORDER);
            patientTable.AddCell(emptyCell);
        }

        // Phone
        if (!string.IsNullOrWhiteSpace(data.PatientPhone))
        {
            AddPatientInfoCell(patientTable, "Telefone:", data.PatientPhone, fontBold, font);
        }

        document.Add(patientTable);
    }

    private static void AddPatientInfoCell(Table table, string label, string value, PdfFont fontBold, PdfFont font)
    {
        var cell = new Cell()
            .SetBorder(Border.NO_BORDER)
            .SetPaddingBottom(2);

        var p = new Paragraph();
        p.Add(new Text(label + " ")
            .SetFont(fontBold)
            .SetFontSize(9)
            .SetFontColor(MediumGray));
        p.Add(new Text(value)
            .SetFont(font)
            .SetFontSize(9)
            .SetFontColor(DarkText));
        cell.Add(p);
        table.AddCell(cell);
    }

    private static void AddMedicationSection(Document document, PrescriptionMedicationItem med, PdfFont fontBold, PdfFont font, PdfFont fontItalic, int index)
    {
        var sectionTitle = new Paragraph("MEDICAMENTO")
            .SetFont(fontBold)
            .SetFontSize(8)
            .SetFontColor(MediumGray)
            .SetMarginBottom(6);
        document.Add(sectionTitle);

        // Medication box with light background
        var medTable = new Table(1).UseAllAvailableWidth()
            .SetMarginBottom(8);

        var medCell = new Cell()
            .SetBackgroundColor(LightGrayBg)
            .SetBorder(Border.NO_BORDER)
            .SetBorderLeft(new SolidBorder(RenovejaPrimary, 3))
            .SetPadding(12)
            .SetBorderRadius(new BorderRadius(6));

        // Medication name + presentation
        var nameText = med.Name;
        if (!string.IsNullOrWhiteSpace(med.Presentation))
        {
            nameText += $" — {med.Presentation}";
        }

        medCell.Add(new Paragraph(nameText)
            .SetFont(fontBold)
            .SetFontSize(13)
            .SetFontColor(DarkText)
            .SetMarginBottom(6));

        // Dosage / Posology
        if (!string.IsNullOrWhiteSpace(med.Dosage))
        {
            var dosageP = new Paragraph();
            dosageP.Add(new Text("Posologia: ")
                .SetFont(fontBold)
                .SetFontSize(10)
                .SetFontColor(MediumGray));
            dosageP.Add(new Text(med.Dosage)
                .SetFont(font)
                .SetFontSize(10)
                .SetFontColor(DarkText));
            medCell.Add(dosageP.SetMarginBottom(4));
        }

        // Quantity
        if (!string.IsNullOrWhiteSpace(med.Quantity))
        {
            var qtyP = new Paragraph();
            qtyP.Add(new Text("Quantidade: ")
                .SetFont(fontBold)
                .SetFontSize(10)
                .SetFontColor(MediumGray));
            qtyP.Add(new Text(med.Quantity)
                .SetFont(font)
                .SetFontSize(10)
                .SetFontColor(DarkText));
            medCell.Add(qtyP);
        }

        medTable.AddCell(medCell);
        document.Add(medTable);
    }

    private static void AddObservationSection(Document document, PrescriptionMedicationItem med, PrescriptionPdfData data, PdfFont font, PdfFont fontBold, PdfFont fontItalic)
    {
        var hasObservation = !string.IsNullOrWhiteSpace(med.Observation) || !string.IsNullOrWhiteSpace(data.AdditionalNotes);
        if (!hasObservation) return;

        document.Add(new Paragraph("OBSERVAÇÃO")
            .SetFont(fontBold)
            .SetFontSize(8)
            .SetFontColor(MediumGray)
            .SetMarginBottom(4));

        // Medication-specific observation
        if (!string.IsNullOrWhiteSpace(med.Observation))
        {
            document.Add(new Paragraph(med.Observation)
                .SetFont(fontItalic)
                .SetFontSize(9)
                .SetFontColor(DarkText)
                .SetMarginBottom(4));
        }

        // General additional notes
        if (!string.IsNullOrWhiteSpace(data.AdditionalNotes))
        {
            document.Add(new Paragraph(data.AdditionalNotes)
                .SetFont(fontItalic)
                .SetFontSize(9)
                .SetFontColor(DarkText)
                .SetMarginBottom(4));
        }

        AddSeparator(document);
    }

    private static void AddQrCodeSection(Document document, string verificationUrl, string accessCode, PdfFont font, PdfFont fontBold)
    {
        var qrBytes = GenerateQrCode(verificationUrl);
        if (qrBytes == null) return;

        var qrTable = new Table(UnitValue.CreatePercentArray(new float[] { 65, 35 }))
            .UseAllAvailableWidth()
            .SetMarginTop(10)
            .SetMarginBottom(10);

        // Left: Instructions
        var instructionsCell = new Cell()
            .SetBorder(Border.NO_BORDER)
            .SetVerticalAlignment(VerticalAlignment.MIDDLE);

        instructionsCell.Add(new Paragraph("VERIFICAÇÃO DA RECEITA")
            .SetFont(fontBold)
            .SetFontSize(8)
            .SetFontColor(MediumGray)
            .SetMarginBottom(6));

        var steps = new string[]
        {
            "1. Escaneie o QR Code ao lado",
            "2. Baixe o PDF da receita digital",
            $"3. Código de acesso: {accessCode}"
        };

        foreach (var step in steps)
        {
            instructionsCell.Add(new Paragraph(step)
                .SetFont(font)
                .SetFontSize(9)
                .SetFontColor(DarkText)
                .SetMarginBottom(2));
        }

        instructionsCell.Add(new Paragraph(verificationUrl)
            .SetFont(font)
            .SetFontSize(7)
            .SetFontColor(RenovejaSecondary)
            .SetMarginTop(4));

        qrTable.AddCell(instructionsCell);

        // Right: QR Code image
        var qrCell = new Cell()
            .SetBorder(Border.NO_BORDER)
            .SetTextAlignment(TextAlignment.RIGHT)
            .SetVerticalAlignment(VerticalAlignment.MIDDLE);

        var qrImage = new Image(iText.IO.Image.ImageDataFactory.Create(qrBytes))
            .SetWidth(90)
            .SetHeight(90);
        qrCell.Add(qrImage);
        qrTable.AddCell(qrCell);

        document.Add(qrTable);
    }

    private static void AddDoctorSection(Document document, PrescriptionPdfData data, PdfFont fontBold, PdfFont font)
    {
        AddSeparator(document);

        var doctorInfo = new Paragraph();
        doctorInfo.Add(new Text($"Dr(a). {data.DoctorName}")
            .SetFont(fontBold)
            .SetFontSize(10)
            .SetFontColor(DarkText));
        doctorInfo.Add(new Text($" | CRM {data.DoctorCrm} {data.DoctorCrmState}")
            .SetFont(font)
            .SetFontSize(10)
            .SetFontColor(MediumGray));

        if (!string.IsNullOrWhiteSpace(data.DoctorSpecialty))
        {
            doctorInfo.Add(new Text($" | {data.DoctorSpecialty}")
                .SetFont(font)
                .SetFontSize(9)
                .SetFontColor(MediumGray));
        }
        var hasExtra = !string.IsNullOrWhiteSpace(data.DoctorAddress) || !string.IsNullOrWhiteSpace(data.DoctorPhone);
        document.Add(doctorInfo.SetMarginBottom(hasExtra ? 2 : 6));
        if (!string.IsNullOrWhiteSpace(data.DoctorAddress))
            document.Add(new Paragraph($"Endereço: {data.DoctorAddress}").SetFont(font).SetFontSize(9).SetFontColor(MediumGray).SetMarginBottom(!string.IsNullOrWhiteSpace(data.DoctorPhone) ? 2 : 6));
        if (!string.IsNullOrWhiteSpace(data.DoctorPhone))
            document.Add(new Paragraph($"Telefone: {data.DoctorPhone}").SetFont(font).SetFontSize(9).SetFontColor(MediumGray).SetMarginBottom(6));
    }

    private static void AddLegalFooter(Document document, PrescriptionPdfData data, PdfFont font, PdfFont fontItalic)
    {
        AddSeparator(document);

        var legalText = new Paragraph()
            .SetMarginTop(4);

        legalText.Add(new Text("Importante: ")
            .SetFont(fontItalic)
            .SetFontSize(7)
            .SetFontColor(MediumGray));

        legalText.Add(new Text("Verifique a autenticidade e integridade do documento em: validar.iti.gov.br\n")
            .SetFont(font)
            .SetFontSize(7)
            .SetFontColor(MediumGray));

        legalText.Add(new Text($"Assinado digitalmente conforme ICP-Brasil (MP 2.200-2/2001) por Dr(a). {data.DoctorName} em {data.EmissionDate:dd/MM/yyyy 'às' HH:mm}.")
            .SetFont(font)
            .SetFontSize(7)
            .SetFontColor(MediumGray));

        document.Add(legalText);
    }

    #endregion

    #region Private Helpers

    /// <summary>
    /// Builds the list of medication items, supporting both old (string list) and new (typed items) formats.
    /// </summary>
    private static List<PrescriptionMedicationItem> BuildMedicationItems(PrescriptionPdfData data)
    {
        // Prefer new typed items if provided
        if (data.MedicationItems != null && data.MedicationItems.Count > 0)
        {
            return data.MedicationItems;
        }

        // Fallback: convert old string list to items
        return data.Medications
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Select(m => new PrescriptionMedicationItem(m))
            .ToList();
    }

    /// <summary>
    /// Generates a short access code from the request ID for verification.
    /// </summary>
    private static string GenerateAccessCode(Guid requestId)
    {
        var hash = requestId.GetHashCode();
        var code = Math.Abs(hash) % 1_000_000;
        return code.ToString("D6");
    }

    private static string GetPrescriptionTypeLabel(string prescriptionType)
    {
        return prescriptionType.ToLowerInvariant() switch
        {
            "simples" or "simple" => "RECEITA SIMPLES",
            "controlado" or "controlled" => "RECEITA DE CONTROLADO",
            "azul" or "blue" => "RECEITA AZUL - NOTIFICAÇÃO B",
            "antimicrobiano" => "RECEITA DE ANTIMICROBIANO",
            _ => "RECEITA MÉDICA"
        };
    }

    private static byte[]? GenerateQrCode(string data)
    {
        try
        {
            using var qrGenerator = new QRCodeGenerator();
            using var qrCodeData = qrGenerator.CreateQrCode(data, QRCodeGenerator.ECCLevel.Q);
            using var qrCode = new PngByteQRCode(qrCodeData);
            return qrCode.GetGraphic(20);
        }
        catch
        {
            return null;
        }
    }

    private static int CalculateAge(DateTime birthDate)
    {
        var today = DateTime.Today;
        var age = today.Year - birthDate.Year;
        if (birthDate.Date > today.AddYears(-age)) age--;
        return age;
    }

    private static string FormatCpf(string cpf)
    {
        cpf = cpf.Replace(".", "").Replace("-", "");
        if (cpf.Length != 11)
            return cpf;
        return $"{cpf[..3]}.{cpf[3..6]}.{cpf[6..9]}-{cpf[9..]}";
    }

    #endregion
}
