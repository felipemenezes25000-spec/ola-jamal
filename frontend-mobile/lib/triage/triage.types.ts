/**
 * triage.types.ts — Type system para o assistente de triagem Dra. Renova
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
  | 'doctor_editor';

export type TriageStep =
  | 'idle'
  | 'entry'
  | 'type_selected'
  | 'photos_added'
  | 'symptoms_entered'
  | 'analyzing'
  | 'result'
  | 'payment'      // NUNCA mostrar mensagem aqui
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
  /** Evento de analytics (ex: "triage.rx.controlled") */
  analyticsEvent?: string;
  /** Se true, pode ser mutado permanentemente pelo usuário */
  canMute?: boolean;
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
}

// ── Persisted state ─────────────────────────────────────────

export interface TriagePersistedState {
  /** key → timestamp da última exibição */
  cooldowns: Record<string, number>;
  /** Keys mutadas permanentemente pelo usuário */
  mutedKeys: string[];
  /** Contagem de exibições por sessão */
  sessionCounts: Record<string, number>;
  /** Versão do schema (para migrações futuras) */
  version: number;
}
