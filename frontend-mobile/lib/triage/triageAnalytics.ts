/**
 * triageAnalytics.ts — Analytics dos eventos da Dra. Renoveja
 *
 * Fase 1: log só com ENABLE_DEBUG_LOGS=true (evita poluir terminal)
 * Fase 2: enviar para backend (POST /api/analytics/event)
 */

const DEBUG_ANALYTICS =
  __DEV__ &&
  (typeof process !== 'undefined' && process.env?.ENABLE_DEBUG_LOGS === 'true');

export function trackTriageEvent(
  event: string,
  metadata?: Record<string, unknown>
): void {
  if (DEBUG_ANALYTICS) {
    console.warn('[TRIAGE_ANALYTICS]', event, metadata);
  }

  // Fase 2: descomentar para enviar ao backend
  // apiClient.post('/api/analytics/event', { event, ...metadata }).catch(() => {});
}
