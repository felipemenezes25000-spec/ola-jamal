/**
 * Logger centralizado: logs objetivos e acionáveis.
 * - error: sempre em __DEV__, indica falhas reais (API, auth, etc.)
 * - debug (queue, detail, auth): só quando ENABLE_DEBUG_LOGS=true
 */

const DEBUG_ENABLED =
  __DEV__ &&
  (typeof process !== 'undefined' && process.env?.ENABLE_DEBUG_LOGS === 'true');

/** Formato: [API-ERR] status path | message */
export function logApiError(
  status: number,
  path: string,
  message: string,
  extra?: { correlationId?: string; body?: string }
): void {
  if (!__DEV__) return;
  const parts = [`[API-ERR] ${status} ${path} | ${message}`];
  if (extra?.correlationId) parts.push(`CorrelationId=${extra.correlationId}`);
  if (extra?.body) parts.push(`body=${extra.body.slice(0, 150)}`);
  console.error(parts.join(' | '));
}

export const logger = {
  queue: (msg: string, data?: object) => {
    if (DEBUG_ENABLED) console.warn(`[QUEUE] ${msg}`, data ?? '');
  },
  detail: (msg: string, data?: object) => {
    if (DEBUG_ENABLED) console.warn(`[DETAIL] ${msg}`, data ?? '');
  },
  auth: (msg: string, data?: object) => {
    if (DEBUG_ENABLED) console.warn(`[AUTH] ${msg}`, data ?? '');
  },
};
