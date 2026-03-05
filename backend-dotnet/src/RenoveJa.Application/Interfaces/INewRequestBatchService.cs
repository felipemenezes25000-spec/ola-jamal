namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de batching para notificações "nova solicitação" — agrupa múltiplos pedidos em 2 min em um único push "X novas solicitações".
/// </summary>
public interface INewRequestBatchService
{
    /// <summary>
    /// Adiciona um novo pedido ao batch do médico. O push será enviado após 2 min ou quando o batch for flushado.
    /// </summary>
    void AddToBatch(Guid doctorId, string tipoSolicitacao);
}
