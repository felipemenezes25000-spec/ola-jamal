/**
 * Fallback de preços quando o backend não retorna valor.
 * NÃO espalhar preços hardcoded em telas; usar request.price ?? getFallbackPrice(type, ...).
 */

import type { RequestType } from '../../types/database';

/** Valores fallback por tipo (apenas quando backend não envia price). TODO: alinhar com backend quando houver tabela de preços. */
export const FALLBACK_PRICES: Record<RequestType, number> = {
  prescription: 80,
  exam: 60,
  consultation: 120,
};

/** Preços por tipo de receita (telas de new-request). Centralizado aqui para não hardcode em componentes. */
export const PRESCRIPTION_TYPE_PRICES: Record<'simples' | 'controlado' | 'azul', number> = {
  simples: 50,
  controlado: 80,
  azul: 100,
};

export const FALLBACK_CONSULTATION_PRICE = 120;
export const FALLBACK_EXAM_PRICE = 60;

/**
 * Retorna o valor a exibir para um request. Preferência: request.price; senão fallback por tipo.
 */
export function getDisplayPrice(
  price: number | null | undefined,
  requestType?: RequestType
): number {
  if (price != null && price > 0) return price;
  if (requestType && FALLBACK_PRICES[requestType] != null) return FALLBACK_PRICES[requestType];
  return FALLBACK_PRICES.prescription;
}
