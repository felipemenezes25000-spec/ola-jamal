namespace RenoveJa.Application.Exceptions;

/// <summary>
/// Exceção lançada quando a validação de conformidade da receita falha (campos obrigatórios faltando).
/// O controller retorna 400 com missingFields e messages.
/// </summary>
public class PrescriptionValidationException : InvalidOperationException
{
    public IReadOnlyList<string> MissingFields { get; }
    public IReadOnlyList<string> Messages { get; }

    public PrescriptionValidationException(
        IReadOnlyList<string> missingFields,
        IReadOnlyList<string> messages)
        : base($"Receita incompleta: {string.Join("; ", messages)}")
    {
        MissingFields = missingFields;
        Messages = messages;
    }
}
