namespace RenoveJa.Application.Helpers;

/// <summary>
/// Validação de CPF brasileiro (algoritmo módulo 11).
/// </summary>
public static class CpfHelper
{
    /// <summary>
    /// Extrai apenas os dígitos do CPF (11 caracteres).
    /// </summary>
    public static string ExtractDigits(string cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return string.Empty;
        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        return digits.Length >= 11 ? digits[..11] : digits;
    }

    /// <summary>
    /// Valida CPF para uso em pagamentos (Mercado Pago etc).
    /// </summary>
    public static bool IsValidForPayment(string? cpf)
    {
        return !string.IsNullOrWhiteSpace(cpf) && IsValid(cpf);
    }

    /// <summary>
    /// Valida se o CPF (11 dígitos) é válido.
    /// Rejeita CPFs com todos os dígitos iguais.
    /// </summary>
    public static bool IsValid(string cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return false;

        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        if (digits.Length != 11) return false;

        // Rejeita CPFs com todos os dígitos iguais
        if (digits.Distinct().Count() == 1) return false;

        var multiplicador1 = new[] { 10, 9, 8, 7, 6, 5, 4, 3, 2 };
        var multiplicador2 = new[] { 11, 10, 9, 8, 7, 6, 5, 4, 3, 2 };

        var tempCpf = digits[..9];
        var soma = 0;
        for (var i = 0; i < 9; i++)
            soma += (tempCpf[i] - '0') * multiplicador1[i];

        var resto = soma % 11;
        resto = resto < 2 ? 0 : 11 - resto;
        tempCpf += (char)('0' + resto);

        soma = 0;
        for (var i = 0; i < 10; i++)
            soma += (tempCpf[i] - '0') * multiplicador2[i];

        resto = soma % 11;
        resto = resto < 2 ? 0 : 11 - resto;

        return digits.EndsWith(tempCpf[9..] + (char)('0' + resto));
    }
}
