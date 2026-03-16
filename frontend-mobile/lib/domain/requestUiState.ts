/**
 * Único ponto de verdade para mapear request (backend) → estado de UI.
 * Todas as telas que filtram ou exibem status devem usar getRequestUiState.
 *
 * State machine canônica (backend) — serviço gratuito (sem pagamento):
 *   prescription/exam: submitted → in_review → approved → signed → delivered
 *   consultation:      submitted → searching_doctor → approved → in_consultation → consultation_finished
 *   Qualquer estado:   → rejected | cancelled
 *
 * Status legados (mantidos apenas para retrocompatibilidade com dados históricos):
 *   pending → in_review, analyzing → in_review, approved_pending_payment → approved,
 *   paid → approved, pending_payment → approved, completed → signed_ready
 */

import type { RequestResponseDto } from '../../types/database';

export type RequestUiState =
  | 'waiting_doctor'
  | 'in_review'
  | 'approved'
  | 'in_consultation'
  | 'signed_ready'
  | 'rejected'
  | 'cancelled'
  | 'unknown';

const STATUS_TO_UI: Record<string, RequestUiState> = {
  // ── Canônicos: prescription / exam ──────────────────────────
  submitted:                'in_review',
  in_review:                'in_review',
  approved:                 'approved',
  signed:                   'signed_ready',
  delivered:                'signed_ready',
  // ── Canônicos: consultation ──────────────────────────────────
  searching_doctor:         'waiting_doctor',
  consultation_ready:       'approved',
  in_consultation:          'in_consultation',
  consultation_finished:    'signed_ready',
  // ── Canônicos: common ────────────────────────────────────────
  rejected:                 'rejected',
  cancelled:                'cancelled',
  // ── Legados (retrocompatibilidade) ──────────────────────────
  pending:                  'in_review',
  analyzing:                'in_review',
  pending_payment:          'approved',
  approved_pending_payment: 'approved',
  paid:                     'approved',
  completed:                'signed_ready',
};

/**
 * Retorna o estado de UI canônico para um request.
 */
export function getRequestUiState(request: RequestResponseDto): RequestUiState {
  return STATUS_TO_UI[request.status] ?? 'unknown';
}

/** Status do backend que devem aparecer na "fila" do médico (aguardando análise). */
export function isInDoctorQueue(uiState: RequestUiState): boolean {
  return uiState === 'in_review' || uiState === 'waiting_doctor';
}

/** Já aprovado / assinado / entregue (sucesso). */
export function isSignedOrDelivered(uiState: RequestUiState): boolean {
  return uiState === 'signed_ready' || uiState === 'approved';
}

/** Finalizados (inclui rejeitado/cancelado). */
export function isTerminal(uiState: RequestUiState): boolean {
  return uiState === 'rejected' || uiState === 'cancelled' || uiState === 'signed_ready';
}
