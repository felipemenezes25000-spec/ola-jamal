namespace RenoveJa.Domain.Exceptions;

/// <summary>
/// Exceção de domínio para erros de regra de negócio.
/// </summary>
public class DomainException : Exception
{
    /// <summary>
    /// Construtor com mensagem de erro.
    /// </summary>
    public DomainException(string message) : base(message)
    {
    }

    /// <summary>
    /// Construtor com exceção interna para encadeamento.
    /// </summary>
    public DomainException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
