/**
 * Debug logger - logs only when __DEV__ and ENABLE_DEBUG_LOGS is true.
 * Set ENABLE_DEBUG_LOGS=true in .env or env to enable [QUEUE], [DETAIL], [AUTH] logs.
 */

const ENABLE =
  __DEV__ &&
  (typeof process !== 'undefined' && process.env?.ENABLE_DEBUG_LOGS === 'true');

export const logger = {
  queue: (msg: string, data?: object) => {
    if (ENABLE) console.info(`[QUEUE] ${msg}`, data ?? '');
  },
  detail: (msg: string, data?: object) => {
    if (ENABLE) console.info(`[DETAIL] ${msg}`, data ?? '');
  },
  auth: (msg: string, data?: object) => {
    if (ENABLE) console.info(`[AUTH] ${msg}`, data ?? '');
  },
};
