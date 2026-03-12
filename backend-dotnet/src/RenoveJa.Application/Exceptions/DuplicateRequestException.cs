namespace RenoveJa.Application.Exceptions;

/// <summary>
/// Lançada quando o paciente tenta criar uma solicitação que já existe
/// ou viola o período mínimo entre renovações.
/// Retorna HTTP 409 Conflict com cooldownDays para o frontend exibir
/// uma mensagem clara ao usuário.
/// </summary>
public class DuplicateRequestException : InvalidOperationException
{
    /// <summary>
    /// Dias restantes até o paciente poder solicitar novamente.
    /// Null = bloqueio por pedido ativo (sem prazo definido).
    /// </summary>
    public int? CooldownDays { get; }

    /// <summary>
    /// Código da regra violada para o frontend diferenciar o tipo de bloqueio.
    /// Valores: "active_request" | "cooldown_prescription" | "cooldown_exam"
    /// </summary>
    public string Code { get; }

    public DuplicateRequestException(string message, string code, int? cooldownDays = null)
        : base(message)
    {
        Code = code;
        CooldownDays = cooldownDays;
    }
}
