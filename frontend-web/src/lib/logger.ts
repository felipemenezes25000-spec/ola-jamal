/**
 * Logger estruturado: categorias, níveis e atributos.
 * Logs são emitidos via console.
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

  const prefix = `[${category}]`;
  const args = [prefix, message, ...(Object.keys(safeAttrs).length ? [safeAttrs] : [])];
  if (level === 'error' || level === 'fatal') console.error(...args);
  else if (level === 'warn') console.warn(...args);
  else console.log(...args);
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
  /** Para erros com excecao: loga no console */
  exception: (category: LogCategory, err: unknown, msg?: string, attrs?: LogAttrs) => {
    const message = msg ?? (err instanceof Error ? err.message : String(err));
    log('error', category, message, attrs);
  },
};
