/**
 * Formata valor numérico em Real (pt-BR): vírgula decimal, símbolo R$.
 * Ex: formatBRL(1) => "R$ 1,00"
 */
export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formata data em pt-BR.
 * @param dateStr - string ISO ou Date
 * @param options.short - se true, formato curto (dd/MM/yy); senão dia e mês por extenso quando aplicável
 */
export function formatDateBR(
  dateStr: string | Date,
  options?: { short?: boolean }
): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(date.getTime())) return '—';
  if (options?.short) {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  }
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formata hora em pt-BR (HH:mm).
 */
export function formatTimeBR(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formata data e hora em pt-BR (dd/MM/yyyy HH:mm).
 */
export function formatDateTimeBR(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} ${formatTimeBR(date)}`;
}

/**
 * Saudação por horário: "Bom dia", "Boa tarde", "Boa noite".
 */
export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Tempo relativo compacto para notificações: "Agora", "5 min", "2h", "Ontem", ou data curta.
 */
export function timeAgoShort(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'Agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/**
 * Grupo de data para seções de lista: "Hoje", "Ontem", "Esta semana", ou data longa.
 */
export function getDateGroupForSection(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(date.getTime())) return '—';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return 'Esta semana';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

/**
 * Formata tempo relativo em pt-BR: "Agora", "Há X min", "Há X h", "Há X dias".
 */
export function formatRelativeTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(date.getTime())) return '—';
  const now = Date.now();
  const ms = now - date.getTime();
  const min = Math.floor(ms / 60_000);
  const h = Math.floor(ms / 3_600_000);
  const days = Math.floor(ms / 86_400_000);
  if (min < 1) return 'Agora';
  if (min < 60) return `Há ${min} min`;
  if (h < 24) return `Há ${h} h`;
  if (days < 7) return `Há ${days} dias`;
  return formatDateBR(date, { short: true });
}
