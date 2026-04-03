/**
 * Rótulos em português para exibição ao usuário (UI only).
 * Backend enums, API e banco NÃO devem ser alterados — apenas o que o usuário vê.
 *
 * Use este mapa em: badges, timeline, cards, contadores, listas de pedidos.
 * Serviço gratuito — sem fluxo de pagamento.
 */

export const STATUS_LABELS_PT: Record<string, string> = {
  // Prescription / Exam (canônicos)
  submitted: 'Enviado',
  analyzing: 'Em análise médica',
  in_review: 'Em análise médica',
  approved: 'Aprovado',
  signed: 'Assinado',
  delivered: 'Entregue',
  // Consultation (canônicos)
  searching_doctor: 'Buscando profissional',
  consultation_ready: 'Consulta pronta',
  in_consultation: 'Em consulta',
  pending_post_consultation: 'Emitir documentos',
  consultation_finished: 'Finalizada',
  // Common
  rejected: 'Rejeitado',
  cancelled: 'Cancelado',
  // Legados (retrocompatibilidade — dados históricos do banco)
  pending: 'Pendente',
  pending_payment: 'Aprovado',
  approved_pending_payment: 'Aprovado',
  paid: 'Aprovado',
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
export function getStatusLabelPt(status: string | null | undefined): string {
  const s = status ?? '';
  return (STATUS_LABELS_PT[s] ?? s) || '—';
}

/**
 * Rótulos dos cards de estatísticas no dashboard (Home).
 */
export const DASHBOARD_STATS_LABELS = {
  analyzing: 'Em análise médica',
  ready: 'Prontos',
} as const;

/**
 * Grupos de status para filtro por categoria na tela de pedidos.
 * Cada grupo agrupa os status do backend em categorias visíveis ao paciente.
 */
export const STATUS_GROUPS: Record<string, { label: string; statuses: string[] }> = {
  em_analise_medica: {
    label: 'Em análise médica',
    statuses: [
      'submitted', 'in_review', 'analyzing',
      'searching_doctor', 'pending', 'pending_payment',
    ],
  },
  ativo: {
    label: 'Ativos',
    statuses: [
      'approved', 'consultation_ready', 'in_consultation',
      'pending_post_consultation', 'approved_pending_payment', 'paid',
    ],
  },
  pronto: {
    label: 'Prontos',
    statuses: [
      'signed', 'delivered', 'consultation_finished', 'completed',
    ],
  },
};
