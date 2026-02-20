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
