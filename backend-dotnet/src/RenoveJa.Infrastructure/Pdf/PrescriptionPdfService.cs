using System.Globalization;
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
using RenoveJa.Application;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Infrastructure.Pdf;

/// <summary>
/// Serviço de geração de PDF de receitas e pedidos de exame — layout profissional médico brasileiro.
/// Redesign v2: tipografia limpa, hierarquia visual, logo compacto, espaçamento consistente.
/// </summary>
public class PrescriptionPdfService : IPrescriptionPdfService
{
    private readonly IStorageService _storageService;
    private readonly IDigitalCertificateService _certificateService;
    private readonly ILogger<PrescriptionPdfService> _logger;
    private readonly VerificationConfig _verificationConfig;

    // ── Design tokens ──
    private static readonly Color Primary = new DeviceRgb(14, 165, 233);       // #0EA5E9 — azul RenoveJá
    private static readonly Color PrimaryDark = new DeviceRgb(2, 132, 199);    // #0284C7
    private static readonly Color Accent = new DeviceRgb(16, 185, 129);        // #10B981 — verde
    private static readonly Color BgLight = new DeviceRgb(248, 250, 252);      // #F8FAFC
    private static readonly Color BgWarm = new DeviceRgb(255, 251, 235);       // #FFFBEB — fundo amarelo suave
    private static readonly Color TextDark = new DeviceRgb(15, 23, 42);        // #0F172A
    private static readonly Color TextMedium = new DeviceRgb(71, 85, 105);     // #475569
    private static readonly Color TextLight = new DeviceRgb(148, 163, 184);    // #94A3B8
    private static readonly Color BorderLight = new DeviceRgb(226, 232, 240);  // #E2E8F0
    private static readonly Color DangerBg = new DeviceRgb(254, 242, 242);     // #FEF2F2
    private static readonly Color DangerText = new DeviceRgb(153, 27, 27);     // #991B1B
    private static readonly Color WarningBorder = new DeviceRgb(217, 119, 6);  // #D97706

    private const string DefaultVerificationBaseUrl = "https://renoveja.com/verificar";
    private const string CompanyLine1 = "Travessa Dona Paula · Higienópolis · São Paulo · SP · Brasil";
    private const string CompanyLine2 = "(11) 98631-8000 · www.renovejasaude.com.br · CNPJ 65.947.180/0001-69";

    // Logo
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
            catch { return null; }
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

    // ════════════════════════════════════════════════════
    //  PUBLIC API
    // ════════════════════════════════════════════════════

    public Task<PrescriptionPdfResult> GenerateAsync(
        PrescriptionPdfData data,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var kind = data.PrescriptionKind ?? PrescriptionKind.Simple;
            var meds = BuildMedicationItems(data);
            if (meds.Count == 0)
                meds = new List<PrescriptionMedicationItem> { new("Prescrição a critério médico", null, "Conforme orientação médica", null, null) };

            byte[] pdfBytes;
            using (var ms = new MemoryStream())
            {
                switch (kind)
                {
                    case PrescriptionKind.Antimicrobial:
                        RenderAntimicrobialPdf(ms, data, meds);
                        break;
                    case PrescriptionKind.ControlledSpecial:
                        RenderControlledSpecialPdf(ms, data, meds);
                        break;
                    default:
                        RenderSimplePdf(ms, data, meds);
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

    public async Task<PrescriptionPdfResult> GenerateAndUploadAsync(
        PrescriptionPdfData data, CancellationToken cancellationToken = default)
    {
        var result = await GenerateAsync(data, cancellationToken);
        if (!result.Success || result.PdfBytes == null) return result;

        var fileName = $"pedidos/{data.RequestId:N}/receita/gerado/receita-{data.RequestId:N}.pdf";
        var uploadResult = await _storageService.UploadAsync(fileName, result.PdfBytes, "application/pdf", cancellationToken);
        if (!uploadResult.Success) return new PrescriptionPdfResult(false, null, null, "Erro ao fazer upload do PDF.");
        return new PrescriptionPdfResult(true, result.PdfBytes, uploadResult.Url, null);
    }

    public async Task<PrescriptionPdfResult> SignAsync(
        byte[] pdfBytes, Guid certificateId, string outputFileName, CancellationToken cancellationToken = default)
    {
        var signatureResult = await _certificateService.SignPdfAsync(certificateId, pdfBytes, outputFileName, null, documentTypeHint: null, cancellationToken);
        if (!signatureResult.Success) return new PrescriptionPdfResult(false, null, null, signatureResult.ErrorMessage);
        return new PrescriptionPdfResult(true, null, signatureResult.SignedDocumentUrl, null);
    }

    public Task<PrescriptionPdfResult> GenerateExamRequestAsync(
        ExamPdfData data, CancellationToken cancellationToken = default)
    {
        try
        {
            var exams = data.Exams?.Where(e => !string.IsNullOrWhiteSpace(e)).ToList() ?? new List<string>();
            if (exams.Count == 0) exams = new List<string> { "Exames conforme solicitação médica" };

            var accessCode = data.AccessCode ?? GenerateAccessCode(data.RequestId);
            var apiBase = !string.IsNullOrWhiteSpace(_verificationConfig.BaseUrl)
                ? _verificationConfig.BaseUrl.TrimEnd('/')
                : DefaultVerificationBaseUrl;
            var frontendBase = !string.IsNullOrWhiteSpace(_verificationConfig.FrontendUrl)
                ? _verificationConfig.FrontendUrl.TrimEnd('/')
                : apiBase;
            string qrUrl;
            string displayUrl;
            if (!string.IsNullOrWhiteSpace(data.VerificationUrl))
            {
                qrUrl = displayUrl = data.VerificationUrl.Trim();
            }
            else
            {
                // type=exame conforme Guia ITI Cap. IV — necessário para validar.iti.gov.br identificar solicitação de exame
                qrUrl = $"{apiBase}/{data.RequestId}?type=exame";
                displayUrl = $"{frontendBase}/{data.RequestId}";
            }

            using var ms = new MemoryStream();
            using var writer = new PdfWriter(ms);
            using var pdf = new PdfDocument(writer);
            SetMetadata(pdf, $"Solicitação de Exames - {data.PatientName}", data.DoctorName, data.DoctorCrm, data.DoctorCrmState, "exames");

            using var doc = new Document(pdf, PageSize.A4);
            doc.SetMargins(36, 36, 36, 36);

            var (f, fb, fi) = CreateFonts();

            // Header
            AddCompactHeader(doc, "SOLICITAÇÃO DE EXAMES", $"Res. CFM nº 2.381/2024 · Emissão: {BrazilDateTime.FormatDate(data.EmissionDate)}", fb, f);

            // Patient
            AddSectionLabel(doc, "PACIENTE", fb);
            AddPatientBlockExam(doc, data, fb, f);
            AddTelemedicineNotice(doc, fi);

            // Clinical indication
            if (!string.IsNullOrWhiteSpace(data.ClinicalIndication))
            {
                AddSectionLabel(doc, "INDICAÇÃO CLÍNICA", fb);
                doc.Add(new Paragraph(data.ClinicalIndication).SetFont(f).SetFontSize(10).SetFontColor(TextDark).SetMarginBottom(12));
            }

            // Exams
            AddSectionLabel(doc, "EXAMES SOLICITADOS", fb);
            AddExamList(doc, exams, data.Notes, f, fb, fi);

            // Observation + Conduct
            AddObservationAndConductBlock(doc, data.AutoObservation, data.DoctorConductNotes, data.IncludeConductInPdf, data.DoctorName, f, fb, fi);

            // QR
            AddVerificationBlock(doc, qrUrl, displayUrl, accessCode, f, fb);

            // Doctor
            AddDoctorBlock(doc, data.DoctorName, data.DoctorCrm, data.DoctorCrmState, data.DoctorSpecialty, data.DoctorAddress, data.DoctorPhone, data.EmissionDate, fb, f);

            // Legal
            AddLegalFooter(doc, data.DoctorName, data.EmissionDate, f, fi);

            doc.Close();
            return Task.FromResult(new PrescriptionPdfResult(true, ms.ToArray(), null, null));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar PDF de exame para solicitação {RequestId}", data.RequestId);
            return Task.FromResult(new PrescriptionPdfResult(false, null, null, $"Erro ao gerar PDF: {ex.Message}"));
        }
    }

    // ════════════════════════════════════════════════════
    //  RENDER — RECEITA SIMPLES
    // ════════════════════════════════════════════════════

    private void RenderSimplePdf(MemoryStream ms, PrescriptionPdfData data, List<PrescriptionMedicationItem> meds)
    {
        var (qrUrl, displayUrl, accessCode) = GetPdfUrls(data);
        using var writer = new PdfWriter(ms);
        using var pdf = new PdfDocument(writer);
        SetMetadata(pdf, $"Receita Simples - {data.PatientName}", data.DoctorName, data.DoctorCrm, data.DoctorCrmState, "simples");

        using var doc = new Document(pdf, PageSize.A4);
        doc.SetMargins(36, 36, 36, 36);
        var (f, fb, fi) = CreateFonts();

        AddMedicationPages(doc, data, meds, "RECEITA SIMPLES", $"Emissão: {BrazilDateTime.FormatDate(data.EmissionDate)}", null, qrUrl, displayUrl, accessCode, f, fb, fi, includeGenderAge: false);
        doc.Close();
    }

    // ════════════════════════════════════════════════════
    //  RENDER — RECEITA ANTIMICROBIANA (RDC 471/2021)
    // ════════════════════════════════════════════════════

    private void RenderAntimicrobialPdf(MemoryStream ms, PrescriptionPdfData data, List<PrescriptionMedicationItem> meds)
    {
        var (qrUrl, displayUrl, accessCode) = GetPdfUrls(data);
        using var writer = new PdfWriter(ms);
        using var pdf = new PdfDocument(writer);
        SetMetadata(pdf, $"Receita Antimicrobiana - {data.PatientName}", data.DoctorName, data.DoctorCrm, data.DoctorCrmState, "antimicrobiana");

        using var doc = new Document(pdf, PageSize.A4);
        doc.SetMargins(36, 36, 36, 36);
        var (f, fb, fi) = CreateFonts();

        var validUntil = BrazilDateTime.ToBrasiliaWallClock(data.EmissionDate).Date.AddDays(10).ToString("dd/MM/yyyy", CultureInfo.GetCultureInfo("pt-BR"));
        var warning = $"Validade: 10 dias — válida até {validUntil}";

        AddMedicationPages(doc, data, meds, "RECEITA DE ANTIMICROBIANO", $"RDC 471/2021 · Emissão: {BrazilDateTime.FormatDate(data.EmissionDate)}", warning, qrUrl, displayUrl, accessCode, f, fb, fi, includeGenderAge: true);
        doc.Close();
    }

    // ════════════════════════════════════════════════════
    //  RENDER — RECEITA DE CONTROLE ESPECIAL (SVS 344/98)
    // ════════════════════════════════════════════════════

    private void RenderControlledSpecialPdf(MemoryStream ms, PrescriptionPdfData data, List<PrescriptionMedicationItem> meds)
    {
        var (qrUrl, displayUrl, accessCode) = GetPdfUrls(data);
        using var writer = new PdfWriter(ms);
        using var pdf = new PdfDocument(writer);
        SetMetadata(pdf, $"Receita Controle Especial - {data.PatientName}", data.DoctorName, data.DoctorCrm, data.DoctorCrmState, "controle especial");

        using var doc = new Document(pdf, PageSize.A4);
        doc.SetMargins(36, 36, 36, 36);
        var (f, fb, fi) = CreateFonts();

        var validUntil = BrazilDateTime.ToBrasiliaWallClock(data.EmissionDate).Date.AddDays(30).ToString("dd/MM/yyyy", CultureInfo.GetCultureInfo("pt-BR"));
        var warning = $"Validade: 30 dias — válida até {validUntil} (art. 35 §3º)";

        for (int i = 0; i < meds.Count; i++)
        {
            if (i > 0)
                doc.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));

            AddCompactHeader(doc, "RECEITA DE CONTROLE ESPECIAL", $"Portaria SVS 344/98 · 1ª via Farmácia / 2ª via Paciente", fb, f);
            AddWarningBanner(doc, warning, fb, f);

            AddSectionLabel(doc, "IDENTIFICAÇÃO DO EMITENTE", fb);
            var doctorLine = $"Dr(a). {data.DoctorName} · CRM {data.DoctorCrm}/{data.DoctorCrmState}";
            if (!string.IsNullOrWhiteSpace(data.DoctorSpecialty)) doctorLine += $" · {data.DoctorSpecialty}";
            doc.Add(new Paragraph(doctorLine).SetFont(f).SetFontSize(9).SetFontColor(TextDark).SetMarginBottom(2));
            if (!string.IsNullOrWhiteSpace(data.DoctorAddress))
                doc.Add(new Paragraph(data.DoctorAddress).SetFont(f).SetFontSize(8).SetFontColor(TextMedium).SetMarginBottom(2));
            if (!string.IsNullOrWhiteSpace(data.DoctorPhone))
                doc.Add(new Paragraph($"Tel.: {data.DoctorPhone}").SetFont(f).SetFontSize(8).SetFontColor(TextMedium));
            doc.Add(new Paragraph().SetMarginBottom(8));

            AddSectionLabel(doc, "PACIENTE", fb);
            AddPatientBlock(doc, data, fb, f, includeGenderAge: false);

            var med = meds[i];
            if (!string.IsNullOrWhiteSpace(med.Quantity))
                med = med with { Quantity = $"{med.Quantity} ({QuantityToWords.Convert(med.Quantity)})" };
            AddSectionLabel(doc, "PRESCRIÇÃO — MEDICAMENTO", fb);
            AddMedicationBlock(doc, med, fb, f, fi);
            AddObservationBlock(doc, med, data.AdditionalNotes, f, fb, fi);

            AddBlankFormSection(doc, "IDENTIFICAÇÃO DO COMPRADOR", new[]
            {
                "Nome: _________________________________________________",
                "RG: ____________________  Órgão: ________  Tel.: ______________",
                "Endereço: ______________________________________________",
                "Cidade: ____________________________  UF: _____",
            }, f, fb);

            AddBlankFormSection(doc, "IDENTIFICAÇÃO DO FORNECEDOR", new[]
            {
                "Farmacêutico(a): ___________________________  CRF: ________",
                "Farmácia: _____________________________  CNPJ: ____________",
                "Endereço: ______________________________________________",
                "Data dispensação: ___/___/_____ Assinatura: _________________",
            }, f, fb);

            var isLast = i == meds.Count - 1;
            if (isLast)
                AddObservationAndConductBlock(doc, data.AutoObservation, data.DoctorConductNotes, data.IncludeConductInPdf, data.DoctorName, f, fb, fi);

            AddVerificationBlock(doc, qrUrl, displayUrl, accessCode, f, fb);
            AddDoctorBlock(doc, data.DoctorName, data.DoctorCrm, data.DoctorCrmState, data.DoctorSpecialty, data.DoctorAddress, data.DoctorPhone, data.EmissionDate, fb, f);
            AddLegalFooter(doc, data.DoctorName, data.EmissionDate, f, fi);
        }
        doc.Close();
    }

    // ════════════════════════════════════════════════════
    //  BUILDING BLOCKS — shared across all types
    // ════════════════════════════════════════════════════

    /// <summary>
    /// Layout estilo Docway: um medicamento por página, com header e dados do paciente repetidos em cada página.
    /// Facilita dispensação em farmácias diferentes e retenção de vias.
    /// </summary>
    private static void AddMedicationPages(Document doc, PrescriptionPdfData data, List<PrescriptionMedicationItem> meds,
        string title, string subtitle, string? warningBanner,
        string qrUrl, string displayUrl, string accessCode,
        PdfFont f, PdfFont fb, PdfFont fi, bool includeGenderAge)
    {
        for (int i = 0; i < meds.Count; i++)
        {
            if (i > 0)
                doc.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));

            AddCompactHeader(doc, title, subtitle, fb, f);
            if (!string.IsNullOrWhiteSpace(warningBanner))
                AddWarningBanner(doc, warningBanner, fb, f);
            AddSectionLabel(doc, "PACIENTE", fb);
            AddPatientBlock(doc, data, fb, f, includeGenderAge);
            AddTelemedicineNotice(doc, fi);

            AddSectionLabel(doc, "PRESCRIÇÃO", fb);
            AddMedicationBlock(doc, meds[i], fb, f, fi);
            AddObservationBlock(doc, meds[i], data.AdditionalNotes, f, fb, fi);

            var isLast = i == meds.Count - 1;
            if (isLast)
                AddObservationAndConductBlock(doc, data.AutoObservation, data.DoctorConductNotes, data.IncludeConductInPdf, data.DoctorName, f, fb, fi);

            AddVerificationBlock(doc, qrUrl, displayUrl, accessCode, f, fb);
            AddDoctorBlock(doc, data.DoctorName, data.DoctorCrm, data.DoctorCrmState, data.DoctorSpecialty, data.DoctorAddress, data.DoctorPhone, data.EmissionDate, fb, f);
            AddLegalFooter(doc, data.DoctorName, data.EmissionDate, f, fi);
        }
    }

    /// <summary>Compact header: logo left · document type + subtitle right</summary>
    private static void AddCompactHeader(Document doc, string title, string subtitle, PdfFont fb, PdfFont f)
    {
        var table = new Table(UnitValue.CreatePercentArray(new float[] { 45, 55 }))
            .UseAllAvailableWidth()
            .SetMarginBottom(4);

        // Left: logo + company info
        var left = new Cell().SetBorder(Border.NO_BORDER).SetVerticalAlignment(VerticalAlignment.MIDDLE);
        var logoBytes = LoadLogoImage();
        if (logoBytes != null)
        {
            var img = new Image(ImageDataFactory.Create(logoBytes))
                .SetWidth(48).SetMaxHeight(48)
                .SetAutoScaleHeight(true);
            // Logo + company name side by side
            var logoRow = new Table(UnitValue.CreatePercentArray(new float[] { 20, 80 })).UseAllAvailableWidth();
            var imgCell = new Cell().SetBorder(Border.NO_BORDER).SetVerticalAlignment(VerticalAlignment.MIDDLE);
            imgCell.Add(img);
            logoRow.AddCell(imgCell);

            var nameCell = new Cell().SetBorder(Border.NO_BORDER).SetVerticalAlignment(VerticalAlignment.MIDDLE).SetPaddingLeft(6);
            nameCell.Add(new Paragraph("RenoveJá").SetFont(fb).SetFontSize(16).SetFontColor(PrimaryDark).SetMarginBottom(0));
            nameCell.Add(new Paragraph(CompanyLine1).SetFont(f).SetFontSize(6.5f).SetFontColor(TextLight).SetMarginBottom(0));
            nameCell.Add(new Paragraph(CompanyLine2).SetFont(f).SetFontSize(6.5f).SetFontColor(TextLight));
            logoRow.AddCell(nameCell);
            left.Add(logoRow);
        }
        else
        {
            left.Add(new Paragraph("RenoveJá").SetFont(fb).SetFontSize(18).SetFontColor(PrimaryDark).SetMarginBottom(1));
            left.Add(new Paragraph(CompanyLine1).SetFont(f).SetFontSize(6.5f).SetFontColor(TextLight).SetMarginBottom(0));
            left.Add(new Paragraph(CompanyLine2).SetFont(f).SetFontSize(6.5f).SetFontColor(TextLight));
        }
        table.AddCell(left);

        // Right: document title
        var right = new Cell().SetBorder(Border.NO_BORDER).SetTextAlignment(TextAlignment.RIGHT).SetVerticalAlignment(VerticalAlignment.MIDDLE);
        right.Add(new Paragraph(title).SetFont(fb).SetFontSize(11).SetFontColor(TextDark).SetMarginBottom(2));
        right.Add(new Paragraph(subtitle).SetFont(f).SetFontSize(7.5f).SetFontColor(TextMedium));
        table.AddCell(right);

        doc.Add(table);
        AddThinRule(doc);
    }

    /// <summary>Section label: "PACIENTE", "MEDICAMENTO" etc</summary>
    private static void AddSectionLabel(Document doc, string label, PdfFont fb)
    {
        doc.Add(new Paragraph(label)
            .SetFont(fb).SetFontSize(7.5f).SetFontColor(Primary)
            .SetCharacterSpacing(0.5f)
            .SetMarginTop(10).SetMarginBottom(4));
    }

    /// <summary>Patient info block for prescriptions</summary>
    private static void AddPatientBlock(Document doc, PrescriptionPdfData d, PdfFont fb, PdfFont f, bool includeGenderAge)
    {
        // Name
        doc.Add(new Paragraph(d.PatientName.ToUpperInvariant())
            .SetFont(fb).SetFontSize(12).SetFontColor(TextDark).SetMarginBottom(4));

        // Info grid: 2 columns
        var grid = new Table(UnitValue.CreatePercentArray(new float[] { 50, 50 })).UseAllAvailableWidth().SetMarginBottom(10);

        AddInfoCell(grid, "CPF", !string.IsNullOrWhiteSpace(d.PatientCpf) ? FormatCpf(d.PatientCpf) : "—", fb, f);
        AddInfoCell(grid, "Nascimento", d.PatientBirthDate.HasValue ? d.PatientBirthDate.Value.ToString("dd/MM/yyyy") : "—", fb, f);

        if (includeGenderAge)
        {
            AddInfoCell(grid, "Sexo", !string.IsNullOrWhiteSpace(d.PatientGender) ? d.PatientGender : "—", fb, f);
            AddInfoCell(grid, "Idade", d.PatientBirthDate.HasValue ? $"{CalculateAge(d.PatientBirthDate.Value)} anos" : "—", fb, f);
        }

        AddInfoCell(grid, "Telefone", !string.IsNullOrWhiteSpace(d.PatientPhone) ? d.PatientPhone : "—", fb, f);
        AddInfoCell(grid, "Data de Emissão", BrazilDateTime.FormatDateTime(d.EmissionDate), fb, f);

        if (!string.IsNullOrWhiteSpace(d.PatientAddress))
        {
            var addrCell = new Cell(1, 2).SetBorder(Border.NO_BORDER).SetPaddingBottom(2);
            addrCell.Add(InfoParagraph("Endereço", d.PatientAddress, fb, f));
            grid.AddCell(addrCell);
        }

        doc.Add(grid);
    }

    /// <summary>Patient info block for exams</summary>
    private static void AddPatientBlockExam(Document doc, ExamPdfData d, PdfFont fb, PdfFont f)
    {
        doc.Add(new Paragraph(d.PatientName.ToUpperInvariant())
            .SetFont(fb).SetFontSize(12).SetFontColor(TextDark).SetMarginBottom(4));

        var grid = new Table(UnitValue.CreatePercentArray(new float[] { 50, 50 })).UseAllAvailableWidth().SetMarginBottom(10);
        AddInfoCell(grid, "CPF", !string.IsNullOrWhiteSpace(d.PatientCpf) ? FormatCpf(d.PatientCpf) : "—", fb, f);
        AddInfoCell(grid, "Nascimento", d.PatientBirthDate.HasValue ? d.PatientBirthDate.Value.ToString("dd/MM/yyyy") : "—", fb, f);
        AddInfoCell(grid, "Telefone", !string.IsNullOrWhiteSpace(d.PatientPhone) ? d.PatientPhone : "—", fb, f);
        AddInfoCell(grid, "Data de Emissão", BrazilDateTime.FormatDateTime(d.EmissionDate), fb, f);

        if (!string.IsNullOrWhiteSpace(d.PatientAddress))
        {
            var c = new Cell(1, 2).SetBorder(Border.NO_BORDER).SetPaddingBottom(2);
            c.Add(InfoParagraph("Endereço", d.PatientAddress, fb, f));
            grid.AddCell(c);
        }
        doc.Add(grid);
    }

    /// <summary>Medication card — left blue border, light bg</summary>
    private static void AddMedicationBlock(Document doc, PrescriptionMedicationItem med, PdfFont fb, PdfFont f, PdfFont fi)
    {
        var card = new Table(1).UseAllAvailableWidth().SetMarginBottom(10);
        var cell = new Cell()
            .SetBackgroundColor(BgLight)
            .SetBorder(Border.NO_BORDER)
            .SetBorderLeft(new SolidBorder(Primary, 3))
            .SetPadding(14);

        // Name + presentation
        var name = med.Name;
        if (!string.IsNullOrWhiteSpace(med.Presentation)) name += $", {med.Presentation}";
        cell.Add(new Paragraph(name).SetFont(fb).SetFontSize(12).SetFontColor(TextDark).SetMarginBottom(6));

        // Dosage
        if (!string.IsNullOrWhiteSpace(med.Dosage))
            cell.Add(InfoParagraph("Posologia", med.Dosage, fb, f).SetMarginBottom(3));

        // Quantity
        if (!string.IsNullOrWhiteSpace(med.Quantity))
            cell.Add(InfoParagraph("Quantidade", med.Quantity, fb, f));

        card.AddCell(cell);
        doc.Add(card);
    }

    /// <summary>Observation section (if any)</summary>
    private static void AddObservationBlock(Document doc, PrescriptionMedicationItem med, string? additionalNotes, PdfFont f, PdfFont fb, PdfFont fi)
    {
        var has = !string.IsNullOrWhiteSpace(med.Observation) || !string.IsNullOrWhiteSpace(additionalNotes);
        if (!has) return;

        AddSectionLabel(doc, "OBSERVAÇÕES", fb);
        if (!string.IsNullOrWhiteSpace(med.Observation))
            doc.Add(new Paragraph(med.Observation).SetFont(fi).SetFontSize(9).SetFontColor(TextMedium).SetMarginBottom(3));
        if (!string.IsNullOrWhiteSpace(additionalNotes))
            doc.Add(new Paragraph(additionalNotes).SetFont(fi).SetFontSize(9).SetFontColor(TextMedium).SetMarginBottom(3));
    }

    /// <summary>Exam list with numbering and notes</summary>
    private static void AddExamList(Document doc, List<string> exams, string? notes, PdfFont f, PdfFont fb, PdfFont fi)
    {
        var card = new Table(1).UseAllAvailableWidth().SetMarginBottom(10);
        var cell = new Cell()
            .SetBackgroundColor(BgLight)
            .SetBorder(Border.NO_BORDER)
            .SetBorderLeft(new SolidBorder(Primary, 3))
            .SetPadding(14);

        for (int i = 0; i < exams.Count; i++)
        {
            var p = new Paragraph();
            p.Add(new Text($"{i + 1}. ").SetFont(fb).SetFontSize(10).SetFontColor(Primary));
            p.Add(new Text(exams[i]).SetFont(f).SetFontSize(10).SetFontColor(TextDark));
            cell.Add(p.SetMarginBottom(4));
        }

        if (!string.IsNullOrWhiteSpace(notes))
        {
            cell.Add(new Paragraph().SetMarginTop(6));
            cell.Add(InfoParagraph("Observações", notes, fb, fi));
        }

        card.AddCell(cell);
        doc.Add(card);
    }

    private static void AddObservationAndConductBlock(Document doc, string? autoObservation, string? doctorConductNotes, bool includeConductInPdf, string? doctorName, PdfFont f, PdfFont fb, PdfFont fi)
    {
        var hasObs = !string.IsNullOrWhiteSpace(autoObservation);
        var hasConduct = includeConductInPdf && !string.IsNullOrWhiteSpace(doctorConductNotes);
        if (!hasObs && !hasConduct) return;

        AddThinRule(doc);

        if (hasObs)
        {
            doc.Add(new Paragraph("OBSERVAÇÃO ORIENTATIVA")
                .SetFont(fb).SetFontSize(8.5f)
                .SetFontColor(TextMedium)
                .SetCharacterSpacing(0.8f)
                .SetMarginBottom(4));

            doc.Add(new Paragraph(autoObservation!)
                .SetFont(fi).SetFontSize(8)
                .SetFontColor(TextMedium)
                .SetMarginBottom(2));

            doc.Add(new Paragraph("Orientação auxiliar da plataforma. Não substitui avaliação médica. A decisão clínica é do médico responsável.")
                .SetFont(fi).SetFontSize(6.5f)
                .SetFontColor(TextLight)
                .SetMarginBottom(6));
        }

        if (hasConduct)
        {
            doc.Add(new Paragraph("CONDUTA MÉDICA")
                .SetFont(fb).SetFontSize(8.5f)
                .SetFontColor(Accent)
                .SetCharacterSpacing(0.8f)
                .SetMarginBottom(4));

            if (!string.IsNullOrWhiteSpace(doctorName))
                doc.Add(new Paragraph($"Dr(a). {doctorName}")
                    .SetFont(f).SetFontSize(7.5f)
                    .SetFontColor(TextLight)
                    .SetMarginBottom(4));

            doc.Add(new Paragraph(doctorConductNotes!)
                .SetFont(f).SetFontSize(8.5f)
                .SetFontColor(TextDark)
                .SetMarginBottom(8));
        }
    }

    /// <summary>
    /// Verification block: QR + instructions.
    /// <paramref name="qrUrl"/> is encoded in the QR (API endpoint, compatible with validar.iti.gov.br).
    /// <paramref name="displayUrl"/> is the user-friendly frontend URL shown as text.
    /// </summary>
    private static void AddVerificationBlock(Document doc, string qrUrl, string displayUrl, string code, PdfFont f, PdfFont fb)
    {
        var qrBytes = GenerateQrCode(qrUrl);
        if (qrBytes == null) return;

        AddThinRule(doc);

        var table = new Table(UnitValue.CreatePercentArray(new float[] { 70, 30 }))
            .UseAllAvailableWidth()
            .SetMarginTop(8).SetMarginBottom(8);

        var left = new Cell().SetBorder(Border.NO_BORDER).SetVerticalAlignment(VerticalAlignment.MIDDLE);
        left.Add(new Paragraph("VERIFICAÇÃO DO DOCUMENTO").SetFont(fb).SetFontSize(7.5f).SetFontColor(Primary).SetCharacterSpacing(0.5f).SetMarginBottom(6));
        left.Add(new Paragraph("1. Escaneie o QR Code ao lado").SetFont(f).SetFontSize(8.5f).SetFontColor(TextDark).SetMarginBottom(1));
        left.Add(new Paragraph("2. Insira o código de 6 dígitos").SetFont(f).SetFontSize(8.5f).SetFontColor(TextDark).SetMarginBottom(1));
        left.Add(new Paragraph("3. Baixe a 2ª via do PDF assinado").SetFont(f).SetFontSize(8.5f).SetFontColor(TextDark).SetMarginBottom(6));

        var codePara = new Paragraph();
        codePara.Add(new Text("Código: ").SetFont(f).SetFontSize(9).SetFontColor(TextMedium));
        codePara.Add(new Text(code).SetFont(fb).SetFontSize(12).SetFontColor(PrimaryDark));
        left.Add(codePara.SetMarginBottom(4));

        left.Add(new Paragraph(displayUrl).SetFont(f).SetFontSize(6.5f).SetFontColor(TextLight));
        table.AddCell(left);

        var right = new Cell().SetBorder(Border.NO_BORDER).SetTextAlignment(TextAlignment.RIGHT).SetVerticalAlignment(VerticalAlignment.MIDDLE);
        right.Add(new Image(ImageDataFactory.Create(qrBytes)).SetWidth(80).SetHeight(80));
        table.AddCell(right);

        doc.Add(table);
    }

    /// <summary>Doctor signature block</summary>
    private static void AddDoctorBlock(Document doc, string name, string crm, string crmState, string? specialty,
        string? address, string? phone, DateTime emission, PdfFont fb, PdfFont f)
    {
        AddThinRule(doc);

        var info = new Paragraph();
        info.Add(new Text($"Dr(a). {name}").SetFont(fb).SetFontSize(10).SetFontColor(TextDark));
        info.Add(new Text($"  ·  CRM {crm}/{crmState}").SetFont(f).SetFontSize(9).SetFontColor(TextMedium));
        if (!string.IsNullOrWhiteSpace(specialty))
            info.Add(new Text($"  ·  {specialty}").SetFont(f).SetFontSize(9).SetFontColor(TextMedium));
        doc.Add(info.SetMarginBottom(2));

        if (!string.IsNullOrWhiteSpace(address))
            doc.Add(new Paragraph($"Endereço: {address}").SetFont(f).SetFontSize(8).SetFontColor(TextMedium).SetMarginBottom(1));
        if (!string.IsNullOrWhiteSpace(phone))
            doc.Add(new Paragraph($"Telefone: {phone}").SetFont(f).SetFontSize(8).SetFontColor(TextMedium).SetMarginBottom(1));
    }

    private static void AddTelemedicineNotice(Document doc, PdfFont fi)
    {
        doc.Add(new Paragraph("Documento emitido por telemedicina (Resolução CFM nº 2.314/2022)")
            .SetFont(fi)
            .SetFontSize(9)
            .SetFontColor(TextLight)
            .SetMarginTop(2)
            .SetMarginBottom(8));
    }

    /// <summary>Legal footer</summary>
    private static void AddLegalFooter(Document doc, string doctorName, DateTime emission, PdfFont f, PdfFont fi)
    {
        AddThinRule(doc);
        var p = new Paragraph()
            .SetMarginTop(2);
        p.Add(new Text("Importante: ").SetFont(fi).SetFontSize(7).SetFontColor(TextLight));
        p.Add(new Text("Verifique autenticidade em validar.iti.gov.br\n").SetFont(f).SetFontSize(7).SetFontColor(TextLight));
        p.Add(new Text($"Assinado digitalmente conforme ICP-Brasil (MP 2.200-2/2001) por Dr(a). {doctorName} em {BrazilDateTime.FormatDateTime(emission)}.")
            .SetFont(f).SetFontSize(7).SetFontColor(TextLight));
        doc.Add(p);
    }

    /// <summary>Warning banner (antimicrobial validity, controlled validity)</summary>
    private static void AddWarningBanner(Document doc, string text, PdfFont fb, PdfFont f)
    {
        var banner = new Table(1).UseAllAvailableWidth().SetMarginBottom(8);
        var cell = new Cell()
            .SetBackgroundColor(BgWarm)
            .SetBorder(Border.NO_BORDER)
            .SetBorderLeft(new SolidBorder(WarningBorder, 3))
            .SetPadding(8);
        var p = new Paragraph();
        p.Add(new Text("⚠ ").SetFont(fb).SetFontSize(9));
        p.Add(new Text(text).SetFont(f).SetFontSize(8.5f).SetFontColor(new DeviceRgb(120, 53, 15)));
        cell.Add(p);
        banner.AddCell(cell);
        doc.Add(banner);
    }

    /// <summary>Blank form section (Comprador, Fornecedor for controlled)</summary>
    private static void AddBlankFormSection(Document doc, string title, string[] lines, PdfFont f, PdfFont fb)
    {
        AddSectionLabel(doc, title, fb);
        foreach (var line in lines)
            doc.Add(new Paragraph(line).SetFont(f).SetFontSize(8.5f).SetFontColor(TextMedium).SetMarginBottom(3));
        doc.Add(new Paragraph().SetMarginBottom(4));
    }

    // ════════════════════════════════════════════════════
    //  MICRO-HELPERS
    // ════════════════════════════════════════════════════

    private static void AddThinRule(Document doc)
    {
        var rule = new Table(1).UseAllAvailableWidth().SetMarginTop(6).SetMarginBottom(6);
        rule.AddCell(new Cell().SetBorder(Border.NO_BORDER).SetBorderBottom(new SolidBorder(BorderLight, 0.5f)).SetHeight(1));
        doc.Add(rule);
    }

    private static void AddInfoCell(Table grid, string label, string value, PdfFont fb, PdfFont f)
    {
        var cell = new Cell().SetBorder(Border.NO_BORDER).SetPaddingBottom(3);
        cell.Add(InfoParagraph(label, value, fb, f));
        grid.AddCell(cell);
    }

    private static Paragraph InfoParagraph(string label, string value, PdfFont labelFont, PdfFont valueFont)
    {
        var p = new Paragraph();
        p.Add(new Text(label + ": ").SetFont(labelFont).SetFontSize(8).SetFontColor(TextMedium));
        p.Add(new Text(value).SetFont(valueFont).SetFontSize(9).SetFontColor(TextDark));
        return p;
    }

    private static (PdfFont f, PdfFont fb, PdfFont fi) CreateFonts()
    {
        return (
            PdfFontFactory.CreateFont(StandardFonts.HELVETICA),
            PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD),
            PdfFontFactory.CreateFont(StandardFonts.HELVETICA_OBLIQUE)
        );
    }

    private static void SetMetadata(PdfDocument pdf, string title, string doctor, string crm, string crmState, string tipo)
    {
        var info = pdf.GetDocumentInfo();
        info.SetTitle(title);
        info.SetAuthor($"Dr(a). {doctor} | CRM {crm}/{crmState}");
        info.SetCreator("RenoveJá Saúde — Sistema de Receitas Digitais");
        info.SetSubject($"Documento médico digital — {tipo}");
        info.SetKeywords("receita digital, ICP-Brasil, RenoveJá, prescrição médica");
    }

    private (string qrUrl, string displayUrl, string accessCode) GetPdfUrls(PrescriptionPdfData data)
    {
        var apiBase = !string.IsNullOrWhiteSpace(_verificationConfig.BaseUrl)
            ? _verificationConfig.BaseUrl.TrimEnd('/')
            : DefaultVerificationBaseUrl;
        var frontendBase = !string.IsNullOrWhiteSpace(_verificationConfig.FrontendUrl)
            ? _verificationConfig.FrontendUrl.TrimEnd('/')
            : apiBase;

        // URL curta (estilo Docway): re.renoveja.com.br/XXX em vez de api.com/api/verify/{guid}
        var shortBase = !string.IsNullOrWhiteSpace(_verificationConfig.ShortUrlBase)
            ? _verificationConfig.ShortUrlBase.TrimEnd('/')
            : null;

        string basePath;
        if (shortBase != null && string.IsNullOrWhiteSpace(data.VerificationUrl))
        {
            var encoded = ShortUrlEncoder.Encode(data.RequestId);
            basePath = $"{shortBase}/r/{encoded}";
        }
        else
        {
            basePath = data.VerificationUrl ?? $"{apiBase}/{data.RequestId}";
        }

        // type=prescricao conforme Guia ITI Cap. IV — necessário para validar.iti.gov.br identificar o documento
        var qrUrl = basePath.Contains('?') ? $"{basePath}&type=prescricao" : $"{basePath}?type=prescricao";
        var displayUrl = shortBase != null
            ? $"{shortBase}/r/{ShortUrlEncoder.Encode(data.RequestId)}"
            : $"{frontendBase}/{data.RequestId}";
        var accessCode = data.AccessCode ?? GenerateAccessCode(data.RequestId);
        return (qrUrl, displayUrl, accessCode);
    }

    private static List<PrescriptionMedicationItem> BuildMedicationItems(PrescriptionPdfData data)
    {
        if (data.MedicationItems != null && data.MedicationItems.Count > 0) return data.MedicationItems;
        return data.Medications.Where(m => !string.IsNullOrWhiteSpace(m)).Select(m => new PrescriptionMedicationItem(m)).ToList();
    }

    private static string GenerateAccessCode(Guid requestId)
    {
        var hash = requestId.GetHashCode();
        return (Math.Abs(hash) % 1_000_000).ToString("D6");
    }

    private static byte[]? GenerateQrCode(string data)
    {
        try
        {
            using var gen = new QRCodeGenerator();
            using var qrData = gen.CreateQrCode(data, QRCodeGenerator.ECCLevel.Q);
            using var qr = new PngByteQRCode(qrData);
            return qr.GetGraphic(20);
        }
        catch { return null; }
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
        return cpf.Length == 11 ? $"{cpf[..3]}.{cpf[3..6]}.{cpf[6..9]}-{cpf[9..]}" : cpf;
    }

    // ═══════════════════════════════════════════════════════════════
    // ATESTADO MÉDICO — PDF
    // ═══════════════════════════════════════════════════════════════

    public async Task<PrescriptionPdfResult> GenerateMedicalCertificateAsync(
        MedicalCertificatePdfData data,
        CancellationToken cancellationToken = default)
    {
        await Task.CompletedTask;
        try
        {
            using var ms = new MemoryStream();
            var writer = new PdfWriter(ms);
            var pdf = new PdfDocument(writer);
            var document = new Document(pdf, PageSize.A4);
            document.SetMargins(50, 50, 50, 50);

            var bold = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
            var regular = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);

            // ── Header com logo e dados do médico ──
            var headerTable = new Table(UnitValue.CreatePercentArray(new float[] { 70, 30 }))
                .UseAllAvailableWidth();

            var doctorInfo = new Paragraph()
                .Add(new Text($"Dr(a). {data.DoctorName}\n").SetFont(bold).SetFontSize(14).SetFontColor(PrimaryDark))
                .Add(new Text($"CRM {data.DoctorCrm}/{data.DoctorCrmState}").SetFont(regular).SetFontSize(10).SetFontColor(TextMedium))
                .Add(new Text($"\n{data.DoctorSpecialty}").SetFont(regular).SetFontSize(10).SetFontColor(TextMedium));
            if (!string.IsNullOrEmpty(data.DoctorAddress))
                doctorInfo.Add(new Text($"\n{data.DoctorAddress}").SetFont(regular).SetFontSize(9).SetFontColor(TextLight));
            if (!string.IsNullOrEmpty(data.DoctorPhone))
                doctorInfo.Add(new Text($"\n{data.DoctorPhone}").SetFont(regular).SetFontSize(9).SetFontColor(TextLight));

            headerTable.AddCell(new Cell().Add(doctorInfo).SetBorder(Border.NO_BORDER).SetPaddingBottom(10));

            // QR Code de verificação
            var frontendBase = !string.IsNullOrWhiteSpace(_verificationConfig.FrontendUrl)
                ? _verificationConfig.FrontendUrl.TrimEnd('/')
                : DefaultVerificationBaseUrl;
            var verifyUrl = !string.IsNullOrWhiteSpace(data.VerificationUrl)
                ? data.VerificationUrl.Trim()
                : $"{frontendBase}/{data.RequestId}";
            using var qrGenerator = new QRCodeGenerator();
            using var qrData = qrGenerator.CreateQrCode(verifyUrl, QRCodeGenerator.ECCLevel.M);
            using var qrCode = new PngByteQRCode(qrData);
            var qrBytes = qrCode.GetGraphic(4);
            var qrImage = new Image(ImageDataFactory.Create(qrBytes)).SetWidth(70).SetHeight(70);

            headerTable.AddCell(new Cell().Add(qrImage).SetBorder(Border.NO_BORDER)
                .SetTextAlignment(TextAlignment.RIGHT).SetVerticalAlignment(VerticalAlignment.MIDDLE));

            document.Add(headerTable);

            // Linha divisória
            document.Add(new Paragraph("")
                .SetBorderBottom(new SolidBorder(BorderLight, 1))
                .SetMarginTop(8).SetMarginBottom(16));

            // ── Título ──
            var titleText = data.CertificateType switch
            {
                "comparecimento" => "ATESTADO DE COMPARECIMENTO",
                "aptidao" => "ATESTADO DE APTIDÃO",
                "encaminhamento" => "ENCAMINHAMENTO MÉDICO",
                _ => "ATESTADO MÉDICO"
            };

            document.Add(new Paragraph(titleText)
                .SetFont(bold).SetFontSize(16).SetFontColor(PrimaryDark)
                .SetTextAlignment(TextAlignment.CENTER).SetMarginBottom(20));

            // ── Dados do paciente ──
            var patientTable = new Table(UnitValue.CreatePercentArray(new float[] { 30, 70 }))
                .UseAllAvailableWidth()
                .SetMarginBottom(16);

            void AddRow(string label, string? value)
            {
                if (string.IsNullOrWhiteSpace(value)) return;
                patientTable.AddCell(new Cell().Add(new Paragraph(label).SetFont(bold).SetFontSize(10).SetFontColor(TextMedium))
                    .SetBorder(Border.NO_BORDER).SetPaddingBottom(4));
                patientTable.AddCell(new Cell().Add(new Paragraph(value).SetFont(regular).SetFontSize(10).SetFontColor(TextDark))
                    .SetBorder(Border.NO_BORDER).SetPaddingBottom(4));
            }

            AddRow("Paciente:", data.PatientName);
            if (!string.IsNullOrEmpty(data.PatientCpf))
                AddRow("CPF:", FormatCpf(data.PatientCpf));
            if (data.PatientBirthDate.HasValue)
                AddRow("Data de nascimento:", data.PatientBirthDate.Value.ToString("dd/MM/yyyy"));

            document.Add(patientTable);

            // ── Corpo do atestado ──
            document.Add(new Paragraph(data.Body)
                .SetFont(regular).SetFontSize(12).SetFontColor(TextDark)
                .SetTextAlignment(TextAlignment.JUSTIFIED)
                .SetMultipliedLeading(1.6f).SetMarginBottom(16));

            // ── CID (se autorizado) ──
            if (!string.IsNullOrWhiteSpace(data.Icd10Code))
            {
                document.Add(new Paragraph($"CID-10: {data.Icd10Code}")
                    .SetFont(bold).SetFontSize(11).SetFontColor(TextDark).SetMarginBottom(8));
            }

            // ── Período de afastamento ──
            if (data.LeaveDays.HasValue && data.LeaveDays.Value > 0)
            {
                var startDate = BrazilDateTime.ToBrasiliaWallClock(data.LeaveStartDate ?? data.EmissionDate);
                var endDate = startDate.Date.AddDays(data.LeaveDays.Value - 1);
                var periodStr = data.LeavePeriod == "meio_periodo" ? " (meio período)" : "";

                document.Add(new Paragraph(
                    $"Período de afastamento: {data.LeaveDays} dia(s){periodStr}\n" +
                    $"De {BrazilDateTime.FormatDate(startDate)} a {endDate.ToString("dd/MM/yyyy", CultureInfo.GetCultureInfo("pt-BR"))}")
                    .SetFont(regular).SetFontSize(11).SetFontColor(TextDark)
                    .SetMarginBottom(20));
            }

            // ── Data e local ──
            document.Add(new Paragraph($"São Paulo, {BrazilDateTime.FormatLongDate(data.EmissionDate)}")
                .SetFont(regular).SetFontSize(11).SetFontColor(TextMedium)
                .SetTextAlignment(TextAlignment.CENTER).SetMarginTop(30));

            // ── Assinatura digital ──
            document.Add(new Paragraph("_______________________________________")
                .SetTextAlignment(TextAlignment.CENTER).SetMarginTop(30)
                .SetFontColor(TextLight));

            document.Add(new Paragraph($"Dr(a). {data.DoctorName}\nCRM {data.DoctorCrm}/{data.DoctorCrmState}\n{data.DoctorSpecialty}")
                .SetFont(regular).SetFontSize(10).SetFontColor(TextMedium)
                .SetTextAlignment(TextAlignment.CENTER));

            // ── Rodapé: verificação ──
            var verifyFooter = "\nDocumento assinado digitalmente com certificado ICP-Brasil.\n" +
                $"Verifique a autenticidade em: {verifyUrl}";
            if (!string.IsNullOrEmpty(data.AccessCode))
                verifyFooter += $"\nCódigo de verificação: {data.AccessCode}";
            document.Add(new Paragraph(verifyFooter)
                .SetFont(regular).SetFontSize(8).SetFontColor(TextLight)
                .SetTextAlignment(TextAlignment.CENTER).SetMarginTop(20));

            document.Add(new Paragraph(CompanyLine1 + "\n" + CompanyLine2)
                .SetFont(regular).SetFontSize(7).SetFontColor(TextLight)
                .SetTextAlignment(TextAlignment.CENTER).SetMarginTop(8));

            document.Close();

            _logger.LogInformation("Medical certificate PDF generated for request {RequestId}", data.RequestId);

            return new PrescriptionPdfResult(true, ms.ToArray(), null, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate medical certificate PDF for request {RequestId}", data.RequestId);
            return new PrescriptionPdfResult(false, null, null, ex.Message);
        }
    }
}
