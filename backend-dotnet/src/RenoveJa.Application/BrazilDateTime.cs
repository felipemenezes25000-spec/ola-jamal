using System.Globalization;
using System.Runtime.InteropServices;

namespace RenoveJa.Application;

/// <summary>
/// Data/hora em horário oficial de Brasília (America/Sao_Paulo) para documentos, PDFs e API.
/// Evita depender do fuso do servidor (ex.: UTC na AWS).
/// </summary>
public static class BrazilDateTime
{
    private static readonly TimeZoneInfo BrasilTz = CreateBrasilTz();

    private static TimeZoneInfo CreateBrasilTz()
    {
        try
        {
            var id = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
                ? "E. South America Standard Time"
                : "America/Sao_Paulo";
            return TimeZoneInfo.FindSystemTimeZoneById(id);
        }
        catch
        {
            return TimeZoneInfo.Utc;
        }
    }

    /// <summary>Instante atual no relógio de Brasília (emissão de receitas/documentos).</summary>
    public static DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, BrasilTz);

    /// <summary>
    /// Converte para componentes de calendário em Brasília.
    /// <see cref="DateTimeKind.Utc"/>: converte a partir do instante UTC.
    /// Outros kinds: assume que o valor já representa o horário de Brasília (ex.: <see cref="Now"/>) e não aplica segundo deslocamento.
    /// </summary>
    public static DateTime ToBrasiliaWallClock(DateTime value)
    {
        try
        {
            if (value.Kind == DateTimeKind.Utc)
                return TimeZoneInfo.ConvertTimeFromUtc(value, BrasilTz);
            return value;
        }
        catch
        {
            return value;
        }
    }

    public static string FormatDate(DateTime value) =>
        ToBrasiliaWallClock(value).ToString("dd/MM/yyyy", CultureInfo.GetCultureInfo("pt-BR"));

    public static string FormatDateTime(DateTime value) =>
        ToBrasiliaWallClock(value).ToString("dd/MM/yyyy 'às' HH:mm", CultureInfo.GetCultureInfo("pt-BR"));

    /// <summary>Ex.: "15 de março de 2026" (pt-BR, fuso Brasília).</summary>
    public static string FormatLongDate(DateTime value) =>
        ToBrasiliaWallClock(value).ToString("dd 'de' MMMM 'de' yyyy", CultureInfo.GetCultureInfo("pt-BR"));
}
