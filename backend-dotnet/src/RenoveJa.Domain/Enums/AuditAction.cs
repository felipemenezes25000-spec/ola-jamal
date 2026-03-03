namespace RenoveJa.Domain.Enums;

/// <summary>
/// Ações básicas de auditoria aplicáveis a entidades clínicas sensíveis.
/// </summary>
public enum AuditAction
{
    Read = 1,
    Create = 2,
    Update = 3,
    Delete = 4,
    Sign = 5,
    Export = 6
}

