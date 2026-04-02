using System.Text.RegularExpressions;

namespace RenoveJa.Application.Services.Audit;

public static class SanitizerHelper
{
    private static readonly HashSet<string> SensitiveKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "password", "senha", "pwd", "secret",
        "token", "auth", "authorization",
        "cpf", "rg", "documento" // CPF/RG should be masked, not removed, but better safe in free-text logs
    };

    public static Dictionary<string, object?> Sanitize(Dictionary<string, object?>? original)
    {
        if (original == null || original.Count == 0) return new Dictionary<string, object?>();

        var sanitized = new Dictionary<string, object?>(original.Count);

        foreach (var kvp in original)
        {
            if (SensitiveKeys.Any(k => kvp.Key.Contains(k, StringComparison.OrdinalIgnoreCase)))
            {
                sanitized[kvp.Key] = "***REDACTED***";
            }
            else
            {
                // Recursive sanitization for nested objects could go here if needed
                // For now, we assume flat dictionaries or simple objects
                sanitized[kvp.Key] = kvp.Value;
            }
        }
        return sanitized;
    }
}
