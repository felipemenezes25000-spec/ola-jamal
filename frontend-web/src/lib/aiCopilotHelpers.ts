/**
 * Helpers compartilhados para componentes de Copiloto IA (AiCopilotSection, AiCopilotCard).
 */

export function hasUsefulAiContent(
  aiSummary: string | null | undefined,
  aiRisk?: string | null,
  aiUrgency?: string | null
): boolean {
  if (aiRisk || aiUrgency) return true;
  if (!aiSummary || !aiSummary.trim()) return false;
  return aiSummary.replace(/\s/g, '').length > 50;
}
