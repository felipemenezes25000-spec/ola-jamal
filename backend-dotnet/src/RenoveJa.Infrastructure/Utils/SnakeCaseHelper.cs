using System.Globalization;
using System.Text.RegularExpressions;

namespace RenoveJa.Infrastructure.Utils;

/// <summary>
/// Converte entre PascalCase e snake_case para compatibilidade com PostgREST/PostgreSQL.
/// </summary>
internal static class SnakeCaseHelper
{
    /// <summary>PascalCase → snake_case. Ex.: ApprovedPendingPayment → approved_pending_payment</summary>
    public static string ToSnakeCase(string value)
    {
        if (string.IsNullOrEmpty(value)) return value;
        return Regex.Replace(value, @"([a-z])([A-Z])", "$1_$2").ToLowerInvariant();
    }

    /// <summary>snake_case → PascalCase. Ex.: approved_pending_payment → ApprovedPendingPayment</summary>
    public static string ToPascalCase(string value)
    {
        if (string.IsNullOrEmpty(value)) return value;
        var parts = value.Split('_');
        return string.Concat(parts.Select(p =>
            p.Length > 0 ? char.ToUpper(p[0], CultureInfo.InvariantCulture) + p[1..].ToLowerInvariant() : ""));
    }
}
