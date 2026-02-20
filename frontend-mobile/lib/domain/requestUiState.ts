/**
 * Único ponto de verdade para mapear request (backend) → estado de UI.
 * Todas as telas que filtram ou exibem status devem usar getRequestUiState.
 * Não filtrar status "na mão" em listas; usar os grupos abaixo.
 */

import type { RequestResponseDto } from '../../types/database';

export type RequestUiState =
  | 'waiting_doctor'
  | 'in_review'
  | 'needs_payment'
  | 'paid_pending_sign'
  | 'signed_ready'
  | 'rejected'
  | 'cancelled'
  | 'unknown';

const STATUS_TO_UI: Record<string, RequestUiState> = {
  searching_doctor: 'waiting_doctor',
  submitted: 'in_review',
  pending: 'in_review',
  analyzing: 'in_review',
  in_review: 'in_review',
  approved_pending_payment: 'needs_payment',
  pending_payment: 'needs_payment',
  consultation_ready: 'needs_payment',
  approved: 'paid_pending_sign',
  paid: 'paid_pending_sign',
  signed: 'signed_ready',
  delivered: 'signed_ready',
  completed: 'signed_ready',
  consultation_finished: 'signed_ready',
  rejected: 'rejected',
  cancelled: 'cancelled',
};

/**
 * Retorna o estado de UI canônico para um request.
 * Usa apenas request.type, request.status e (quando existir) payment.
 */
export function getRequestUiState(request: RequestResponseDto): RequestUiState {
  return STATUS_TO_UI[request.status] ?? 'unknown';
}

/** Status do backend que devem aparecer na "fila" do médico (aguardando análise). */
export function isInDoctorQueue(uiState: RequestUiState): boolean {
  return uiState === 'in_review' || uiState === 'waiting_doctor';
}

/** Precisa pagar (paciente). */
export function needsPayment(uiState: RequestUiState): boolean {
  return uiState === 'needs_payment';
}

/** Já pago / assinado / entregue (sucesso). */
export function isSignedOrDelivered(uiState: RequestUiState): boolean {
  return uiState === 'signed_ready' || uiState === 'paid_pending_sign';
}

/** Finalizados (inclui rejeitado/cancelado). */
export function isTerminal(uiState: RequestUiState): boolean {
  return uiState === 'rejected' || uiState === 'cancelled' || uiState === 'signed_ready';
}
