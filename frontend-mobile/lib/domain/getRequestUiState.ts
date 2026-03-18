/**
 * Único ponto de verdade para mapear request (backend) → estado de UI.
 * Design system: Azul = ação, Verde = sucesso, Amarelo = aguardando, Cinza = histórico.
 *
 * State machine canônica (backend) — serviço gratuito (sem pagamento):
 *   prescription/exam: submitted → in_review → approved → signed → delivered
 *   consultation:      submitted → searching_doctor → approved → in_consultation → consultation_finished
 *   Qualquer estado:   → rejected | cancelled
 */

import type { RequestResponseDto } from '../../types/database';
import { STATUS_DISPLAY_LABELS_PT } from './statusLabels';
import { colors } from '../theme';
import type { DesignColors } from '../designSystem';

export type RequestUiState =
  | 'needs_action'
  | 'in_consultation'
  | 'ready'
  | 'historical';

export type RequestUiColorKey = 'action' | 'success' | 'waiting' | 'historical';

export interface RequestUiStateResult {
  uiState: RequestUiState;
  label: string;
  colorKey: RequestUiColorKey;
}

const STATUS_TO_UI: Record<string, RequestUiState> = {
  submitted:                'needs_action',
  in_review:                'needs_action',
  approved:                 'needs_action',
  signed:                   'historical',
  delivered:                'historical',
  searching_doctor:         'needs_action',
  consultation_ready:       'ready',
  in_consultation:          'in_consultation',
  pending_post_consultation: 'needs_action',
  consultation_finished:    'historical',
  rejected:                 'historical',
  cancelled:                'historical',
  // Legados
  pending:                  'needs_action',
  analyzing:                'needs_action',
  pending_payment:          'needs_action',
  approved_pending_payment: 'needs_action',
  paid:                     'needs_action',
  completed:                'historical',
};

const STATE_LABELS: Record<RequestUiState, string> = {
  needs_action:    'Pendente',
  in_consultation: 'Em consulta',
  ready:           'Consulta pronta',
  historical:      'Finalizado',
};

const STATE_COLORS: Record<RequestUiState, RequestUiColorKey> = {
  needs_action:    'waiting',
  in_consultation: 'action',
  ready:           'action',
  historical:      'historical',
};

const STATUS_DISPLAY_LABELS = STATUS_DISPLAY_LABELS_PT;

export function getRequestUiState(
  request: RequestResponseDto | { status?: string | null; requestType?: string | null }
): RequestUiStateResult {
  const status = request?.status ?? '';
  const requestType = (request as { requestType?: string | null })?.requestType ?? null;

  if (requestType === 'consultation' && ['approved', 'approved_pending_payment', 'paid'].includes(status)) {
    return { uiState: 'ready', label: 'Consulta pronta', colorKey: 'action' };
  }

  const uiState = STATUS_TO_UI[status] ?? 'historical';
  const label = STATUS_DISPLAY_LABELS[status] ?? STATE_LABELS[uiState];
  const colorKey = STATE_COLORS[uiState];
  return { uiState, label, colorKey };
}

export function isPendingForPanel(request: RequestResponseDto | null | undefined): boolean {
  const s = request?.status;
  if (!s) return false;
  return [
    'searching_doctor', 'in_consultation', 'submitted', 'in_review',
    'pending', 'analyzing', 'approved', 'approved_pending_payment', 'paid',
  ].includes(s);
}

export function countNaFila(requests: RequestResponseDto[]): number {
  return requests.filter((r) => {
    if (!r?.status) return false;
    const s = r.status;
    if (['submitted', 'in_review', 'approved', 'approved_pending_payment', 'searching_doctor'].includes(s)) return true;
    if (s === 'paid' && (r as { requestType?: string })?.requestType !== 'consultation') return true;
    return false;
  }).length;
}

export function countConsultaPronta(requests: RequestResponseDto[]): number {
  const consultationReady = ['approved', 'approved_pending_payment', 'paid'];
  return requests.filter((r) =>
    r?.status === 'consultation_ready' ||
    (consultationReady.includes(r?.status ?? '') && r?.requestType === 'consultation')
  ).length;
}

export function countEmConsulta(requests: RequestResponseDto[]): number {
  return requests.filter((r) => r?.status === 'in_consultation').length;
}

export function countPendentes(requests: RequestResponseDto[]): number {
  return requests.filter(isPendingForPanel).length;
}

export function getPendingForPanel(requests: RequestResponseDto[], limit = 3): RequestResponseDto[] {
  return requests.filter(isPendingForPanel).slice(0, limit);
}

export function isHistorical(request: RequestResponseDto): boolean {
  return (STATUS_TO_UI[request?.status ?? ''] ?? 'historical') === 'historical';
}

export interface DayGroup { dayLabel: string; dateKey: string; count: number; }

export function getHistoricalGroupedByDay(requests: RequestResponseDto[], maxDays = 7): DayGroup[] {
  const historical = requests.filter(isHistorical);
  const byDateKey: Record<string, number> = {};
  const now = new Date();
  for (const r of historical) {
    const dateStr = r.updatedAt || r.signedAt || r.createdAt;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    byDateKey[key] = (byDateKey[key] ?? 0) + 1;
  }
  const keys = Object.keys(byDateKey).sort((a, b) => b.localeCompare(a)).slice(0, maxDays);
  return keys.map((dateKey) => {
    const d = new Date(dateKey + 'T12:00:00');
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    let dayLabel: string;
    if (diffDays === 0) dayLabel = 'Hoje';
    else if (diffDays === 1) dayLabel = 'Ontem';
    else dayLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return { dayLabel, dateKey, count: byDateKey[dateKey]! };
  });
}

export interface PeriodGroup { label: string; count: number; }

export function getHistoricalGroupedByPeriod(requests: RequestResponseDto[]): PeriodGroup[] {
  const historical = requests.filter(isHistorical);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const getRequestDate = (r: RequestResponseDto): Date | null => {
    const dateStr = r.updatedAt || r.signedAt || r.createdAt;
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const msDay = 86400000;
  const start7 = new Date(today.getTime() - 7 * msDay);
  const start90 = new Date(today.getTime() - 90 * msDay);
  const start180 = new Date(today.getTime() - 180 * msDay);
  let countWeek = 0, countMonth = 0, count3Months = 0, count6Months = 0;
  for (const r of historical) {
    const d = getRequestDate(r);
    if (!d) continue;
    const t = d.getTime();
    if (t >= start7.getTime()) countWeek++;
    if (t >= startOfMonth.getTime()) countMonth++;
    if (t >= start90.getTime()) count3Months++;
    if (t >= start180.getTime()) count6Months++;
  }
  return [
    { label: 'Semana', count: countWeek },
    { label: 'Mês', count: countMonth },
    { label: '3 meses', count: count3Months },
    { label: '6 meses', count: count6Months },
  ];
}

export function isSignedOrDelivered(request: RequestResponseDto | { status: string }): boolean {
  const s = request.status;
  return ['signed', 'delivered', 'completed', 'consultation_finished'].includes(s);
}

export const UI_STATUS_COLORS: Record<RequestUiColorKey, { color: string; bg: string }> = {
  action: { color: colors.info, bg: colors.infoLight },
  success: { color: colors.success, bg: colors.successLight },
  waiting: { color: colors.warning, bg: colors.warningLight },
  historical: { color: colors.textMuted, bg: colors.surfaceSecondary },
};

export function getUIStatusColorsForTheme(c: DesignColors): Record<RequestUiColorKey, { color: string; bg: string }> {
  return {
    action: { color: c.info, bg: c.infoLight },
    success: { color: c.success, bg: c.successLight },
    waiting: { color: c.warning, bg: c.warningLight },
    historical: { color: c.textMuted, bg: c.surfaceSecondary },
  };
}
