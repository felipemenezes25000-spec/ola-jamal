/**
 * Converte erros técnicos do backend em mensagens amigáveis em PT-BR.
 * Nunca exibe stacktrace nem mensagem crua do backend ao usuário.
 */

export type HumanizeErrorContext = 'payment' | 'request' | 'consultation' | 'generic';

const PAYMENT_PATTERNS: Array<{ pattern: RegExp | string; message: string }> = [
  { pattern: /pending payment|must be in.*payment|aguardando pagamento/i, message: 'Este pedido não está disponível para pagamento. Verifique o status do pedido.' },
  { pattern: /already paid|já.*pago|payment.*completed/i, message: 'Pagamento já foi realizado.' },
  { pattern: /invalid.*status|status.*invalid/i, message: 'Este pedido não está disponível para pagamento. Verifique o status do pedido.' },
  { pattern: /request.*not found|pedido.*não encontrado/i, message: 'Pedido não encontrado.' },
];

const REQUEST_PATTERNS: Array<{ pattern: RegExp | string; message: string }> = [
  { pattern: /cannot approve|não.*aprovar|invalid.*approve/i, message: 'Não é possível aprovar este pedido no momento.' },
  { pattern: /cannot reject|não.*rejeitar/i, message: 'Não é possível rejeitar este pedido no momento.' },
  { pattern: /cannot sign|não.*assinar|invalid.*sign/i, message: 'Não é possível assinar este documento no momento.' },
  { pattern: /request.*not found|pedido.*não encontrado/i, message: 'Pedido não encontrado.' },
];

const CONSULTATION_PATTERNS: Array<{ pattern: RegExp | string; message: string }> = [
  { pattern: /consultation.*not available|consulta.*indisponível/i, message: 'Esta consulta não está disponível no momento.' },
  { pattern: /already accepted|já.*aceita/i, message: 'Esta consulta já foi aceita.' },
  { pattern: /request.*not found|pedido.*não encontrado/i, message: 'Pedido não encontrado.' },
];

const FALLBACK_MESSAGE = 'Ocorreu um erro inesperado. Tente novamente mais tarde.';

function getMessageFromError(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'userMessagePtBr' in err &&
    typeof (err as { userMessagePtBr: unknown }).userMessagePtBr === 'string' &&
    (err as { userMessagePtBr: string }).userMessagePtBr.trim()
  ) {
    return (err as { userMessagePtBr: string }).userMessagePtBr;
  }
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return '';
}

function matchPatterns(rawMessage: string, patterns: Array<{ pattern: RegExp | string; message: string }>): string | null {
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

/**
 * Converte erro técnico em mensagem amigável em PT-BR.
 * @param error - Erro do backend ou exceção
 * @param context - Contexto para escolher mapeamentos (payment, request, consultation)
 */
export function humanizeError(error: unknown, context?: HumanizeErrorContext): string {
  if (
    error &&
    typeof error === 'object' &&
    'userMessagePtBr' in error &&
    typeof (error as { userMessagePtBr: unknown }).userMessagePtBr === 'string' &&
    (error as { userMessagePtBr: string }).userMessagePtBr.trim()
  ) {
    return (error as { userMessagePtBr: string }).userMessagePtBr;
  }
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    const code = (error as { code: string }).code;
    const byCode: Record<string, string> = {
      payment_already_completed: 'Pagamento já foi realizado.',
      request_not_payable: 'Este pedido não está disponível para pagamento.',
      payment_not_pending: 'Este pagamento não está mais pendente.',
      request_without_amount: 'Solicitação sem valor definido para pagamento.',
    };
    if (byCode[code]) return byCode[code];
  }

  const rawMessage = getMessageFromError(error);
  if (!rawMessage.trim()) return FALLBACK_MESSAGE;

  const patterns =
    context === 'payment'
      ? PAYMENT_PATTERNS
      : context === 'request'
        ? REQUEST_PATTERNS
        : context === 'consultation'
          ? CONSULTATION_PATTERNS
          : [...PAYMENT_PATTERNS, ...REQUEST_PATTERNS, ...CONSULTATION_PATTERNS];

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

  return FALLBACK_MESSAGE;
}
