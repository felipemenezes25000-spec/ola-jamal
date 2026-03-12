/**
 * Sentry: erros + logs estruturados.
 * DSN via EXPO_PUBLIC_SENTRY_DSN. Se vazio, Sentry fica desativado.
 */
import * as Sentry from '@sentry/react-native';

const dsn = (process.env.EXPO_PUBLIC_SENTRY_DSN ?? '').trim();
if (dsn) {
  Sentry.init({
    dsn,
    enableLogs: true,
    tracesSampleRate: 0.1,
    beforeSend(event) {
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
