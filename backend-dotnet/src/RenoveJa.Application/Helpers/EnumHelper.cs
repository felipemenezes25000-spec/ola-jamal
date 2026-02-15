using System.Text.RegularExpressions;

namespace RenoveJa.Application.Helpers;

/// <summary>
/// Helper para converter nomes de enums PascalCase em snake_case para consistência com API REST/JSON.
/// Ex: InReview → "in_review", ApprovedPendingPayment → "approved_pending_payment"
/// </summary>
public static partial class EnumHelper
{
    public static string ToSnakeCase<T>(T value) where T : Enum
        => PascalToSnakeCase(value.ToString());

    public static string PascalToSnakeCase(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;
        return SnakeCaseRegex().Replace(input, "$1_$2").ToLowerInvariant();
    }

    public static T ParseSnakeCase<T>(string value) where T : struct, Enum
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException($"Valor vazio para enum {typeof(T).Name}");

        // Direct parse (PascalCase)
        if (Enum.TryParse<T>(value, true, out var result))
            return result;

        // Remove underscores for backward compat (snake_case → "inreview" → match)
        var normalized = value.Replace("_", "");
        if (Enum.TryParse<T>(normalized, true, out result))
            return result;

        throw new ArgumentException($"Valor inválido '{value}' para enum {typeof(T).Name}. " +
                                    $"Valores válidos: {string.Join(", ", Enum.GetNames<T>())}");
    }

    [GeneratedRegex("([a-z])([A-Z])")]
    private static partial Regex SnakeCaseRegex();
}
