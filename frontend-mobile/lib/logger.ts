/**
 * Logger estruturado: categorias, níveis e atributos.
 * Em produção, warn+ são logados ao console. Info/debug ficam no console apenas em __DEV__.
 *
 * Categorias sugeridas: auth | api | video | request | verify | ui
 */

export type LogCategory =
  | 'auth'
  | 'api'
  | 'video'
  | 'request'
  | 'verify'
  | 'ui'
  | 'general';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

type LogAttrs = Record<string, string | number | boolean | undefined>;

function logToConsole(level: LogLevel, prefix: string, message: string, attrs: Record<string, string | number | boolean>): void {
  const args = [prefix, message, ...(Object.keys(attrs).length ? [attrs] : [])];
  if (level === 'error' || level === 'fatal') {
    // eslint-disable-next-line no-console -- intentional in __DEV__
    console.error(...args);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console -- intentional in __DEV__
    console.warn(...args);
  } else {
    // eslint-disable-next-line no-console -- intentional in __DEV__
    console.log(...args);
  }
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

  if (__DEV__) {
    const prefix = `[${category}]`;
    logToConsole(level, prefix, message, safeAttrs);
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
  /** Para erros com exceção: log de erro */
  exception: (category: LogCategory, err: unknown, msg?: string, attrs?: LogAttrs) => {
    const message = msg ?? (err instanceof Error ? err.message : String(err));
    log('error', category, message, attrs);
  },
};

/** Erro de API: status, path, mensagem. */
export function logApiError(
  status: number,
  path: string,
  message: string,
  extra?: LogAttrs
): void {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  log(level, 'api', `[${status}] ${path}: ${message}`, { status, path, ...extra });
}
