/**
 * Único ponto de verdade para mapear request (backend) → estado de UI.
 * Design system: Azul = ação, Verde = sucesso, Amarelo = aguardando, Cinza = histórico.
 * Nenhuma tela deve filtrar status diretamente; usar apenas este helper.
 */

import type { RequestResponseDto } from '../../types/database';

export type RequestUiState =
  | 'needs_action'
  | 'waiting_payment'
  | 'in_consultation'
  | 'ready'
  | 'historical';

export type RequestUiColorKey = 'action' | 'success' | 'waiting' | 'historical';

export interface RequestUiStateResult {
  uiState: RequestUiState;
  /** Label para exibição (ex: "Consulta pronta", "Aguardando pagamento") */
  label: string;
  colorKey: RequestUiColorKey;
}

const STATUS_TO_UI: Record<string, RequestUiState> = {
  submitted: 'needs_action',
  pending: 'needs_action',
  analyzing: 'needs_action',
  in_review: 'needs_action',
  approved_pending_payment: 'waiting_payment',
  pending_payment: 'waiting_payment',
  searching_doctor: 'needs_action',
  consultation_ready: 'ready',
  in_consultation: 'in_consultation',
  paid: 'needs_action', // até médico atender (consultation) ou assinar
  approved: 'needs_action',
  signed: 'historical',
  delivered: 'historical',
  completed: 'historical',
  consultation_finished: 'historical',
  rejected: 'historical',
  cancelled: 'historical',
};

const STATE_LABELS: Record<RequestUiState, string> = {
  needs_action: 'Pendente',
  waiting_payment: 'Aguardando pagamento',
  in_consultation: 'Em consulta',
  ready: 'Consulta pronta',
  historical: 'Finalizado',
};

const STATE_COLORS: Record<RequestUiState, RequestUiColorKey> = {
  needs_action: 'waiting',
  waiting_payment: 'waiting',
  in_consultation: 'action',
  ready: 'action',
  historical: 'historical',
};

/** Labels específicos por status do backend para exibição em cards */
const STATUS_DISPLAY_LABELS: Record<string, string> = {
  submitted: 'Na fila',
  in_review: 'Em análise',
  analyzing: 'Analisando',
  pending: 'Pendente',
  approved_pending_payment: 'Aguardando pagamento',
  pending_payment: 'Aguardando pagamento',
  searching_doctor: 'Na fila',
  consultation_ready: 'Consulta pronta',
  in_consultation: 'Em consulta',
  paid: 'Pago',
  approved: 'Aprovado',
  signed: 'Assinado',
  delivered: 'Entregue',
  completed: 'Concluído',
  consultation_finished: 'Finalizada',
  rejected: 'Rejeitado',
  cancelled: 'Cancelado',
};

/**
 * Retorna estado de UI, label e cor para um request (ou apenas status).
 * Todas as telas devem usar esta função para exibir status.
 */
export function getRequestUiState(
  request: RequestResponseDto | { status: string }
): RequestUiStateResult {
  const status = request.status;
  const uiState = STATUS_TO_UI[status] ?? 'historical';
  const label = STATUS_DISPLAY_LABELS[status] ?? STATE_LABELS[uiState];
  const colorKey = STATE_COLORS[uiState];
  return { uiState, label, colorKey };
}

/** Request exige ação do médico agora (painel "Atendimentos pendentes"). */
export function isPendingForPanel(request: RequestResponseDto): boolean {
  const s = request.status;
  return [
    'searching_doctor',
    'consultation_ready',
    'in_consultation',
    'submitted',
    'in_review',
    'pending',
    'analyzing',
    'approved_pending_payment',
    'pending_payment',
    'paid',
    'approved',
  ].includes(s);
}

/** Conta para card "Na fila" (amarelo): submitted, in_review, pending_payment, approved_pending_payment, searching_doctor */
export function countNaFila(requests: RequestResponseDto[]): number {
  return requests.filter((r) =>
    ['submitted', 'in_review', 'pending_payment', 'approved_pending_payment', 'searching_doctor'].includes(r.status)
  ).length;
}

/** Conta para card "Consulta pronta" (azul) */
export function countConsultaPronta(requests: RequestResponseDto[]): number {
  return requests.filter((r) => r.status === 'consultation_ready').length;
}

/** Conta para card "Em consulta" (verde) */
export function countEmConsulta(requests: RequestResponseDto[]): number {
  return requests.filter((r) => r.status === 'in_consultation').length;
}

/** Total de atendimentos que exigem ação (para o header "Você tem X atendimentos pendentes") */
export function countPendentes(requests: RequestResponseDto[]): number {
  return requests.filter(isPendingForPanel).length;
}

/** Lista de requests para a seção "Atendimentos pendentes" do painel (máx. 3) */
export function getPendingForPanel(requests: RequestResponseDto[], limit = 3): RequestResponseDto[] {
  return requests.filter(isPendingForPanel).slice(0, limit);
}

/** Request já finalizado (não aparece no painel de pendentes) */
export function isHistorical(request: RequestResponseDto): boolean {
  return (STATUS_TO_UI[request.status] ?? 'historical') === 'historical';
}

/** Agrupa atendimentos realizados por dia para o painel (resumo por dia, sem listar todos). */
export interface DayGroup {
  dayLabel: string;
  dateKey: string;
  count: number;
}

export function getHistoricalGroupedByDay(
  requests: RequestResponseDto[],
  maxDays = 7
): DayGroup[] {
  const historical = requests.filter(isHistorical);
  const byDateKey: Record<string, number> = {};
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

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

/** Período para resumo de realizados (semana, mês, 3 meses, 6 meses) */
export interface PeriodGroup {
  label: string;
  count: number;
}

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

  let countWeek = 0;
  let countMonth = 0;
  let count3Months = 0;
  let count6Months = 0;

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

/** Aguardando pagamento (paciente) */
export function needsPayment(request: RequestResponseDto | { status: string }): boolean {
  return getRequestUiState(request).uiState === 'waiting_payment';
}

/** Já assinado/entregue/concluído (sucesso final) */
export function isSignedOrDelivered(request: RequestResponseDto | { status: string }): boolean {
  const s = request.status;
  return ['signed', 'delivered', 'completed', 'consultation_finished'].includes(s);
}

/** Design system: Azul = ação, Verde = sucesso, Amarelo = aguardando, Cinza = histórico (sem roxo/cyan) */
export const UI_STATUS_COLORS: Record<RequestUiColorKey, { color: string; bg: string }> = {
  action: { color: '#3B82F6', bg: '#DBEAFE' },
  success: { color: '#059669', bg: '#D1FAE5' },
  waiting: { color: '#D97706', bg: '#FEF3C7' },
  historical: { color: '#6B7280', bg: '#F3F4F6' },
};
