declare module '@sentry/react-native' {
  export interface InitOptions {
    dsn?: string;
    enableLogs?: boolean;
    tracesSampleRate?: number;
    beforeSend?: (event: { message?: string | null } & Record<string, unknown>) => unknown;
    beforeSendLog?: (log: { level: string } & Record<string, unknown>) => unknown;
  }
  export function init(options: InitOptions): void;
  export function captureException(
    error: unknown,
    options?: { extra?: Record<string, unknown>; tags?: Record<string, string> }
  ): string | undefined;
  export const logger: {
    trace: (message: string, attrs?: Record<string, unknown>) => void;
    debug: (message: string, attrs?: Record<string, unknown>) => void;
    info: (message: string, attrs?: Record<string, unknown>) => void;
    warn: (message: string, attrs?: Record<string, unknown>) => void;
    error: (message: string, attrs?: Record<string, unknown>) => void;
    fatal: (message: string, attrs?: Record<string, unknown>) => void;
  };
}
