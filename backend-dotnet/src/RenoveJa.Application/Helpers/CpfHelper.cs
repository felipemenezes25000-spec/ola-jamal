namespace RenoveJa.Application.Helpers;

/// <summary>Utilitários para validação e normalização de CPF.</summary>
public static class CpfHelper
{
    /// <summary>Valida CPF pelo algoritmo módulo 11. Rejeita sequências como 11111111111.</summary>
    /// <param name="cpf">CPF com 11 dígitos (somente números).</param>
    public static bool IsValid(string cpf)
    {
        if (string.IsNullOrEmpty(cpf) || cpf.Length != 11)
            return false;
        if (cpf.Distinct().Count() == 1)
            return false;
        var sum = 0;
        for (var i = 0; i < 9; i++)
            sum += (cpf[i] - '0') * (10 - i);
        var rem = sum % 11;
        var d1 = rem < 2 ? 0 : 11 - rem;
        if (cpf[9] - '0' != d1) return false;
        sum = 0;
        for (var i = 0; i < 10; i++)
            sum += (cpf[i] - '0') * (11 - i);
        rem = sum % 11;
        var d2 = rem < 2 ? 0 : 11 - rem;
        return cpf[10] - '0' == d2;
    }

    /// <summary>Extrai 11 dígitos do CPF e retorna null se insuficientes.</summary>
    public static string? ExtractDigits(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return null;
        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        return digits.Length >= 11 ? digits.Length > 11 ? digits[..11] : digits : null;
    }

    /// <summary>Verifica se o CPF é válido para envio ao Mercado Pago (11 dígitos + algoritmo).</summary>
    public static bool IsValidForPayment(string? cpf)
    {
        var digits = ExtractDigits(cpf);
        return digits != null && IsValid(digits);
    }
}
