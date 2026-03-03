namespace RenoveJa.Domain.Enums;

/// <summary>
/// Ciclo de vida básico de um documento médico.
/// </summary>
public enum DocumentStatus
{
    Draft = 1,
    Signed = 2,
    Cancelled = 3,
    Superseded = 4
}

