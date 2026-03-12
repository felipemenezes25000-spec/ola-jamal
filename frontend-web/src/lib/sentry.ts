/**
 * Sentry: erros + logs estruturados.
 * DSN via VITE_SENTRY_DSN. Se vazio, Sentry fica desativado.
 */
import * as Sentry from '@sentry/react';

const dsn = (import.meta.env.VITE_SENTRY_DSN ?? '').trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    enableLogs: true,
    beforeSend(event) {
      // Evitar reportar erros de rede transitórios (502/503)
      const message = event.message ?? '';
      if (message.includes('502') || message.includes('503')) return null;
      return event;
    },
    beforeSendLog(log) {
      // Só envia warn+ ao Sentry: erros e avisos. Info/debug ficam no console.
      const levels = ['trace', 'debug', 'info'];
      if (levels.includes(log.level)) return null;
      return log;
    },
  });
}

export { Sentry };
