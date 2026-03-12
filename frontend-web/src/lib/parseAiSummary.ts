/**
 * Parse AI summary text into structured blocks for better readability.
 * Aligned with frontend-mobile FormattedAiSummary.
 */
export interface AiSummaryBlock {
  type: 'header' | 'bullet' | 'text';
  header?: string;
  content: string;
}

export function parseAiSummary(text: string): AiSummaryBlock[] {
  if (!text?.trim()) return [];
  const lines = text.split('\n').filter((l) => l.trim());
  const blocks: AiSummaryBlock[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const headerMatch = trimmed.match(/^([A-ZÁÉÍÓÚÃÕÊÇÂÔ][A-ZÁÉÍÓÚÃÕÊÇÂÔ\s]{2,}):\s*(.*)/);
    if (headerMatch) {
      blocks.push({ type: 'header', header: headerMatch[1].trim(), content: headerMatch[2].trim() });
      continue;
    }
    if (trimmed.startsWith('•') || (trimmed.startsWith('- ') && !trimmed.startsWith('--'))) {
      blocks.push({ type: 'bullet', content: trimmed.replace(/^[•-]\s*/, '') });
      continue;
    }
    blocks.push({ type: 'text', content: trimmed });
  }
  return blocks;
}
