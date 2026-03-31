using System.Text.RegularExpressions;

namespace RenoveJa.Infrastructure.AiReading;

public static class PromptSanitizer
{
    private const int MaxLength = 10_000;

    private static readonly Regex InjectionPattern = new(
        @"(?i)(ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?))|" +
        @"(disregard\s+(previous|all|above))|" +
        @"(you\s+are\s+now\s+)|" +
        @"(new\s+instructions?\s*:)|" +
        @"(forget\s+(everything|all|previous))|" +
        @"(do\s+not\s+follow)|" +
        @"(override\s+(system|instructions?))",
        RegexOptions.Compiled);

    private static readonly Regex RolePrefixPattern = new(
        @"(?i)^(system|assistant|user)\s*:",
        RegexOptions.Compiled | RegexOptions.Multiline);

    private static readonly Regex MarkdownPattern = new(
        @"[`*_~#\[\]]{2,}|^#{1,6}\s|```",
        RegexOptions.Compiled | RegexOptions.Multiline);

    public static string SanitizeForPrompt(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        var s = input.Trim();

        if (s.Length > MaxLength)
            s = s[..MaxLength];

        s = InjectionPattern.Replace(s, "[removido]");
        s = RolePrefixPattern.Replace(s, "[removido]:");
        s = MarkdownPattern.Replace(s, "");

        return s;
    }
}
