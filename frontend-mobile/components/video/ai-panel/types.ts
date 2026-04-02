/**
 * ai-panel/types.ts — Shared types, configs, helpers, and styles
 * for the DoctorAIPanel sub-components.
 */

import { StyleSheet } from 'react-native';
import { ANA_FIELDS as SHARED_ANA_FIELDS } from '../../../lib/domain/anamnesis';

// ── Types ──

export type MedSugerido = string | {
  nome: string; classe_terapeutica?: string; dose?: string; via?: string;
  posologia?: string; duracao?: string; indicacao?: string;
  melhora_esperada?: string;
  contraindicacoes?: string; interacoes?: string;
  mecanismo_acao?: string; ajuste_renal?: string; ajuste_hepatico?: string;
  alerta_faixa_etaria?: string; alternativa?: string;
};

export type ExameSugerido = string | {
  nome: string; codigo_tuss?: string; descricao?: string;
  o_que_afere?: string; indicacao?: string; interpretacao_esperada?: string;
  preparo_paciente?: string; prazo_resultado?: string; urgencia?: string;
};

export type DiagDiferencial = {
  hipotese: string; cid: string; probabilidade: string;
  probabilidade_percentual?: number;
  argumentos_a_favor?: string; argumentos_contra?: string;
  exames_confirmatorios?: string;
};

export type PerguntaSugerida = {
  pergunta: string;
  objetivo?: string;
  hipoteses_afetadas?: string;
  impacto_na_conduta?: string;
  prioridade?: 'alta' | 'media' | 'baixa';
};

export type InteracaoCruzada = {
  medicamento_a: string;
  medicamento_b: string;
  tipo: 'grave' | 'moderada' | 'leve';
  descricao: string;
  conduta?: string;
};

export type EvidenceItem = {
  title: string; abstract?: string; source: string;
  translatedAbstract?: string; relevantExcerpts?: string[];
  clinicalRelevance?: string; provider?: string; url?: string;
  conexaoComPaciente?: string; nivelEvidencia?: string; motivoSelecao?: string;
};

export interface DoctorAIPanelProps {
  anamnesis: Record<string, unknown> | null;
  suggestions: string[];
  evidence: EvidenceItem[];
  consultationType?: string | null;
}

// ── Tab definition ──

export type TabKey = 'consulta' | 'perguntas' | 'evidencias';

export const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'consulta', label: 'Consulta', icon: 'document-text' },
  { key: 'perguntas', label: 'Perguntas', icon: 'help-circle' },
  { key: 'evidencias', label: 'Evidências', icon: 'library' },
];

// ── Anamnesis fields ──

export const ANA_FIELDS = SHARED_ANA_FIELDS;

// ── Config functions ──

export function getGravityConfig(colors: PanelColors): Record<string, { color: string; label: string; icon: string }> {
  return {
    verde: { color: colors.success, label: 'Não Urgente', icon: 'shield-checkmark' },
    amarelo: { color: colors.warning, label: 'Pouco Urgente', icon: 'alert-circle' },
    laranja: { color: colors.error, label: 'Urgente', icon: 'warning' },
    vermelho: { color: colors.destructive ?? colors.error, label: 'Emergência', icon: 'close-circle' },
  };
}

export function getConfidenceConfig(colors: PanelColors): Record<string, { color: string; label: string }> {
  return {
    alta: { color: colors.success, label: 'Confiança Alta' },
    media: { color: colors.warning, label: 'Confiança Média' },
    baixa: { color: colors.destructive ?? colors.error, label: 'Confiança Baixa' },
  };
}

// ── Helpers ──

export function parseMed(m: MedSugerido): Record<string, string> {
  if (typeof m === 'string') {
    return { nome: m, classe_terapeutica: '', dose: '', via: '', posologia: '', duracao: '', indicacao: '', contraindicacoes: '', interacoes: '', alerta_faixa_etaria: '', alternativa: '' };
  }
  return m as Record<string, string>;
}

export function parseExam(ex: ExameSugerido): Record<string, string> {
  if (typeof ex === 'string') {
    return { nome: ex, codigo_tuss: '', descricao: '', o_que_afere: '', indicacao: '', preparo_paciente: '', prazo_resultado: '', urgencia: 'rotina' };
  }
  return ex as Record<string, string>;
}

// ── Styles ──

export type PanelColors = {
  primary: string; primaryLight: string; primarySoft: string;
  text: string; textMuted: string; textSecondary: string; white: string;
  error: string; errorLight: string; warning: string; warningLight: string;
  success: string; accent: string; accentSoft: string;
  border: string; surface: string; surfaceSecondary: string;
  destructive?: string;
};

export function makeStyles(colors: PanelColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },

    tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 8, backgroundColor: colors.surface },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
    tabTextActive: { color: colors.primary },
    tabBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    tabBadgeText: { fontSize: 9, fontWeight: '700', color: colors.white },

    content: { padding: 12, gap: 14 },

    // Copy All
    copyAllTopBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary + '25' },
    copyAllTopText: { fontSize: 12, color: colors.primary, fontWeight: '700' },

    // Gravity
    gravityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    gravityText: { fontSize: 13, fontWeight: '700' },

    // CID card
    cidCard: { backgroundColor: colors.primarySoft, borderRadius: 10, padding: 12, gap: 6, borderWidth: 1, borderColor: colors.primary + '20' },
    cidHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cidLabel: { fontSize: 11, fontWeight: '700', color: colors.primary, letterSpacing: 0.5, flex: 1 },
    confidenceBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    confidenceDot: { width: 6, height: 6, borderRadius: 3 },
    confidenceText: { fontSize: 10, fontWeight: '600' },
    cidValue: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 },
    cidDescricao: { fontSize: 11, color: colors.textSecondary, lineHeight: 16, marginTop: 2 },
    cidPlaceholder: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', lineHeight: 18 },
    cidCopy: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
    cidCopyText: { fontSize: 11, color: colors.primary, fontWeight: '600' },

    // Sections
    sec: { gap: 8 },
    secH: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    secT: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: colors.primarySoft },
    badgeTxt: { fontSize: 10, fontWeight: '700', color: colors.primary },

    // Anamnesis fields
    af: { gap: 2, paddingLeft: 4 },
    afL: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    afLT: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3, textTransform: 'uppercase' },
    afV: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

    // Alerts
    alertBlock: { backgroundColor: colors.errorLight, borderRadius: 8, padding: 10, gap: 6, borderWidth: 1, borderColor: colors.error + '40' },
    alertText: { fontSize: 12, color: colors.error, lineHeight: 18 },

    // Differential diagnosis
    ddItem: { backgroundColor: colors.surfaceSecondary, borderRadius: 8, padding: 10, gap: 4 },
    ddHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ddProbDot: { width: 8, height: 8, borderRadius: 4 },
    ddHipotese: { fontSize: 12, fontWeight: '700', color: colors.text, flex: 1 },
    ddCid: { fontSize: 11, color: colors.primary, fontWeight: '600', marginLeft: 14 },
    ddArg: { fontSize: 11, color: colors.success, marginLeft: 14, lineHeight: 16 },
    ddArgContra: { fontSize: 11, color: colors.warning, marginLeft: 14, lineHeight: 16 },
    ddExames: { fontSize: 11, color: colors.primary, marginLeft: 14, lineHeight: 16 },

    // Physical exam
    examFisicoBlock: { backgroundColor: colors.accentSoft, borderRadius: 8, padding: 10, gap: 6, borderWidth: 1, borderColor: colors.accent + '40' },
    examFisicoText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

    // Medications
    medCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 10, gap: 6, borderWidth: 1, borderColor: colors.border },
    medHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    medNumCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center' },
    medNum: { fontSize: 11, fontWeight: '700', color: colors.primary },
    medNome: { fontSize: 12, fontWeight: '700', color: colors.text, lineHeight: 18 },
    medDosagem: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    medIndicacao: { fontSize: 11, color: colors.textMuted, paddingLeft: 30, lineHeight: 16 },
    medDetails: { paddingLeft: 30, gap: 4, marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border },
    medDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    medDetailText: { fontSize: 11, color: colors.textSecondary, lineHeight: 16, flex: 1 },
    medAction: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 30, marginTop: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, backgroundColor: colors.primarySoft, alignSelf: 'flex-start' },
    medActionText: { fontSize: 10, color: colors.primary, fontWeight: '600' },

    // Exams
    examCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 10, gap: 4, borderWidth: 1, borderColor: colors.border },
    examUrgent: { backgroundColor: colors.errorLight, borderColor: colors.error + '60' },
    examHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    examNumCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center' },
    examNumText: { fontSize: 11, fontWeight: '700', color: colors.primary },
    examNome: { fontSize: 12, fontWeight: '700', color: colors.text, flex: 1, lineHeight: 18 },
    urgentBadge: { backgroundColor: colors.error, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    urgentText: { fontSize: 9, fontWeight: '700', color: colors.white },
    examTuss: { fontSize: 10, color: colors.primary, fontWeight: '600', marginLeft: 30, fontFamily: 'monospace' },
    examDetail: { fontSize: 11, color: colors.textSecondary, marginLeft: 30, lineHeight: 16 },
    examIndicacao: { fontSize: 11, color: colors.textMuted, marginLeft: 30, lineHeight: 16 },
    examPreparo: { fontSize: 11, color: colors.warning, marginLeft: 30, lineHeight: 16 },
    examInterpretacao: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginLeft: 30, marginTop: 2, backgroundColor: colors.accentSoft, borderRadius: 6, padding: 6 },
    examInterpretacaoText: { fontSize: 11, color: colors.accent, lineHeight: 16, flex: 1, fontStyle: 'italic' },

    // Drug interactions
    interacaoCard: { borderRadius: 10, padding: 12, gap: 6, borderWidth: 1 },
    interacaoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    interacaoTipoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    interacaoTipoText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
    interacaoMeds: { fontSize: 13, fontWeight: '700', color: colors.text },
    interacaoDesc: { fontSize: 12, lineHeight: 18 },
    interacaoCondutaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 2 },
    interacaoConduta: { fontSize: 11, color: colors.primary, lineHeight: 16, flex: 1, fontWeight: '600' },

    disclaimer: { fontSize: 10, color: colors.textMuted, fontStyle: 'italic', marginTop: 4 },

    // Orientations
    orientText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, paddingLeft: 4 },
    criterioText: { fontSize: 12, color: colors.warning, lineHeight: 18, paddingLeft: 4 },
    copyOrientBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.primarySoft, alignSelf: 'flex-start' },
    copyOrientText: { fontSize: 11, color: colors.primary, fontWeight: '600' },

    // Suggestions
    sugItem: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', paddingLeft: 4 },
    sugDng: { backgroundColor: colors.errorLight, borderRadius: 6, padding: 6 },
    sugTxt: { fontSize: 12, color: colors.primary, lineHeight: 18, flex: 1 },

    // Perguntas
    perguntaIntro: { fontSize: 11, color: colors.textMuted, lineHeight: 16, fontStyle: 'italic', marginBottom: 4 },
    perguntaCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 12, gap: 8, borderWidth: 1, borderColor: colors.border },
    perguntaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    perguntaNumCircle: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
    perguntaNum: { fontSize: 11, fontWeight: '700' },
    perguntaPrioBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    perguntaPrioDot: { width: 6, height: 6, borderRadius: 3 },
    perguntaPrioText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
    perguntaText: { fontSize: 13, color: colors.text, lineHeight: 20, fontWeight: '600', fontStyle: 'italic' },
    perguntaObj: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingLeft: 4 },
    perguntaObjText: { fontSize: 11, color: colors.primaryLight, lineHeight: 16, flex: 1 },
    perguntaHip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingLeft: 4, backgroundColor: colors.primarySoft, borderRadius: 6, padding: 6 },
    perguntaHipText: { fontSize: 11, color: colors.textSecondary, lineHeight: 16, flex: 1 },
    perguntaImpacto: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingLeft: 4, backgroundColor: colors.primarySoft, borderRadius: 6, padding: 6 },
    perguntaImpactoText: { fontSize: 11, color: colors.primaryLight, lineHeight: 16, flex: 1 },
    perguntaCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, backgroundColor: colors.primarySoft },
    perguntaCopyText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
    perguntaDisclaimer: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', paddingHorizontal: 4, marginTop: 4 },
    perguntaDisclaimerText: { fontSize: 10, color: colors.textMuted, lineHeight: 14, flex: 1 },

    // Lacunas
    lacunasBlock: { backgroundColor: colors.warningLight, borderRadius: 10, padding: 12, gap: 8, borderWidth: 1, borderColor: colors.warning + '50' },
    lacunaItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingLeft: 4 },
    lacunaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning, marginTop: 5 },
    lacunaText: { fontSize: 12, color: colors.warning, lineHeight: 18, flex: 1 },

    // Evidence
    evItem: { backgroundColor: colors.surfaceSecondary, borderRadius: 8, padding: 10, gap: 6, borderWidth: 1, borderColor: colors.border },
    evHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    evHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    evTitle: { fontSize: 12, fontWeight: '700', color: colors.text, lineHeight: 16, flex: 1 },
    evNivelBadge: { backgroundColor: colors.accent + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    evNivelText: { fontSize: 9, fontWeight: '700', color: colors.accent, letterSpacing: 0.3 },
    evConexao: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.accentSoft, borderRadius: 6, padding: 6 },
    evConexaoText: { fontSize: 11, color: colors.accent, lineHeight: 15, flex: 1, fontWeight: '600' },
    evRelevance: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.primarySoft, borderRadius: 6, padding: 6 },
    evRelevanceText: { fontSize: 11, color: colors.primary, lineHeight: 15, flex: 1 },
    evExcerpt: { borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: 8, marginLeft: 4 },
    evExcerptText: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 15 },
    evFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    evSource: { fontSize: 10, color: colors.textMuted, flex: 1 },
    evProviderBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
    evProviderText: { fontSize: 9, fontWeight: '600', color: colors.white },
    evIntro: { fontSize: 11, color: colors.textMuted, lineHeight: 16, marginBottom: 10 },
    evAbstractPreview: { fontSize: 11, color: colors.textSecondary, lineHeight: 16, flex: 1 },
    evEmptyCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 16, gap: 8, borderWidth: 1, borderColor: colors.border },
    evEmptyTitle: { fontSize: 13, fontWeight: '700', color: colors.primary },
    evEmptySub: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
    evPubMed: { backgroundColor: '#228B22' },
    evEuropePmc: { backgroundColor: '#3B82F6' },
    evSemantic: { backgroundColor: '#7C3AED' },
    evClinicalTrials: { backgroundColor: '#065F46' },
    evMotivo: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 4, marginTop: 2 },
    evMotivoText: { fontSize: 10, color: colors.textMuted, lineHeight: 14, flex: 1, fontStyle: 'italic' },

    // Empty
    emptyState: { alignItems: 'center', gap: 8, paddingVertical: 40 },
    emptyTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
    emptySub: { fontSize: 11, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },

    // Footer
    footer: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
    footerText: { fontSize: 10, color: colors.textMuted },
  });
}
