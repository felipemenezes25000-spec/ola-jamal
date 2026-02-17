/**
 * Centralized input normalizers - align with backend expectations.
 * Single source of truth for CPF, phone, email, money, dates.
 */

/** Remove all non-digits from string */
export function digitsOnly(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

/** Normalize CPF to 11 digits (backend expects digits only) */
export function normalizeCpf(value: string): string {
  return digitsOnly(value).slice(0, 11);
}

/** Normalize Brazilian phone to 10-11 digits (backend expects digits only) */
export function normalizePhone(value: string): string {
  return digitsOnly(value).slice(0, 11);
}

/** Normalize email: trim, lowercase (backend expects lowercase) */
export function normalizeEmail(value: string): string {
  return (value ?? '').trim().toLowerCase();
}

/** Normalize text: trim */
export function normalizeText(value: string): string {
  return (value ?? '').trim();
}

/** Format CPF for display: 000.000.000-00 */
export function formatCpfDisplay(value: string): string {
  const d = digitsOnly(value);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

/** Format phone for display: (11) 99999-9999 or (11) 9999-9999 */
export function formatPhoneDisplay(value: string): string {
  const d = digitsOnly(value);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

/** Format BRL for display */
export function formatMoneyDisplay(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/** Parse money from user input (handles BRL: 1.234,56 and US: 1,234.56) */
export function parseMoney(value: string): number | null {
  const s = (value ?? '').replace(/[^\d,.-]/g, '').trim();
  if (!s) return null;
  // BRL: 1.234,56 (dot=thousands, comma=decimal)
  if (/,\d{1,2}$/.test(s) && s.lastIndexOf('.') < s.lastIndexOf(',')) {
    const brl = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(brl);
    return isNaN(n) ? null : n;
  }
  // US: 1,234.56 or plain 123.45
  const cleaned = s.replace(',', '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Normalize date to ISO string (backend expects DateTime) */
export function toIsoDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
