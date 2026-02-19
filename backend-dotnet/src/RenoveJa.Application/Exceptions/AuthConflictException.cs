namespace RenoveJa.Application.Exceptions;

/// <summary>
/// Exceção lançada quando há conflito em operação de auth (ex.: email já cadastrado).
/// Retorna 409 Conflict com mensagem clara.
/// </summary>
public class AuthConflictException : InvalidOperationException
{
    public AuthConflictException(string message) : base(message) { }
}
