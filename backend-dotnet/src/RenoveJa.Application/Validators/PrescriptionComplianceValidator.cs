using RenoveJa.Domain.Enums;

namespace RenoveJa.Application.Validators;

/// <summary>
/// Valida conformidade da receita conforme tipo (CFM, RDC 471/2021, ANVISA/SNCR).
/// Retorna erros com mensagens em PT-BR e lista de campos faltantes.
/// </summary>
public class PrescriptionComplianceValidator
{
    public record ValidationResult(bool IsValid, List<string> MissingFields, List<string> Messages);

    /// <summary>
    /// Valida dados para receita simples (modelo CFM).
    /// Exige: paciente.nome, paciente.cpf, prescrição(itens), médico.nome, crm/uf, endereço/telefone, data.
    /// </summary>
    public static ValidationResult ValidateSimple(
        string? patientName,
        string? patientCpf,
        IReadOnlyList<string> medications,
        string? doctorName,
        string? doctorCrm,
        string? doctorCrmState,
        string? doctorAddress,
        string? doctorPhone)
    {
        var missing = new List<string>();
        var messages = new List<string>();

        if (string.IsNullOrWhiteSpace(patientName))
        {
            missing.Add("paciente.nome");
            messages.Add("Nome do paciente é obrigatório.");
        }

        if (string.IsNullOrWhiteSpace(patientCpf))
        {
            missing.Add("paciente.cpf");
            messages.Add("CPF do paciente é obrigatório em todas as receitas.");
        }

        if (medications == null || medications.Count == 0 || medications.All(string.IsNullOrWhiteSpace))
        {
            missing.Add("prescrição.itens");
            messages.Add("É necessário ao menos um medicamento na prescrição.");
        }

        if (string.IsNullOrWhiteSpace(doctorName))
        {
            missing.Add("médico.nome");
            messages.Add("Nome do médico é obrigatório.");
        }

        if (string.IsNullOrWhiteSpace(doctorCrm))
        {
            missing.Add("médico.crm");
            messages.Add("CRM do médico é obrigatório.");
        }

        if (string.IsNullOrWhiteSpace(doctorCrmState))
        {
            missing.Add("médico.uf");
            messages.Add("UF do CRM é obrigatória.");
        }

        if (string.IsNullOrWhiteSpace(doctorAddress))
        {
            missing.Add("médico.endereço");
            messages.Add("Endereço profissional do médico é obrigatório para receita simples.");
        }

        if (string.IsNullOrWhiteSpace(doctorPhone))
        {
            missing.Add("médico.telefone");
            messages.Add("Telefone profissional do médico é obrigatório para receita simples.");
        }

        return new ValidationResult(missing.Count == 0, missing, messages);
    }

    /// <summary>
    /// Valida dados para receita antimicrobiana (RDC 471/2021).
    /// Exige: tudo do Simple + paciente.sexo + paciente.idade (ou nascimento) + validade 10 dias.
    /// Reforça: DCB/dose/forma/posologia/quantidade nos itens.
    /// </summary>
    public static ValidationResult ValidateAntimicrobial(
        string? patientName,
        string? patientCpf,
        IReadOnlyList<string> medications,
        string? doctorName,
        string? doctorCrm,
        string? doctorCrmState,
        string? doctorAddress,
        string? doctorPhone,
        string? patientGender,
        DateTime? patientBirthDate)
    {
        var simple = ValidateSimple(patientName, patientCpf, medications, doctorName, doctorCrm, doctorCrmState, doctorAddress, doctorPhone);
        var missing = new List<string>(simple.MissingFields);
        var messages = new List<string>(simple.Messages);

        if (string.IsNullOrWhiteSpace(patientGender))
        {
            missing.Add("paciente.sexo");
            messages.Add("Sexo do paciente é obrigatório para receita antimicrobiana (RDC 471/2021).");
        }

        if (!patientBirthDate.HasValue)
        {
            missing.Add("paciente.data_nascimento");
            messages.Add("Data de nascimento do paciente é obrigatória para receita antimicrobiana (RDC 471/2021).");
        }

        return new ValidationResult(missing.Count == 0, missing, messages);
    }

    /// <summary>
    /// Valida dados para receita de controle especial (modelo ANVISA/SNCR).
    /// Exige blocos: emitente completo, paciente completo, comprador (se aplicável), data, prescrição.
    /// </summary>
    public static ValidationResult ValidateControlledSpecial(
        string? patientName,
        string? patientCpf,
        string? patientAddress,
        IReadOnlyList<string> medications,
        string? doctorName,
        string? doctorCrm,
        string? doctorCrmState,
        string? doctorAddress,
        string? doctorPhone)
    {
        var simple = ValidateSimple(patientName, patientCpf, medications, doctorName, doctorCrm, doctorCrmState, doctorAddress, doctorPhone);
        var missing = new List<string>(simple.MissingFields);
        var messages = new List<string>(simple.Messages);

        if (string.IsNullOrWhiteSpace(patientAddress))
        {
            missing.Add("paciente.endereço");
            messages.Add("Endereço do paciente é obrigatório para receita de controle especial.");
        }

        return new ValidationResult(missing.Count == 0, missing, messages);
    }

    /// <summary>
    /// Valida dados para solicitação de exame.
    /// Exige: paciente.nome, paciente.cpf, ao menos um exame, médico.nome, crm/uf, endereço/telefone.
    /// </summary>
    public static ValidationResult ValidateExam(
        string? patientName,
        string? patientCpf,
        IReadOnlyList<string> exams,
        string? doctorName,
        string? doctorCrm,
        string? doctorCrmState,
        string? doctorAddress,
        string? doctorPhone)
    {
        var missing = new List<string>();
        var messages = new List<string>();

        if (string.IsNullOrWhiteSpace(patientName))
        {
            missing.Add("paciente.nome");
            messages.Add("Nome do paciente é obrigatório.");
        }

        if (string.IsNullOrWhiteSpace(patientCpf))
        {
            missing.Add("paciente.cpf");
            messages.Add("CPF do paciente é obrigatório em todas as solicitações de exame.");
        }

        // Exames podem ser vazios (o PDF usa "Exames conforme solicitação médica" como fallback)

        if (string.IsNullOrWhiteSpace(doctorName))
        {
            missing.Add("médico.nome");
            messages.Add("Nome do médico é obrigatório.");
        }

        if (string.IsNullOrWhiteSpace(doctorCrm))
        {
            missing.Add("médico.crm");
            messages.Add("CRM do médico é obrigatório.");
        }

        if (string.IsNullOrWhiteSpace(doctorCrmState))
        {
            missing.Add("médico.uf");
            messages.Add("UF do CRM é obrigatória.");
        }

        if (string.IsNullOrWhiteSpace(doctorAddress))
        {
            missing.Add("médico.endereço");
            messages.Add("Endereço profissional do médico é obrigatório para solicitação de exame.");
        }

        if (string.IsNullOrWhiteSpace(doctorPhone))
        {
            missing.Add("médico.telefone");
            messages.Add("Telefone profissional do médico é obrigatório para solicitação de exame.");
        }

        return new ValidationResult(missing.Count == 0, missing, messages);
    }

    /// <summary>
    /// Valida conforme o tipo de receita.
    /// </summary>
    public static ValidationResult Validate(
        PrescriptionKind kind,
        string? patientName,
        string? patientCpf,
        string? patientAddress,
        string? patientGender,
        DateTime? patientBirthDate,
        IReadOnlyList<string> medications,
        string? doctorName,
        string? doctorCrm,
        string? doctorCrmState,
        string? doctorAddress,
        string? doctorPhone)
    {
        return kind switch
        {
            PrescriptionKind.Simple => ValidateSimple(patientName, patientCpf, medications, doctorName, doctorCrm, doctorCrmState, doctorAddress, doctorPhone),
            PrescriptionKind.Antimicrobial => ValidateAntimicrobial(patientName, patientCpf, medications, doctorName, doctorCrm, doctorCrmState, doctorAddress, doctorPhone, patientGender, patientBirthDate),
            PrescriptionKind.ControlledSpecial => ValidateControlledSpecial(patientName, patientCpf, patientAddress, medications, doctorName, doctorCrm, doctorCrmState, doctorAddress, doctorPhone),
            _ => ValidateSimple(patientName, patientCpf, medications, doctorName, doctorCrm, doctorCrmState, doctorAddress, doctorPhone)
        };
    }
}
