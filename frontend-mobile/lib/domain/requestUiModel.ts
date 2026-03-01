/**
 * Camada única de tradução de estado (domain -> UI) para Request.
 * Role-aware (patient vs doctor) e type-aware (exam/prescription/consultation).
 * Single source of truth para ações, timeline, contadores e badges.
 *
 * Regras principais:
 * - Paciente NUNCA tem ação em status `paid` (deve ser "aguardando médico").
 * - Paciente só pode pagar em `approved_pending_payment` e legado `pending_payment`.
 * - Para consulta: também em `consultation_ready`.
 * - Médico pode aprovar/rejeitar em `submitted`, `in_review`, legados `pending`, `analyzing`.
 */

import type { RequestResponseDto } from '../../types/database';
import { UI_STATUS_COLORS, type RequestUiColorKey } from './getRequestUiState';
import { STATUS_LABELS_PT } from './statusLabels';

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type Role = 'patient' | 'doctor';

export type RequestKind = 'exam' | 'prescription' | 'consultation';

export type UiPhase =
  | 'sent'
  | 'ai'
  | 'review'
  | 'awaiting_payment'
  | 'waiting_doctor'
  | 'ready_to_sign'
  | 'signed'
  | 'delivered'
  | 'consult_ready'
  | 'in_consultation'
  | 'finished'
  | 'cancelled'
  | 'rejected'
  | 'error';

export type NormalizedStatus =
  | 'submitted'
  | 'in_review'
  | 'approved_pending_payment'
  | 'paid'
  | 'signed'
  | 'delivered'
  | 'rejected'
  | 'cancelled'
  | 'searching_doctor'
  | 'consultation_ready'
  | 'in_consultation'
  | 'consultation_finished';

export interface UiActions {
  canPay: boolean;
  canApprove: boolean;
  canReject: boolean;
  canSign: boolean;
  canDeliver: boolean;
  canJoinCall: boolean;
  canDownload: boolean;
  canCancel?: boolean;
  /** Médico aceitar consulta (searching_doctor) */
  canAcceptConsultation?: boolean;
}

export interface UiTimelineStep {
  id: string;
  label: string;
  state: 'done' | 'current' | 'todo';
}

export type CountersBucket =
  | 'pending'
  | 'to_pay'
  | 'ready'
  | 'in_consultation'
  | 'historical'
  | 'none';

export interface RequestUiModel {
  phase: UiPhase;
  title: string;
  subtitle?: string;
  badge: { label: string; colorKey: RequestUiColorKey };
  timelineSteps: UiTimelineStep[];
  actions: UiActions;
  countersBucket: CountersBucket;
  /** Motivo quando ações principais estão desabilitadas (para banner do médico) */
  disabledReason?: string;
}

// ─── Normalização de status legados ────────────────────────────────────────

const LEGACY_TO_NORMALIZED: Record<string, NormalizedStatus> = {
  pending: 'submitted',
  analyzing: 'in_review',
  pending_payment: 'approved_pending_payment',
  approved: 'paid',
  completed: 'delivered',
};

export function normalizeRequestStatus(status: string): NormalizedStatus {
  const normalized = LEGACY_TO_NORMALIZED[status];
  if (normalized) return normalized;
  const valid: NormalizedStatus[] = [
    'submitted',
    'in_review',
    'approved_pending_payment',
    'paid',
    'signed',
    'delivered',
    'rejected',
    'cancelled',
    'searching_doctor',
    'consultation_ready',
    'in_consultation',
    'consultation_finished',
  ];
  return valid.includes(status as NormalizedStatus) ? (status as NormalizedStatus) : 'submitted';
}

// ─── Mapeamento phase -> colorKey (para badge) ──────────────────────────────

function getColorKeyForPhase(phase: UiPhase): RequestUiColorKey {
  switch (phase) {
    case 'awaiting_payment':
    case 'consult_ready':
      return 'waiting';
    case 'signed':
    case 'delivered':
    case 'finished':
      return 'success';
    case 'sent':
    case 'ai':
    case 'review':
    case 'ready_to_sign':
    case 'in_consultation':
    case 'waiting_doctor':
      return 'action';
    case 'cancelled':
    case 'error':
    case 'rejected':
      return 'historical';
    default:
      return 'historical';
  }
}

// ─── Tabela de semântica por role + kind + status ──────────────────────────

interface PhaseConfig {
  phase: UiPhase;
  title: string;
  subtitle?: string;
  actions: Partial<UiActions>;
  countersBucket: CountersBucket;
  disabledReason?: string;
}

function getPhaseConfig(
  role: Role,
  kind: RequestKind,
  status: NormalizedStatus,
  rawStatus: string
): PhaseConfig {
  if (status === 'rejected' || status === 'cancelled') {
    return {
      phase: status === 'rejected' ? 'rejected' : 'cancelled',
      title: status === 'rejected' ? 'Rejeitado' : 'Cancelado',
      actions: {},
      countersBucket: 'historical',
    };
  }

  if (kind === 'consultation') {
    return getConsultationPhaseConfig(role, status);
  }

  const config = getPrescriptionExamPhaseConfig(role, status);
  if (role === 'patient' && rawStatus === 'analyzing') {
    return { ...config, phase: 'ai', title: 'Análise IA' };
  }
  return config;
}

function getPrescriptionExamPhaseConfig(role: Role, status: NormalizedStatus): PhaseConfig {
  if (role === 'patient') {
    switch (status) {
      case 'submitted':
        return { phase: 'sent', title: 'Enviado', actions: { canCancel: true }, countersBucket: 'pending' };
      case 'in_review':
        return { phase: 'review', title: STATUS_LABELS_PT.in_review, actions: { canCancel: true }, countersBucket: 'pending' };
      case 'approved_pending_payment':
        return {
          phase: 'awaiting_payment',
          title: 'Aguardando pagamento',
          actions: { canPay: true, canCancel: true },
          countersBucket: 'to_pay',
        };
      case 'paid':
        return {
          phase: 'waiting_doctor',
          title: 'Aguardando médico preparar e assinar',
          actions: {},
          countersBucket: 'pending',
        };
      case 'signed':
        return {
          phase: 'signed',
          title: 'Documento pronto',
          actions: { canDownload: true },
          countersBucket: 'ready',
        };
      case 'delivered':
        return {
          phase: 'delivered',
          title: 'Entregue / disponível',
          actions: { canDownload: true },
          countersBucket: 'ready',
        };
      default:
        return { phase: 'sent', title: 'Enviado', actions: {}, countersBucket: 'pending' };
    }
  }

  // doctor
  switch (status) {
    case 'submitted':
      return {
        phase: 'sent',
        title: 'Novo pedido',
        actions: { canApprove: true, canReject: true },
        countersBucket: 'pending',
      };
    case 'in_review':
      return {
        phase: 'review',
        title: STATUS_LABELS_PT.in_review,
        actions: { canApprove: true, canReject: true },
        countersBucket: 'pending',
      };
    case 'approved_pending_payment':
      return {
        phase: 'awaiting_payment',
        title: 'Aguardando pagamento do paciente',
        actions: {},
        countersBucket: 'pending',
        disabledReason: 'Aguardando pagamento do paciente',
      };
    case 'paid':
      return {
        phase: 'ready_to_sign',
        title: 'Pronto para assinar',
        actions: { canSign: true },
        countersBucket: 'pending',
      };
    case 'signed':
      return {
        phase: 'signed',
        title: 'Assinado',
        actions: { canDeliver: true },
        countersBucket: 'pending',
        disabledReason: 'Pedido já assinado',
      };
    case 'delivered':
      return {
        phase: 'delivered',
        title: 'Entregue',
        actions: {},
        countersBucket: 'historical',
        disabledReason: 'Pedido já entregue',
      };
    default:
      return { phase: 'sent', title: 'Novo pedido', actions: {}, countersBucket: 'pending' };
  }
}

function getConsultationPhaseConfig(role: Role, status: NormalizedStatus): PhaseConfig {
  if (role === 'patient') {
    switch (status) {
      case 'submitted':
      case 'searching_doctor':
        return { phase: 'sent', title: 'Buscando médico', actions: { canCancel: true }, countersBucket: 'pending' };
      case 'consultation_ready':
        return {
          phase: 'consult_ready',
          title: 'Médico aceitou — pagar para iniciar',
          actions: { canPay: true, canCancel: true },
          countersBucket: 'to_pay',
        };
      case 'approved_pending_payment':
        return {
          phase: 'awaiting_payment',
          title: 'Aguardando pagamento',
          actions: { canPay: true, canCancel: true },
          countersBucket: 'to_pay',
        };
      case 'paid':
        return {
          phase: 'consult_ready',
          title: 'Pronto para entrar na consulta',
          actions: { canJoinCall: true },
          countersBucket: 'pending',
        };
      case 'in_consultation':
        return {
          phase: 'in_consultation',
          title: 'Em consulta',
          actions: { canJoinCall: true },
          countersBucket: 'in_consultation',
        };
      case 'consultation_finished':
        return {
          phase: 'finished',
          title: 'Finalizada',
          actions: {},
          countersBucket: 'ready',
        };
      default:
        return { phase: 'sent', title: 'Buscando médico', actions: {}, countersBucket: 'pending' };
    }
  }

  // doctor
  switch (status) {
    case 'submitted':
    case 'searching_doctor':
      return {
        phase: 'sent',
        title: 'Nova consulta disponível',
        actions: { canApprove: true, canReject: true, canAcceptConsultation: true },
        countersBucket: 'pending',
      };
    case 'consultation_ready':
      return {
        phase: 'consult_ready',
        title: 'Aguardando pagamento',
        actions: {},
        countersBucket: 'pending',
        disabledReason: 'Aguardando pagamento do paciente',
      };
    case 'approved_pending_payment':
      return {
        phase: 'awaiting_payment',
        title: 'Aguardando pagamento',
        actions: {},
        countersBucket: 'pending',
        disabledReason: 'Aguardando pagamento do paciente',
      };
    case 'paid':
      return {
        phase: 'consult_ready',
        title: 'Pode iniciar',
        actions: { canJoinCall: true },
        countersBucket: 'pending',
      };
    case 'in_consultation':
      return {
        phase: 'in_consultation',
        title: 'Em atendimento',
        actions: { canJoinCall: true },
        countersBucket: 'in_consultation',
      };
    case 'consultation_finished':
      return {
        phase: 'finished',
        title: 'Finalizada',
        actions: {},
        countersBucket: 'historical',
      };
    default:
      return { phase: 'sent', title: 'Nova consulta disponível', actions: {}, countersBucket: 'pending' };
  }
}

// ─── Timeline steps por role + kind ────────────────────────────────────────

function buildTimelineForPrescriptionExam(
  role: Role,
  phase: UiPhase,
  status: NormalizedStatus,
  rawStatus?: string
): UiTimelineStep[] {
  const hasAiStep = rawStatus === 'analyzing' || status === 'in_review';
  const patientSteps = [
    { id: 'sent', label: 'Enviado', phases: ['sent'] as UiPhase[] },
    ...(hasAiStep ? [{ id: 'ai', label: 'Análise IA', phases: ['ai'] as UiPhase[] }] : []),
    { id: 'review', label: STATUS_LABELS_PT.in_review, phases: ['review'] as UiPhase[] },
    { id: 'payment', label: 'Pagamento', phases: ['awaiting_payment'] as UiPhase[] },
    { id: 'signed', label: 'Assinado', phases: ['waiting_doctor', 'signed'] as UiPhase[] },
    { id: 'delivered', label: 'Entregue', phases: ['delivered'] as UiPhase[] },
  ];
  const doctorSteps = [
    { id: 'new', label: 'Novo', phases: ['sent'] as UiPhase[] },
    { id: 'review', label: STATUS_LABELS_PT.in_review, phases: ['review'] as UiPhase[] },
    { id: 'payment', label: 'Aguardando pagamento', phases: ['awaiting_payment'] as UiPhase[] },
    { id: 'sign', label: 'Assinar', phases: ['ready_to_sign'] as UiPhase[] },
    { id: 'delivered', label: 'Entregue', phases: ['signed', 'delivered'] as UiPhase[] },
  ];

  const steps = role === 'patient' ? patientSteps : doctorSteps;
  let currentStepIdx = 0;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].phases.includes(phase)) {
      currentStepIdx = i;
      break;
    }
    currentStepIdx = i + 1;
  }

  return steps.map((s, i) => ({
    id: s.id,
    label: s.label,
    state: i < currentStepIdx ? 'done' : i === currentStepIdx ? 'current' : 'todo',
  }));
}

function buildTimelineForConsultation(role: Role, phase: UiPhase): UiTimelineStep[] {
  const patientSteps = [
    { id: 'searching', label: 'Buscando', phases: ['sent'] as UiPhase[] },
    { id: 'payment', label: 'Pagamento', phases: ['awaiting_payment'] as UiPhase[] },
    { id: 'ready', label: 'Pronta', phases: ['consult_ready'] as UiPhase[] },
    { id: 'consultation', label: 'Em Consulta', phases: ['in_consultation'] as UiPhase[] },
    { id: 'finished', label: 'Finalizada', phases: ['finished'] as UiPhase[] },
  ];
  const doctorSteps = [
    { id: 'new', label: 'Nova', phases: ['sent'] as UiPhase[] },
    { id: 'payment', label: 'Pagamento', phases: ['consult_ready', 'awaiting_payment'] as UiPhase[] },
    { id: 'consultation', label: 'Em atendimento', phases: ['in_consultation'] as UiPhase[] },
    { id: 'finished', label: 'Finalizada', phases: ['finished'] as UiPhase[] },
  ];

  const steps = role === 'patient' ? patientSteps : doctorSteps;
  let currentStepIdx = 0;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].phases.includes(phase)) {
      currentStepIdx = i;
      break;
    }
    currentStepIdx = i + 1;
  }

  return steps.map((s, i) => ({
    id: s.id,
    label: s.label,
    state: i < currentStepIdx ? 'done' : i === currentStepIdx ? 'current' : 'todo',
  }));
}

// ─── Função principal getUiModel ───────────────────────────────────────────

export function getUiModel(request: RequestResponseDto | { status: string; requestType?: string }, role: Role): RequestUiModel {
  const kind: RequestKind =
    request.requestType === 'consultation'
      ? 'consultation'
      : request.requestType === 'exam'
        ? 'exam'
        : 'prescription';

  const rawStatus = request.status;
  const status = normalizeRequestStatus(rawStatus);
  const config = getPhaseConfig(role, kind, status, rawStatus);

  const defaultActions: UiActions = {
    canPay: false,
    canApprove: false,
    canReject: false,
    canSign: false,
    canDeliver: false,
    canJoinCall: false,
    canDownload: false,
    canCancel: false,
    canAcceptConsultation: false,
  };

  const actions: UiActions = { ...defaultActions, ...config.actions };

  const colorKey = getColorKeyForPhase(config.phase);
  const badgeLabel = getBadgeLabel(config.title, status, role, kind);

  const timelineSteps =
    kind === 'consultation'
      ? buildTimelineForConsultation(role, config.phase)
      : buildTimelineForPrescriptionExam(role, config.phase, status, rawStatus);

  return {
    phase: config.phase,
    title: config.title,
    subtitle: config.subtitle,
    badge: { label: badgeLabel, colorKey },
    timelineSteps,
    actions,
    countersBucket: config.countersBucket,
    disabledReason: config.disabledReason,
  };
}

function getBadgeLabel(title: string, status: NormalizedStatus, role: Role, kind: RequestKind): string {
  const base = STATUS_LABELS_PT[status];
  if (status === 'submitted') return role === 'patient' ? 'Enviado' : 'Novo pedido';
  if (status === 'paid') return role === 'patient' ? 'Aguardando médico' : 'Pronto para assinar';
  if (status === 'consultation_ready') return kind === 'consultation' ? 'Consulta pronta' : title;
  return base ?? title;
}

// ─── Helpers para contadores (single source of truth) ────────────────────────

export function getCountersForPatient(requests: RequestResponseDto[]) {
  let pending = 0;
  let toPay = 0;
  let ready = 0;
  for (const r of requests) {
    const ui = getUiModel(r, 'patient');
    // "Em análise médica" deve refletir somente fases de análise (review/ai).
    if (ui.phase === 'review' || ui.phase === 'ai') pending++;
    if (ui.actions.canPay) toPay++;
    if (ui.phase === 'signed' || ui.phase === 'delivered') ready++;
  }
  return { pending, toPay, ready };
}

export function getCountersForDoctor(requests: RequestResponseDto[]) {
  let naFila = 0;
  let consultaPronta = 0;
  let emConsulta = 0;
  let pendentesCount = 0;
  for (const r of requests) {
    const ui = getUiModel(r, 'doctor');
    const norm = normalizeRequestStatus(r.status);
    if (['submitted', 'in_review', 'approved_pending_payment', 'searching_doctor'].includes(norm)) {
      naFila++;
    }
    if (norm === 'consultation_ready') consultaPronta++;
    if (norm === 'in_consultation') emConsulta++;
    if (ui.countersBucket !== 'historical' && ui.phase !== 'finished') pendentesCount++;
  }
  return { naFila, consultaPronta, emConsulta, pendentesCount };
}

export function getPendingForPanelFromModel(requests: RequestResponseDto[], limit = 3): RequestResponseDto[] {
  return requests
    .filter((r) => {
      const ui = getUiModel(r, 'doctor');
      return ui.countersBucket !== 'historical' && ui.phase !== 'finished';
    })
    .slice(0, limit);
}

// Re-export para compatibilidade com StatusBadge
export { UI_STATUS_COLORS };
