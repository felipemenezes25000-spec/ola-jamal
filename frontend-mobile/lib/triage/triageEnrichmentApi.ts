/**
 * triageEnrichmentApi.ts — Chamada à API de enriquecimento da Dra. Renoveja
 *
 * IA usa apenas para personalizar o tom (nunca define nada). Médico sempre decide.
 * Timeout curto (4s) para não bloquear UX. Fallback silencioso em erro.
 */

import { apiClient } from '../api-client';
import type { TriageInput, TriageMessage } from './triage.types';

const ENRICH_TIMEOUT_MS = 4000;

export interface TriageEnrichResponse {
  text: string | null;
  isPersonalized: boolean;
}

/** Chaves que o backend NUNCA enriquece (alertas críticos). Não vale a pena chamar a API. */
const NO_ENRICH_KEYS = [
  'rx:controlled',
  'rx:high_risk',
  'rx:red_flags',
  'rx:unreadable',
  'rx:ai_message',
  'exam:high_risk',
  'exam:complex',
  'exam:many',
  'exam:red_flags',
  'consult:red_flags',
  'doctor:detail:high_risk',
  'detail:conduct_available',
];

function shouldSkipEnrich(ruleKey: string): boolean {
  return NO_ENRICH_KEYS.some((k) => ruleKey.startsWith(k));
}

function sanitizeEnrichedText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const forbidden = [
    'diagnostico',
    'diagnóstico',
    'prescrevo',
    'prescricao',
    'prescrição',
    'voce tem',
    'você tem',
    'recomendo tratamento',
  ];
  const lower = trimmed.toLowerCase();
  if (forbidden.some((word) => lower.includes(word))) return null;

  return trimmed.length <= 140 ? trimmed : trimmed.slice(0, 140).trim();
}

/**
 * Tenta enriquecer a mensagem com IA. Retorna null em timeout, erro ou se a chave não for enriquecível.
 * Nunca lança — sempre retorna null em caso de falha.
 */
export async function enrichTriageMessage(
  message: TriageMessage,
  input: TriageInput
): Promise<{ text: string; isPersonalized: true } | null> {
  if (shouldSkipEnrich(message.key)) return null;

  const body = {
    context: input.context,
    step: input.step,
    ruleKey: message.key,
    ruleText: message.text,
    prescriptionType: input.prescriptionType ?? undefined,
    examType: input.examType ?? undefined,
    exams: input.exams ?? undefined,
    symptoms: input.symptoms ?? undefined,
    totalRequests: input.totalRequests ?? undefined,
    recentPrescriptionCount: input.recentPrescriptionCount ?? undefined,
    recentExamCount: input.recentExamCount ?? undefined,
    lastPrescriptionDaysAgo: input.lastPrescriptionDaysAgo ?? undefined,
    lastExamDaysAgo: input.lastExamDaysAgo ?? undefined,
    patientAge: input.patientAge ?? undefined,
    recentMedications: input.recentMedications ?? undefined,
  };

  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), ENRICH_TIMEOUT_MS)
  );

  const enrichPromise = (async (): Promise<{ text: string; isPersonalized: true } | null> => {
    try {
      const token = await apiClient.getAuthToken();
      if (!token) return null; // Não chama API sem autenticação
      const res = await apiClient.post<TriageEnrichResponse>('/api/triage/enrich', body);
      if (res?.text && res.isPersonalized) {
        const safeText = sanitizeEnrichedText(res.text);
        if (!safeText) return null;
        return { text: safeText, isPersonalized: true };
      }
      return null;
    } catch {
      return null;
    }
  })();

  const result = await Promise.race([enrichPromise, timeoutPromise]);
  return result;
}
