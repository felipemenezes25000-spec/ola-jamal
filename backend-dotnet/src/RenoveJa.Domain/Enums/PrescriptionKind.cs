namespace RenoveJa.Domain.Enums;

/// <summary>
/// Tipo de receita para conformidade regulatória e layout de PDF.
/// - Simple: Receita Simples (modelo CFM)
/// - Antimicrobial: Receita Antimicrobiana (RDC 471/2021 - validade 10 dias)
/// - ControlledSpecial: Receita de Controle Especial "branca" (ANVISA/SNCR)
/// </summary>
public enum PrescriptionKind
{
    Simple,
    Antimicrobial,
    ControlledSpecial
}
