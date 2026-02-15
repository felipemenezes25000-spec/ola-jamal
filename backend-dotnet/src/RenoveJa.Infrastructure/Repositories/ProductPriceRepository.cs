using System.Text.Json.Serialization;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório para consulta de preços fixos na tabela product_prices.
/// </summary>
public class ProductPriceRepository(SupabaseClient supabase) : IProductPriceRepository
{
    private const string TableName = "product_prices";

    public async Task<decimal?> GetPriceAsync(string productType, string subtype, CancellationToken cancellationToken = default)
    {
        var pt = productType?.Trim().ToLowerInvariant() ?? "prescription";
        var st = subtype?.Trim().ToLowerInvariant() ?? "default";

        var results = await supabase.GetAllAsync<ProductPriceRow>(
            TableName,
            select: "price_brl",
            filter: $"product_type=eq.{pt}&subtype=eq.{st}&is_active=eq.true",
            cancellationToken: cancellationToken);

        return results.Count > 0 ? results[0].PriceBrl : null;
    }

    private class ProductPriceRow
    {
        [JsonPropertyName("price_brl")]
        public decimal PriceBrl { get; set; }
    }
}
