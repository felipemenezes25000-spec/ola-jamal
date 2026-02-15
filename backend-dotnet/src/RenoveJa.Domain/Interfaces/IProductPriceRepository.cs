namespace RenoveJa.Domain.Interfaces;

/// <summary>
/// Repositório para consulta de preços fixos por produto (prescrição, exame, consulta).
/// O valor é consultado no approve e no fluxo de pagamento — não é informado pelo médico.
/// </summary>
public interface IProductPriceRepository
{
    /// <summary>
    /// Obtém o preço em BRL para o produto/tipo. Ex.: prescription+simples -> 50, prescription+azul -> 100.
    /// </summary>
    Task<decimal?> GetPriceAsync(string productType, string subtype, CancellationToken cancellationToken = default);
}
