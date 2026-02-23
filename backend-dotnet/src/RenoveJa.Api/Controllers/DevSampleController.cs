using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Endpoints de desenvolvimento para gerar PDFs de exemplo (receita e exame) para teste.
/// Use apenas em ambiente de desenvolvimento.
/// </summary>
[ApiController]
[Route("api/dev")]
[AllowAnonymous]
public class DevSampleController : ControllerBase
{
    private readonly IPrescriptionPdfService _pdfService;

    public DevSampleController(IPrescriptionPdfService pdfService)
    {
        _pdfService = pdfService;
    }

    /// <summary>
    /// Gera um PDF de receita simples de exemplo (dados fictícios) para teste visual.
    /// </summary>
    [HttpGet("sample-prescription-pdf")]
    public async Task<IActionResult> GetSamplePrescriptionPdf(CancellationToken cancellationToken)
    {
        var requestId = Guid.NewGuid();
        var data = new PrescriptionPdfData(
            RequestId: requestId,
            PatientName: "Maria da Silva Santos",
            PatientCpf: "123.456.789-00",
            DoctorName: "Dr. João Carlos Oliveira",
            DoctorCrm: "123456",
            DoctorCrmState: "SP",
            DoctorSpecialty: "Clínica Geral",
            Medications: new List<string>
            {
                "Dipirona 500mg — 1 comprimido de 6/6h se dor — 20 comprimidos",
                "Paracetamol 750mg — 1 comprimido 8/8h — 15 comprimidos"
            },
            PrescriptionType: "simples",
            EmissionDate: DateTime.UtcNow,
            PatientAddress: "Rua das Flores, 100 — Centro — São Paulo/SP",
            PatientBirthDate: new DateTime(1985, 3, 15),
            AccessCode: GenerateAccessCode(requestId),
            PrescriptionKind: PrescriptionKind.Simple,
            PatientGender: "F",
            PatientPhone: "(11) 98765-4321",
            DoctorAddress: "Av. Paulista, 1000 — Consultório 501 — São Paulo/SP",
            DoctorPhone: "(11) 3456-7890");

        var result = await _pdfService.GenerateAsync(data, cancellationToken);
        if (!result.Success || result.PdfBytes == null)
            return BadRequest(new { error = result.ErrorMessage ?? "Falha ao gerar PDF de exemplo." });

        return File(result.PdfBytes, "application/pdf", "exemplo-receita-simples.pdf");
    }

    /// <summary>
    /// Gera um PDF de solicitação de exames de exemplo (dados fictícios) para teste visual.
    /// </summary>
    [HttpGet("sample-exam-pdf")]
    public async Task<IActionResult> GetSampleExamPdf(CancellationToken cancellationToken)
    {
        var requestId = Guid.NewGuid();
        var data = new ExamPdfData(
            RequestId: requestId,
            PatientName: "Carlos Eduardo Souza",
            PatientCpf: "987.654.321-00",
            DoctorName: "Dra. Ana Paula Lima",
            DoctorCrm: "654321",
            DoctorCrmState: "RJ",
            DoctorSpecialty: "Endocrinologia",
            Exams: new List<string>
            {
                "Glicemia de jejum",
                "Hemoglobina glicada (HbA1c)",
                "Creatinina",
                "TSH e T4 livre",
                "Hemograma completo"
            },
            Notes: "Paciente em acompanhamento para rastreamento de diabetes e função tireoidiana.",
            EmissionDate: DateTime.UtcNow,
            AccessCode: GenerateAccessCode(requestId),
            PatientBirthDate: new DateTime(1978, 7, 22),
            PatientPhone: "(21) 99876-5432",
            PatientAddress: "Rua do Comércio, 200 — Copacabana — Rio de Janeiro/RJ",
            DoctorAddress: "Rua Voluntários da Pátria, 500 — Botafogo — Rio de Janeiro/RJ",
            DoctorPhone: "(21) 2345-6789",
            ClinicalIndication: "Rastreamento de diabetes e disfunção tireoidiana.");

        var result = await _pdfService.GenerateExamRequestAsync(data, cancellationToken);
        if (!result.Success || result.PdfBytes == null)
            return BadRequest(new { error = result.ErrorMessage ?? "Falha ao gerar PDF de exemplo." });

        return File(result.PdfBytes, "application/pdf", "exemplo-solicitacao-exames.pdf");
    }

    private static string GenerateAccessCode(Guid requestId)
    {
        var hash = SHA256.HashData(requestId.ToByteArray());
        return Convert.ToHexString(hash.AsSpan(0, 4)).ToLowerInvariant();
    }
}
