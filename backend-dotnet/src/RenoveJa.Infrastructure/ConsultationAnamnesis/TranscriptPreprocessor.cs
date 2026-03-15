using System.Text;

namespace RenoveJa.Infrastructure.ConsultationAnamnesis;

/// <summary>
/// Static helpers for preprocessing raw transcripts from Deepgram/Daily.
/// </summary>
internal static class TranscriptPreprocessor
{
    /// <summary>
    /// Pré-processa o transcript bruto do Deepgram/Daily para facilitar a compreensão pela IA.
    /// 1. Consolida linhas consecutivas do mesmo locutor (evita fragmentação "[Paciente] Eu" "[Paciente] tenho")
    /// 2. Remove hesitações puras (linhas com apenas "É", "Eh", "Hm", "Aí", "Né", "Pronto", "Talk")
    /// 3. Remove linhas duplicadas adjacentes
    /// </summary>
    internal static string PreprocessTranscript(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return raw;

        var lines = raw.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length == 0)
            return raw;

        // Hesitações puras (linhas que são só noise) — case-insensitive
        var pureHesitations = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "é", "eh", "hm", "hmm", "aí", "né", "pronto", "talk", "o", "a", "e",
            "então", "nesse", "pra", "que", "bom", "isso", "presidente", "gente",
            "qual", "pai", "uma"
        };

        var consolidated = new List<(string Speaker, string Text)>();

        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (string.IsNullOrEmpty(trimmed))
                continue;

            // Parse "[Médico] texto" or "[Paciente] texto"
            string speaker;
            string text;
            if (trimmed.StartsWith("[") && trimmed.IndexOf(']') is var closeBracket and > 0)
            {
                speaker = trimmed[1..closeBracket].Trim();
                text = trimmed[(closeBracket + 1)..].Trim();
            }
            else
            {
                speaker = "";
                text = trimmed;
            }

            // Skip pure hesitation lines
            var cleanedForCheck = text.TrimEnd('.', ',', '?', '!', ';', ':').Trim();
            if (pureHesitations.Contains(cleanedForCheck))
                continue;

            // Skip very short noise lines (1-2 chars after cleanup)
            if (cleanedForCheck.Length <= 2)
                continue;

            // Consolidate consecutive lines from same speaker
            if (consolidated.Count > 0 && consolidated[^1].Speaker == speaker)
            {
                var prev = consolidated[^1];
                // Don't duplicate if text is identical
                if (!string.Equals(prev.Text.TrimEnd('.', ','), text.TrimEnd('.', ','), StringComparison.OrdinalIgnoreCase))
                {
                    consolidated[^1] = (speaker, prev.Text + " " + text);
                }
            }
            else
            {
                consolidated.Add((speaker, text));
            }
        }

        var sb = new StringBuilder(raw.Length);
        foreach (var (speaker, text) in consolidated)
        {
            if (!string.IsNullOrEmpty(speaker))
                sb.AppendLine($"[{speaker}] {text}");
            else
                sb.AppendLine(text);
        }

        return sb.ToString().TrimEnd();
    }
}
