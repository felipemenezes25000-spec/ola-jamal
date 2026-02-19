/**
 * Validação de CPF brasileiro (algoritmo módulo 11).
 */

export function isValidCpf(cpf: string): boolean {
  const digits = (cpf || '').replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const mult1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const mult2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

  let temp = digits.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(temp[i]) * mult1[i];
  let rest = sum % 11;
  rest = rest < 2 ? 0 : 11 - rest;
  temp += String(rest);

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(temp[i]) * mult2[i];
  rest = sum % 11;
  rest = rest < 2 ? 0 : 11 - rest;

  return digits.endsWith(temp[9] + String(rest));
}
