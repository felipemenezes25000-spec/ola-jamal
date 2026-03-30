/**
 * Formata o preco para exibicao (ex: "R$ 49,90").
 */
export function getDisplayPrice(amount: number | null | undefined): string {
  if (amount == null || amount <= 0) return 'Gratuito';
  return `R$ ${amount.toFixed(2).replace('.', ',')}`;
}
