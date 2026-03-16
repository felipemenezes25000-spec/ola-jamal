namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de geração de notas SOAP pós-consulta.
/// Recebe o transcript completo e a anamnese estruturada e retorna
/// um documento SOAP em PT-BR conforme padrão CFM.
/// </summary>
public interface ISoapNotesService
{
    /// <summary>
    /// Gera notas SOAP a partir do transcript e anamnese da consulta.
    /// </summary>
    /// <param name="transcriptText">Transcript completo da consulta com labels [Médico]/[Paciente].</param>
    /// <param name="anamnesisJson">JSON da anamnese estruturada gerada durante a consulta (pode ser null).</param>
    /// <param name="cancellationToken">Token de cancelamento.</param>
    /// <returns>SoapNotesResult com as 4 seções + termos médicos, ou null se não foi possível gerar.</returns>
    Task<SoapNotesResult?> GenerateAsync(
        string transcriptText,
        string? anamnesisJson,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Resultado da geração de notas SOAP.
/// </summary>
public sealed record SoapNotesResult(
    /// <summary>S — Subjetivo: queixas e sintomas relatados pelo paciente.</summary>
    string Subjective,
    /// <summary>O — Objetivo: achados clínicos observados pelo médico.</summary>
    string Objective,
    /// <summary>A — Avaliação: diagnóstico(s) e raciocínio clínico.</summary>
    string Assessment,
    /// <summary>P — Plano: conduta, prescrições, encaminhamentos, retorno.</summary>
    string Plan,
    /// <summary>Termos médicos extraídos (condições, medicamentos, exames).</summary>
    IReadOnlyList<MedicalTerm> MedicalTerms,
    /// <summary>JSON serializado completo para persistência.</summary>
    string RawJson
);

public sealed record MedicalTerm(
    string Term,
    string Category,  // "condition" | "medication" | "procedure" | "exam"
    string? IcdCode
);
