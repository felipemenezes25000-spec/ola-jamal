/**
 * Converte erros técnicos do backend em mensagens amigáveis em PT-BR.
 * Nunca exibe stacktrace nem mensagem crua do backend ao usuário.
 */

export type HumanizeErrorContext = 'request' | 'consultation' | 'generic';

const REQUEST_PATTERNS: { pattern: RegExp | string; message: string }[] = [
  { pattern: /cannot approve|não.*aprovar|invalid.*approve/i, message: 'Não é possível aprovar este pedido no momento.' },
  { pattern: /cannot reject|não.*rejeitar/i, message: 'Não é possível rejeitar este pedido no momento.' },
  { pattern: /cannot sign|não.*assinar|invalid.*sign/i, message: 'Não é possível assinar este documento no momento.' },
  { pattern: /request.*not found|pedido.*não encontrado/i, message: 'Pedido não encontrado.' },
];

const CONSULTATION_PATTERNS: { pattern: RegExp | string; message: string }[] = [
  { pattern: /consultation.*not available|consulta.*indisponível/i, message: 'Esta consulta não está disponível no momento.' },
  { pattern: /already accepted|já.*aceita/i, message: 'Esta consulta já foi aceita.' },
  { pattern: /request.*not found|pedido.*não encontrado/i, message: 'Pedido não encontrado.' },
];

const FALLBACK_MESSAGE = 'Ocorreu um erro inesperado. Tente novamente mais tarde.';

function matchPatterns(rawMessage: string, patterns: { pattern: RegExp | string; message: string }[]): string | null {
  const lower = rawMessage.toLowerCase();
  for (const { pattern, message } of patterns) {
    if (typeof pattern === 'string') {
      if (lower.includes(pattern.toLowerCase())) return message;
    } else {
      if (pattern.test(rawMessage)) return message;
    }
  }
  return null;
}

export function humanizeError(error: unknown, context?: HumanizeErrorContext): string {
  if (
    error && typeof error === 'object' &&
    'userMessagePtBr' in error &&
    typeof (error as { userMessagePtBr: unknown }).userMessagePtBr === 'string' &&
    (error as { userMessagePtBr: string }).userMessagePtBr.trim()
  ) {
    return (error as { userMessagePtBr: string }).userMessagePtBr;
  }

  const rawMessage =
    (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string')
      ? (error as { message: string }).message
      : (error instanceof Error ? error.message : typeof error === 'string' ? error : '');

  if (!rawMessage.trim()) return FALLBACK_MESSAGE;

  const patterns =
    context === 'request'
      ? REQUEST_PATTERNS
      : context === 'consultation'
        ? CONSULTATION_PATTERNS
        : [...REQUEST_PATTERNS, ...CONSULTATION_PATTERNS];

  const matched = matchPatterns(rawMessage, patterns);
  if (matched) return matched;

  if (rawMessage.includes('Network') || rawMessage.includes('fetch') || rawMessage.includes('Failed to fetch')) {
    return 'Não foi possível conectar. Verifique sua internet e tente novamente.';
  }
  if (rawMessage.includes('401') || rawMessage.includes('Unauthorized')) {
    return 'Sessão expirada. Faça login novamente.';
  }
  if (rawMessage.includes('500') || rawMessage.includes('Internal Server Error')) {
    return 'Erro no servidor. Tente novamente em alguns instantes.';
  }
  if (rawMessage.includes('Ocorreu um erro ao processar sua solicitação')) {
    return 'Erro no servidor. Tente novamente em alguns instantes.';
  }
  return FALLBACK_MESSAGE;
}
