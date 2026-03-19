using System.Text.Json;
using System.Text.RegularExpressions;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// Helpers estáticos para parse e enriquecimento do JSON de anamnese (IA).
/// Implementação dividida em arquivos parciais por responsabilidade.
/// </summary>
internal static partial class AnamnesisResponseParser
{
    internal static readonly Regex CidCodeRegex = new(@"\b([A-Z]\d{2}(?:\.\d+)?)\b", RegexOptions.Compiled);

    private static readonly JsonSerializerOptions JsonOptionsSnakeCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = false
    };
}
