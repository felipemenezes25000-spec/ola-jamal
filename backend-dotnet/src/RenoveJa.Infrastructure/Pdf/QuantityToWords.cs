namespace RenoveJa.Infrastructure.Pdf;

/// <summary>
/// Converte a parte numérica de uma quantidade de medicamento para extenso em pt-BR.
/// Ex: "30 comprimidos" → "trinta comprimidos"
/// Suporta valores de 1 a 9999.
/// </summary>
internal static class QuantityToWords
{
    private static readonly string[] Units =
    [
        "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
        "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"
    ];

    private static readonly string[] Tens =
    [
        "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"
    ];

    private static readonly string[] Hundreds =
    [
        "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
        "seiscentos", "setecentos", "oitocentos", "novecentos"
    ];

    /// <summary>
    /// Converte uma string de quantidade para extenso.
    /// Ex: "30 comprimidos" → "trinta comprimidos"
    ///     "1 caixa"        → "uma caixa"
    ///     "100"            → "cem"
    /// </summary>
    public static string Convert(string? quantity)
    {
        if (string.IsNullOrWhiteSpace(quantity))
            return quantity ?? "";

        // Separar número do resto (unidade)
        var parts = quantity.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0)
            return quantity;

        if (!int.TryParse(parts[0], out var number) || number < 0 || number > 9999)
            return quantity;

        var words = NumberToWords(number);

        // Feminino para "uma" quando unidade indica feminino
        if (parts.Length > 1)
        {
            var unit = parts[1].ToLowerInvariant();
            if (number == 1 && (unit.StartsWith("cápsula") || unit.StartsWith("ampola") || unit.StartsWith("caixa") || unit.StartsWith("dose")))
                words = "uma";
            return $"{words} {parts[1]}";
        }

        return words;
    }

    private static string NumberToWords(int n)
    {
        if (n == 0) return "zero";
        if (n == 100) return "cem";

        var parts = new List<string>();

        if (n >= 1000)
        {
            var thousands = n / 1000;
            parts.Add(thousands == 1 ? "mil" : $"{NumberToWords(thousands)} mil");
            n %= 1000;
            if (n == 0) return string.Join(" e ", parts);
        }

        if (n >= 100)
        {
            parts.Add(Hundreds[n / 100]);
            n %= 100;
        }

        if (n >= 20)
        {
            var ten = Tens[n / 10];
            var unit = Units[n % 10];
            parts.Add(string.IsNullOrEmpty(unit) ? ten : $"{ten} e {unit}");
        }
        else if (n > 0)
        {
            parts.Add(Units[n]);
        }

        return string.Join(" e ", parts);
    }
}
