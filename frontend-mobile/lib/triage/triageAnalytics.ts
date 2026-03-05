/**
 * triageAnalytics.ts — Analytics dos eventos da Dra. Renoveja
 *
 * Fase 1: log estruturado em __DEV__
 * Fase 2: enviar para backend (POST /api/analytics/event)
 */

export function trackTriageEvent(
  event: string,
  metadata?: Record<string, unknown>
): void {
  if (__DEV__) {
    console.log('[TRIAGE_ANALYTICS]', event, metadata);
  }

  // Fase 2: descomentar para enviar ao backend
  // apiClient.post('/api/analytics/event', { event, ...metadata }).catch(() => {});
}
