/**
 * Rótulos em português para exibição ao usuário (UI only).
 * Backend enums, API e banco NÃO devem ser alterados — apenas o que o usuário vê.
 *
 * Use este mapa em: badges, timeline, cards, contadores, listas de pedidos.
 */

export const STATUS_LABELS_PT: Record<string, string> = {
  // Prescription / Exam (canônicos)
  submitted: 'Enviado',
  analyzing: 'Em análise médica',
  in_review: 'Em análise médica',
  approved_pending_payment: 'Aguardando pagamento',
  paid: 'Pago',
  signed: 'Assinado',
  delivered: 'Entregue',
  // Consultation (canônicos)
  searching_doctor: 'Buscando médico',
  consultation_ready: 'Consulta pronta',
  in_consultation: 'Em consulta',
  consultation_finished: 'Finalizada',
  // Common
  rejected: 'Rejeitado',
  cancelled: 'Cancelado',
  // Legados (retrocompatibilidade)
  pending: 'Pendente',
  pending_payment: 'Aguardando pagamento',
  approved: 'Aprovado',
  completed: 'Concluído',
};

/** Label para cards/listas genéricas (ex.: "Na fila" para submitted). Pode divergir de STATUS_LABELS_PT. */
export const STATUS_DISPLAY_LABELS_PT: Record<string, string> = {
  ...STATUS_LABELS_PT,
  submitted: 'Na fila',
  searching_doctor: 'Na fila',
};

/**
 * Retorna o rótulo em PT para um status do backend (apenas UI).
 */
export function getStatusLabelPt(status: string): string {
  return STATUS_LABELS_PT[status] ?? status;
}
