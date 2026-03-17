using System.ComponentModel.DataAnnotations;

namespace RenoveJa.Application.DTOs.Clinical;

/// <summary>
/// DTO para emissão em lote de documentos pós-consulta.
/// O médico envia receita + exames + atestado num único request; o backend cria, gera PDFs e assina tudo.
/// </summary>
public record PostConsultationEmitRequest
{
    /// <summary>ID do request (consultation) que originou a pós-consulta.</summary>
    [Required]
    public Guid RequestId { get; init; }

    /// <summary>CID-10 principal identificado (ex: "J11").</summary>
    public string? MainIcd10Code { get; init; }

    /// <summary>Anamnese narrativa (texto livre ou gerada pela IA).</summary>
    public string? Anamnesis { get; init; }

    /// <summary>Anamnese estruturada completa (JSON da IA).</summary>
    public string? StructuredAnamnesis { get; init; }

    /// <summary>Exame físico relatado.</summary>
    public string? PhysicalExam { get; init; }

    /// <summary>Plano terapêutico / conduta.</summary>
    public string? Plan { get; init; }

    /// <summary>Hipóteses diagnósticas / diagnóstico diferencial.</summary>
    public string? DifferentialDiagnosis { get; init; }

    /// <summary>Orientações ao paciente.</summary>
    public string? PatientInstructions { get; init; }

    /// <summary>Alertas vermelhos (red flags).</summary>
    public string? RedFlags { get; init; }

    // ── Receita (opcional) ──
    /// <summary>Se não-nulo, emite receita com estes medicamentos.</summary>
    public PrescriptionEmitDto? Prescription { get; init; }

    // ── Exames (opcional) ──
    /// <summary>Se não-nulo, emite pedido de exames.</summary>
    public ExamOrderEmitDto? ExamOrder { get; init; }

    // ── Atestado (opcional) ──
    /// <summary>Se não-nulo, emite atestado médico.</summary>
    public MedicalCertificateEmitDto? MedicalCertificate { get; init; }

    // ── Encaminhamento (opcional) ──
    /// <summary>Se não-nulo, emite encaminhamento para médico/profissional presencial.</summary>
    public ReferralEmitDto? Referral { get; init; }
}

public record ReferralEmitDto
{
    /// <summary>Nome do médico ou profissional para quem encaminhar.</summary>
    [Required] public string ProfessionalName { get; init; } = null!;
    /// <summary>Especialidade ou área (ex: Cardiologia, Fisioterapia).</summary>
    public string? Specialty { get; init; }
    /// <summary>Motivo/indicação do encaminhamento (conforme anamnese).</summary>
    [Required] public string Reason { get; init; } = null!;
    /// <summary>CID-10 relacionado (opcional).</summary>
    public string? Icd10Code { get; init; }
}

public record PrescriptionEmitDto
{
    /// <summary>"simples" ou "controlado".</summary>
    public string Type { get; init; } = "simples";
    public string? GeneralInstructions { get; init; }
    public List<PrescriptionItemEmitDto> Items { get; init; } = [];
}

public record PrescriptionItemEmitDto
{
    [Required] public string Drug { get; init; } = null!;
    public string? Concentration { get; init; }
    public string? Form { get; init; }
    public string? Posology { get; init; }
    public string? Duration { get; init; }
    public int? Quantity { get; init; }
    public string? Notes { get; init; }
}

public record ExamOrderEmitDto
{
    public string? ClinicalJustification { get; init; }
    public string? Priority { get; init; }
    public List<ExamItemEmitDto> Items { get; init; } = [];
}

public record ExamItemEmitDto
{
    public string Type { get; init; } = "laboratorial";
    public string? Code { get; init; }
    [Required] public string Description { get; init; } = null!;
}

public record MedicalCertificateEmitDto
{
    /// <summary>Tipo: "afastamento", "comparecimento", "aptidao".</summary>
    public string CertificateType { get; init; } = "afastamento";
    /// <summary>Texto do atestado (motivo/justificativa).</summary>
    [Required] public string Body { get; init; } = null!;
    /// <summary>CID-10 (opcional, só aparece no atestado se autorizado pelo paciente).</summary>
    public string? Icd10Code { get; init; }
    /// <summary>Dias de afastamento (para tipo "afastamento").</summary>
    public int? LeaveDays { get; init; }
    /// <summary>Data de início do afastamento.</summary>
    public DateTime? LeaveStartDate { get; init; }
    /// <summary>"integral" ou "meio_periodo".</summary>
    public string? LeavePeriod { get; init; }
    /// <summary>Se true, inclui CID no atestado impresso.</summary>
    public bool IncludeIcd10 { get; init; } = true;
}

/// <summary>Resposta da emissão em lote.</summary>
public record PostConsultationEmitResponse
{
    public Guid EncounterId { get; init; }
    public Guid? PrescriptionId { get; init; }
    public Guid? ExamOrderId { get; init; }
    public Guid? MedicalCertificateId { get; init; }
    public Guid? ReferralId { get; init; }
    public int DocumentsEmitted { get; init; }
    public List<string> DocumentTypes { get; init; } = [];
    public string Message { get; init; } = null!;
    /// <summary>Avisos de duplicidade (não bloqueantes — médico tem decisão final).</summary>
    public List<string> Warnings { get; init; } = [];
}
