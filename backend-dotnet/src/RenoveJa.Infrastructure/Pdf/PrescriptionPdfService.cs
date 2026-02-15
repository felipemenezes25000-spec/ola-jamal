using iText.IO.Font.Constants;
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

    // Cores institucionais RenoveJá
    private static readonly Color RenovejaGreen = new DeviceRgb(0, 153, 102);   // #009966
    private static readonly Color RenovejaBlue = new DeviceRgb(0, 102, 178);    // #0066B2
    private static readonly Color LightGrayBg = new DeviceRgb(245, 245, 245);   // #F5F5F5
    private static readonly Color MediumGray = new DeviceRgb(120, 120, 120);    // #787878
    private static readonly Color DarkText = new DeviceRgb(33, 33, 33);         // #212121

    private const string DefaultVerificationBaseUrl = "https://renoveja.com/verificar";
    private const string DefaultPharmacyUrl = "https://farmacias.renovejasaude.com.br";

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
            // Build medication items list (backward compat: use old Medications list if MedicationItems is null)
            var medicationItems = BuildMedicationItems(data);

            if (medicationItems.Count == 0)
            {
                medicationItems = new List<PrescriptionMedicationItem> { new("Prescrição a critério médico", null, "Conforme orientação médica", null, null) };
            }

            var accessCode = data.AccessCode ?? GenerateAccessCode(data.RequestId);
            var baseUrl = !string.IsNullOrWhiteSpace(_verificationConfig.BaseUrl)
                ? _verificationConfig.BaseUrl.TrimEnd('/')
                : DefaultVerificationBaseUrl;
            var verificationUrl = data.VerificationUrl ?? $"{baseUrl}/{data.RequestId}";
            var pharmacyUrl = data.PharmacyValidationUrl ?? DefaultPharmacyUrl;

            using var ms = new MemoryStream();
            using var writer = new PdfWriter(ms);
            using var pdf = new PdfDocument(writer);

            // PDF Metadata
            var info = pdf.GetDocumentInfo();
            info.SetTitle($"Receita Digital - {data.PatientName} - {data.EmissionDate:dd/MM/yyyy}");
            info.SetAuthor($"Dr(a). {data.DoctorName} | CRM {data.DoctorCrm}/{data.DoctorCrmState}");
            info.SetCreator("RenoveJá Saúde - Sistema de Receitas Digitais");
            info.SetSubject($"Receita médica digital - {data.PrescriptionType}");
            info.SetKeywords("receita digital, ICP-Brasil, RenoveJá Saúde, prescrição médica");

            using var document = new Document(pdf, PageSize.A4);
            document.SetMargins(40, 40, 60, 40); // top, right, bottom, left

            var font = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);
            var fontBold = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
            var fontItalic = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_OBLIQUE);

            // Generate one page per medication
            for (int i = 0; i < medicationItems.Count; i++)
            {
                if (i > 0)
                {
                    document.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));
                }

                var med = medicationItems[i];

                // === HEADER: Logo text + prescription type ===
                AddHeader(document, data, fontBold, font, i + 1, medicationItems.Count);

                // === SEPARATOR LINE ===
                AddSeparator(document);

                // === PATIENT DATA SECTION ===
                AddPatientSection(document, data, fontBold, font);

                // === SEPARATOR LINE ===
                AddSeparator(document);

                // === MEDICATION SECTION (main content) ===
                AddMedicationSection(document, med, fontBold, font, fontItalic, i + 1);

                // === OBSERVATION SECTION ===
                AddObservationSection(document, med, data, font, fontBold, fontItalic);

                // === QR CODE + VERIFICATION INSTRUCTIONS ===
                AddQrCodeSection(document, verificationUrl, accessCode, font, fontBold);

                // === DOCTOR INFO ===
                AddDoctorSection(document, data, fontBold, font);

                // === PHARMACY LINK ===
                AddPharmacyLink(document, pharmacyUrl, font, fontItalic);

                // === LEGAL FOOTER ===
                AddLegalFooter(document, data, font, fontItalic);
            }

            document.Close();

            return Task.FromResult(new PrescriptionPdfResult(true, ms.ToArray(), null, null));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar PDF de receita para solicitação {RequestId}", data.RequestId);
            return Task.FromResult(new PrescriptionPdfResult(false, null, null, $"Erro ao gerar PDF: {ex.Message}"));
        }
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
            info.SetTitle($"Pedido de Exame - {data.PatientName} - {data.EmissionDate:dd/MM/yyyy}");
            info.SetAuthor($"Dr(a). {data.DoctorName} | CRM {data.DoctorCrm}/{data.DoctorCrmState}");
            info.SetCreator("RenoveJá Saúde - Sistema de Pedidos de Exame");
            info.SetSubject("Pedido de exame médico digital");

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
            .SetMarginBottom(5);

        var logoCell = new Cell().SetBorder(Border.NO_BORDER).SetVerticalAlignment(VerticalAlignment.MIDDLE);
        var logoParagraph = new Paragraph();
        logoParagraph.Add(new Text("RenoveJá").SetFont(fontBold).SetFontSize(20).SetFontColor(RenovejaGreen));
        logoParagraph.Add(new Text(" Saúde").SetFont(fontBold).SetFontSize(20).SetFontColor(RenovejaBlue));
        logoCell.Add(logoParagraph);
        logoTable.AddCell(logoCell);

        var rightCell = new Cell()
            .SetBorder(Border.NO_BORDER)
            .SetTextAlignment(TextAlignment.RIGHT)
            .SetVerticalAlignment(VerticalAlignment.MIDDLE);
        rightCell.Add(new Paragraph("PEDIDO DE EXAME")
            .SetFont(fontBold)
            .SetFontSize(11)
            .SetFontColor(DarkText));
        logoTable.AddCell(rightCell);
        document.Add(logoTable);
    }

    private static void AddPatientSectionFromExam(Document document, ExamPdfData data, PdfFont fontBold, PdfFont font)
    {
        var sectionTitle = new Paragraph("DADOS DO PACIENTE")
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
        AddPatientInfoCell(patientTable, "Data de Emissão:", data.EmissionDate.ToString("dd/MM/yyyy 'às' HH:mm"), fontBold, font);

        document.Add(patientTable);
    }

    private static void AddExamListSection(Document document, List<string> exams, string? notes, PdfFont fontBold, PdfFont font, PdfFont fontItalic)
    {
        var sectionTitle = new Paragraph("EXAMES SOLICITADOS")
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
        var qrData = $"{verificationUrl}?code={accessCode}";
        var qrBytes = GenerateQrCode(qrData);
        if (qrBytes == null)
            return;

        var qrTable = new Table(UnitValue.CreatePercentArray(new float[] { 1, 1 }))
            .UseAllAvailableWidth()
            .SetMarginBottom(8);

        var textCell = new Cell().SetBorder(Border.NO_BORDER).SetVerticalAlignment(VerticalAlignment.MIDDLE);
        textCell.Add(new Paragraph("Verificação").SetFont(fontBold).SetFontSize(9).SetFontColor(DarkText).SetMarginBottom(4));
        textCell.Add(new Paragraph("Escaneie o QR Code ou acesse validar.iti.gov.br para validar a autenticidade deste documento.")
            .SetFont(font).SetFontSize(8).SetFontColor(MediumGray));
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
        var doctorInfo = new Paragraph();
        doctorInfo.Add(new Text($"Dr(a). {data.DoctorName}").SetFont(fontBold).SetFontSize(10).SetFontColor(DarkText));
        doctorInfo.Add(new Text($" | CRM {data.DoctorCrm} {data.DoctorCrmState}").SetFont(font).SetFontSize(10).SetFontColor(MediumGray));
        if (!string.IsNullOrWhiteSpace(data.DoctorSpecialty))
            doctorInfo.Add(new Text($" | {data.DoctorSpecialty}").SetFont(font).SetFontSize(9).SetFontColor(MediumGray));
        document.Add(doctorInfo.SetMarginBottom(6));
    }

    private static void AddLegalFooterFromExam(Document document, ExamPdfData data, PdfFont font, PdfFont fontItalic)
    {
        AddSeparator(document);
        var legalText = new Paragraph()
            .SetMarginTop(4);
        legalText.Add(new Text("Importante: ").SetFont(fontItalic).SetFontSize(7).SetFontColor(MediumGray));
        legalText.Add(new Text("Verifique a autenticidade em: validar.iti.gov.br\n").SetFont(font).SetFontSize(7).SetFontColor(MediumGray));
        legalText.Add(new Text($"Assinado digitalmente conforme ICP-Brasil por Dr(a). {data.DoctorName} em {data.EmissionDate:dd/MM/yyyy 'às' HH:mm}.")
            .SetFont(font).SetFontSize(7).SetFontColor(MediumGray));
        document.Add(legalText);
    }

    #region Page Sections

    private static void AddHeader(Document document, PrescriptionPdfData data, PdfFont fontBold, PdfFont font, int pageNum, int totalPages)
    {
        // Logo text "RenoveJá Saúde" in green/blue
        var logoTable = new Table(UnitValue.CreatePercentArray(new float[] { 60, 40 }))
            .UseAllAvailableWidth()
            .SetMarginBottom(5);

        // Left: Logo text
        var logoCell = new Cell()
            .SetBorder(Border.NO_BORDER)
            .SetVerticalAlignment(VerticalAlignment.MIDDLE);

        var logoParagraph = new Paragraph();
        logoParagraph.Add(new Text("RenoveJá")
            .SetFont(fontBold)
            .SetFontSize(20)
            .SetFontColor(RenovejaGreen));
        logoParagraph.Add(new Text(" Saúde")
            .SetFont(fontBold)
            .SetFontSize(20)
            .SetFontColor(RenovejaBlue));
        logoCell.Add(logoParagraph);
        logoTable.AddCell(logoCell);

        // Right: Prescription type label + page counter
        var typeLabel = GetPrescriptionTypeLabel(data.PrescriptionType);
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
            .SetBorderBottom(new SolidBorder(new DeviceRgb(200, 200, 200), 0.5f))
            .SetHeight(1);
        separator.AddCell(sepCell);
        document.Add(separator);
    }

    private static void AddPatientSection(Document document, PrescriptionPdfData data, PdfFont fontBold, PdfFont font)
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

        // Birth date
        if (data.PatientBirthDate.HasValue)
        {
            AddPatientInfoCell(patientTable, "Nascimento:", data.PatientBirthDate.Value.ToString("dd/MM/yyyy"), fontBold, font);
        }
        else
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
            // Empty cell to keep alignment
            var emptyCell = new Cell().SetBorder(Border.NO_BORDER);
            patientTable.AddCell(emptyCell);
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
            .SetPadding(12)
            .SetBorderRadius(new BorderRadius(4));

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
            .SetFontColor(RenovejaBlue)
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

        document.Add(doctorInfo.SetMarginBottom(6));
    }

    private static void AddPharmacyLink(Document document, string pharmacyUrl, PdfFont font, PdfFont fontItalic)
    {
        document.Add(new Paragraph($"Farmacêutico, valide a receita digital em {pharmacyUrl}")
            .SetFont(fontItalic)
            .SetFontSize(8)
            .SetFontColor(RenovejaBlue)
            .SetMarginBottom(10));
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

    private static string FormatCpf(string cpf)
    {
        cpf = cpf.Replace(".", "").Replace("-", "");
        if (cpf.Length != 11)
            return cpf;
        return $"{cpf[..3]}.{cpf[3..6]}.{cpf[6..9]}-{cpf[9..]}";
    }

    #endregion
}
