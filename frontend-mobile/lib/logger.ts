/**
 * Logger estruturado: categorias, níveis e atributos.
 * Em produção só envia warn+ ao Sentry. Info/debug ficam no console.
 *
 * Categorias sugeridas: auth | api | payment | video | request | verify | ui
 */
import { Sentry } from './sentry';

export type LogCategory =
  | 'auth'
  | 'api'
  | 'payment'
  | 'video'
  | 'request'
  | 'verify'
  | 'ui'
  | 'general';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

type LogAttrs = Record<string, string | number | boolean | undefined>;

const SENTRY_MIN_LEVEL: LogLevel = 'warn';
const LEVEL_ORDER: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

function shouldSendToSentry(level: LogLevel): boolean {
  const minIdx = LEVEL_ORDER.indexOf(SENTRY_MIN_LEVEL);
  const levelIdx = LEVEL_ORDER.indexOf(level);
  return levelIdx >= minIdx;
}

function log(
  level: LogLevel,
  category: LogCategory,
  message: string,
  attrs?: LogAttrs
): void {
  const payload = { ...attrs, 'log.category': category };
  const safeAttrs = Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined)
  ) as Record<string, string | number | boolean>;

  if (typeof Sentry !== 'undefined' && Sentry.logger && shouldSendToSentry(level)) {
    const logger = Sentry.logger;
    const fn = logger[level as keyof typeof logger];
    if (typeof fn === 'function') {
      fn.call(logger, message, safeAttrs);
    }
  }

  if (__DEV__) {
    const prefix = `[${category}]`;
    const args = [prefix, message, ...(Object.keys(safeAttrs).length ? [safeAttrs] : [])];
    if (level === 'error' || level === 'fatal') {
      console.error(...args);
    } else if (level === 'warn') {
      console.warn(...args);
    } else {
      // eslint-disable-next-line no-console -- log intencional em __DEV__
      console.log(...args);
    }
  }
}

export const logger = {
  trace: (category: LogCategory, msg: string, attrs?: LogAttrs) =>
    log('trace', category, msg, attrs),
  debug: (category: LogCategory, msg: string, attrs?: LogAttrs) =>
    log('debug', category, msg, attrs),
  info: (category: LogCategory, msg: string, attrs?: LogAttrs) =>
    log('info', category, msg, attrs),
  warn: (category: LogCategory, msg: string, attrs?: LogAttrs) =>
    log('warn', category, msg, attrs),
  error: (category: LogCategory, msg: string, attrs?: LogAttrs) =>
    log('error', category, msg, attrs),
  fatal: (category: LogCategory, msg: string, attrs?: LogAttrs) =>
    log('fatal', category, msg, attrs),
  /** Para erros com exceção: usa Sentry.captureException + log */
  exception: (category: LogCategory, err: unknown, msg?: string, attrs?: LogAttrs) => {
    const message = msg ?? (err instanceof Error ? err.message : String(err));
    log('error', category, message, attrs);
    if (typeof Sentry !== 'undefined' && Sentry.captureException) {
      Sentry.captureException(err, { extra: { ...attrs, 'log.category': category } });
    }
  },
};

/** Erro de API: status, path, mensagem. Vai ao Sentry (warn+). */
export function logApiError(
  status: number,
  path: string,
  message: string,
  extra?: LogAttrs
): void {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  log(level, 'api', `[${status}] ${path}: ${message}`, { status, path, ...extra });
}
