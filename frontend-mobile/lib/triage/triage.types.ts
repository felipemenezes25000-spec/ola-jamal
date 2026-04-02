/**
 * triage.types.ts — Type system para o assistente de triagem Dra. Renoveja
 *
 * Todas as interfaces e tipos usados pelo motor de regras, provider e UI.
 * Centralizado aqui para type-safety total.
 */

// ── Context & Step ──────────────────────────────────────────

export type TriageContext =
  | 'home'
  | 'prescription'
  | 'exam'
  | 'consultation'
  | 'detail'
  | 'requests'
  | 'record'
  | 'profile'
  | 'help'
  | 'doctor_editor'
  | 'doctor_dashboard'
  | 'doctor_detail'
  | 'doctor_prontuario';

export type TriageStep =
  | 'idle'
  | 'entry'
  | 'type_selected'
  | 'photos_added'
  | 'symptoms_entered'
  | 'analyzing'
  | 'result'
  | 'signing'      // NUNCA mostrar mensagem aqui
  | 'completed';

// ── Visual ──────────────────────────────────────────────────

export type Severity = 'info' | 'attention' | 'positive' | 'neutral';
export type AvatarState = 'neutral' | 'alert' | 'positive' | 'thinking';

// ── CTA ─────────────────────────────────────────────────────

export type CTAAction =
  | 'teleconsulta'
  | 'consulta_breve'
  | 'ver_servicos'
  | 'agendar_retorno'
  | 'renovar_receita'
  | 'pedir_exames'
  | 'tire_duvidas'
  | 'abrir_documento'
  | 'acompanhar_pedido'
  | 'abrir_pagamento'  // legado; tratado como acompanhar_pedido (sem pagamento no SUS)
  | 'dismiss'
  | null;

// ── Message ─────────────────────────────────────────────────

export interface TriageMessage {
  /** Chave única para dedupe (route:step:reason) */
  key: string;
  /** Texto principal (max ~120 chars — 2 linhas) */
  text: string;
  severity: Severity;
  avatarState: AvatarState;
  /** Ação do botão CTA (null = sem CTA, apenas "Entendi") */
  cta: CTAAction;
  /** Label do CTA (ex: "Falar com Médico") */
  ctaLabel?: string;
  /** Cooldown antes de poder mostrar novamente (ms) */
  cooldownMs: number;
  /** Opcional: pedido associado para CTA contextual */
  requestId?: string;
  /** Opcional: status associado para narrativa de jornada */
  status?: string | null;
  /** Evento de analytics (ex: "triage.rx.controlled") */
  analyticsEvent?: string;
  /** Se true, pode ser mutado permanentemente pelo usuário */
  canMute?: boolean;
  /** Se true, o texto foi personalizado pela IA (apenas tom, nunca decisão) */
  isPersonalized?: boolean;
}

// ── Input do motor de regras ────────────────────────────────

export interface TriageInput {
  context: TriageContext;
  step: TriageStep;
  role: 'patient' | 'doctor';

  // Request context
  requestType?: 'prescription' | 'exam' | 'consultation';
  prescriptionType?: string | null;
  examType?: string | null;
  exams?: string[];
  symptoms?: string | null;
  status?: string | null;
  requestId?: string;
  imagesCount?: number;

  // AI analysis results
  aiRiskLevel?: string | null;
  aiReadabilityOk?: boolean | null;
  aiMessageToUser?: string | null;
  aiSummaryForDoctor?: string | null;
  aiConductSuggestion?: string | null;

  // Existing data on request
  autoObservation?: string | null;
  doctorConductNotes?: string | null;

  // Patient history stats
  totalRequests?: number;
  recentPrescriptionCount?: number;
  recentExamCount?: number;
  lastConsultationDays?: number;
  /** Dias desde a última receita assinada (para sugestão de renovação) */
  lastPrescriptionDaysAgo?: number;
  /** Dias desde o último pedido de exame assinado */
  lastExamDaysAgo?: number;
  /** Idade do paciente (para recomendações por faixa etária) */
  patientAge?: number;
  /** Medicamentos recentes do histórico */
  recentMedications?: string[];

  // Doctor workflow stats (uso do sistema, não clínico)
  doctorPendingCount?: number;
  doctorToSignCount?: number;
  doctorInConsultationCount?: number;
  doctorHasCertificate?: boolean;
}

// ── Persisted state ─────────────────────────────────────────

/** Posição da Dra. Renoveja: fixa no fundo ou flutuante em um canto */
export type BannerPositionMode = 'fixed' | 'floating';

/** Posição flutuante (x, y em px a partir do canto) */
export interface BannerFloatingPosition {
  x: number;
  y: number;
  /** Canto de ancoragem: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' */
  anchor: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

export interface TriagePersistedState {
  /** key → timestamp da última exibição */
  cooldowns: Record<string, number>;
  /** Keys mutadas permanentemente pelo usuário */
  mutedKeys: string[];
  /** Contagem de exibições por sessão */
  sessionCounts: Record<string, number>;
  /** Número de visitas à Home (para InfoCard temporário) */
  homeVisitCount?: number;
  /** Se o InfoCard da home foi dismissado pelo usuário */
  homeInfoCardDismissed?: boolean;
  /** Modo da Dra. Renoveja: fixa no fundo ou flutuante arrastável */
  bannerPositionMode?: BannerPositionMode;
  /** Posição quando flutuante (persistida entre sessões) */
  bannerFloatingPosition?: BannerFloatingPosition;
  /** Se true, Dra. Renoveja reabre expandida ao remontar (após navegação) */
  bannerExpanded?: boolean;
  /** Memória de jornada por pedido (último status orientado) */
  journeyByRequest?: Record<string, { status: string; at: number }>;
  /** Versão do schema (para migrações futuras) */
  version: number;
}
