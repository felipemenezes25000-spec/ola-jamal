import {
  digitsOnly,
  normalizeCpf,
  normalizePhone,
  normalizeEmail,
  normalizeText,
  formatCpfDisplay,
  formatPhoneDisplay,
  formatMoneyDisplay,
  parseMoney,
  toIsoDate,
} from '../normalizers';

describe('normalizers', () => {
  describe('digitsOnly', () => {
    it('removes all non-digits', () => {
      expect(digitsOnly('123.456.789-00')).toBe('12345678900');
      expect(digitsOnly('(11) 99999-9999')).toBe('11999999999');
      expect(digitsOnly('abc123def')).toBe('123');
    });

    it('handles empty/null', () => {
      expect(digitsOnly('')).toBe('');
      expect(digitsOnly(null as any)).toBe('');
    });
  });

  describe('normalizeCpf', () => {
    it('returns max 11 digits', () => {
      expect(normalizeCpf('123.456.789-00')).toBe('12345678900');
      expect(normalizeCpf('12345678901234')).toBe('12345678901');
    });
  });

  describe('normalizePhone', () => {
    it('returns max 11 digits', () => {
      expect(normalizePhone('(11) 99999-9999')).toBe('11999999999');
      expect(normalizePhone('1199999999999')).toBe('11999999999');
    });
  });

  describe('normalizeEmail', () => {
    it('trims and lowercases', () => {
      expect(normalizeEmail('  User@Example.COM  ')).toBe('user@example.com');
    });
  });

  describe('normalizeText', () => {
    it('trims whitespace', () => {
      expect(normalizeText('  hello  ')).toBe('hello');
    });
  });

  describe('formatCpfDisplay', () => {
    it('formats as 000.000.000-00', () => {
      expect(formatCpfDisplay('12345678900')).toBe('123.456.789-00');
      expect(formatCpfDisplay('123')).toBe('123');
    });
  });

  describe('formatPhoneDisplay', () => {
    it('formats as (11) 99999-9999', () => {
      expect(formatPhoneDisplay('11999999999')).toBe('(11) 99999-9999');
    });
  });

  describe('formatMoneyDisplay', () => {
    it('formats BRL', () => {
      expect(formatMoneyDisplay(123.45)).toMatch(/123[.,]45/);
    });
  });

  describe('parseMoney', () => {
    it('parses BRL strings', () => {
      expect(parseMoney('123,45')).toBe(123.45);
      expect(parseMoney('R$ 1.234,56')).toBe(1234.56);
      expect(parseMoney('invalid')).toBeNull();
    });
  });

  describe('toIsoDate', () => {
    it('returns ISO string for valid date', () => {
      expect(toIsoDate(new Date('2024-01-15'))).toMatch(/2024-01-15/);
      expect(toIsoDate(null)).toBeNull();
    });
  });
});
