/**
 * Anamnese Estruturada — Fonte única de verdade.
 *
 * Tipos, parser, campos unificados e helpers usados por:
 * - DoctorAIPanel (consulta em tempo real)
 * - ConsultationPostSection (detalhe do pedido)
 * - consultation-summary (pós-consulta)
 * - Prontuário do paciente (histórico)
 */

import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ── Tipos da anamnese IA ──

export interface MedicamentoSugerido {
  nome?: string;
  classe_terapeutica?: string;
  dose?: string;
  via?: string;
  posologia?: string;
  duracao?: string;
  indicacao?: string;
  contraindicacoes?: string;
  interacoes?: string;
  alerta_faixa_etaria?: string;
  alternativa?: string;
}

export interface ExameSugerido {
  nome?: string;
  descricao?: string;
  codigo_tuss?: string;
  o_que_afere?: string;
  indicacao?: string;
  urgencia?: string;
}

export interface DiagnosticoDiferencial {
  hipotese?: string;
  cid?: string;
  probabilidade?: string;
  probabilidade_percentual?: number;
}

export interface AnamnesisData {
  queixa_principal?: string;
  historia_doenca_atual?: string;
  sintomas?: string | string[];
  revisao_sistemas?: string;
  medicamentos_em_uso?: string | string[];
  alergias?: string | string[];
  antecedentes_pessoais?: string;
  antecedentes_familiares?: string;
  antecedentes_relevantes?: string;
  habitos_vida?: string;
  outros?: string;

  denominador_comum?: string;
  classificacao_gravidade?: 'verde' | 'amarelo' | 'laranja' | 'vermelho';
  alertas_vermelhos?: string[];
  diagnostico_diferencial?: DiagnosticoDiferencial[] | string[];
  exame_fisico_dirigido?: string | string[];
  medicamentos_sugeridos?: (MedicamentoSugerido | string)[];
  exames_sugeridos?: (ExameSugerido | string)[];
  interacoes_cruzadas?: string | string[];
  orientacoes_paciente?: string[];
  criterios_retorno?: string | string[];
  perguntas_sugeridas?: string[];
  lacunas_anamnese?: string[];
  encaminhamento_sugerido?: {
    profissional?: string;
    medico?: string;
    especialidade?: string;
    motivo?: string;
    reason?: string;
    indication?: string;
  };
}

// ── Severidade semântica de cada campo ──

export type FieldSeverity = 'neutral' | 'warning' | 'danger' | 'success' | 'info';

export interface AnaFieldDef {
  key: keyof AnamnesisData;
  label: string;
  icon: IoniconName;
  severity: FieldSeverity;
}

/**
 * Campos principais da anamnese — lista unificada.
 * 10 campos que cobrem a anamnese médica completa (OPQRST + sistemas).
 */
export const ANA_FIELDS: AnaFieldDef[] = [
  { key: 'queixa_principal', label: 'Queixa Principal', icon: 'chatbubble-ellipses', severity: 'neutral' },
  { key: 'historia_doenca_atual', label: 'História da Doença Atual', icon: 'time', severity: 'neutral' },
  { key: 'sintomas', label: 'Sintomas', icon: 'thermometer', severity: 'warning' },
  { key: 'revisao_sistemas', label: 'Revisão de Sistemas', icon: 'body', severity: 'neutral' },
  { key: 'medicamentos_em_uso', label: 'Medicamentos em Uso', icon: 'medical', severity: 'info' },
  { key: 'alergias', label: 'Alergias', icon: 'warning', severity: 'danger' },
  { key: 'antecedentes_pessoais', label: 'Antecedentes Pessoais', icon: 'document-text', severity: 'neutral' },
  { key: 'antecedentes_familiares', label: 'Antecedentes Familiares', icon: 'people', severity: 'neutral' },
  { key: 'habitos_vida', label: 'Hábitos de Vida', icon: 'fitness', severity: 'neutral' },
  { key: 'outros', label: 'Outras Informações', icon: 'ellipsis-horizontal', severity: 'neutral' },
];

/**
 * Subset compacto para exibições resumidas (ex.: card de consulta no prontuário).
 */
export const ANA_FIELDS_COMPACT: AnaFieldDef[] = [
  { key: 'queixa_principal', label: 'Queixa Principal', icon: 'chatbubble-ellipses', severity: 'neutral' },
  { key: 'historia_doenca_atual', label: 'História da Doença Atual', icon: 'time', severity: 'neutral' },
  { key: 'sintomas', label: 'Sintomas', icon: 'thermometer', severity: 'warning' },
  { key: 'medicamentos_em_uso', label: 'Medicamentos em Uso', icon: 'medical', severity: 'info' },
  { key: 'alergias', label: 'Alergias', icon: 'warning', severity: 'danger' },
  { key: 'outros', label: 'Outras Informações', icon: 'ellipsis-horizontal', severity: 'neutral' },
];

// ── Helpers de parse ──

export function parseAnamnesis(json: string | null | undefined): AnamnesisData | null {
  if (!json || !json.trim()) return null;
  try {
    const obj = JSON.parse(json);
    if (typeof obj !== 'object' || obj === null) return null;
    return obj as AnamnesisData;
  } catch {
    return null;
  }
}

export function parseSuggestions(json: string | null | undefined): string[] {
  if (!json || !json.trim()) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export interface EvidenceItem {
  provider?: string;
  url?: string;
  title?: string;
  source?: string;
  clinicalRelevance?: string;
}

export function parseEvidence(json: string | null | undefined): EvidenceItem[] {
  if (!json || !json.trim()) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// ── Extração de dados ──

export function extractAllergies(data: AnamnesisData | null): string[] {
  if (!data?.alergias) return [];
  if (Array.isArray(data.alergias)) return data.alergias.filter(Boolean);
  const str = data.alergias.trim();
  if (!str || str.toLowerCase() === 'nkda' || str.toLowerCase() === 'nenhuma') return [];
  return str.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

export function extractCid(data: AnamnesisData | null): string | null {
  if (!data) return null;
  // Extract from first diagnostico_diferencial item if available
  const dd = data.diagnostico_diferencial;
  if (Array.isArray(dd) && dd.length > 0) {
    const first = dd[0];
    if (typeof first === 'object' && first !== null && 'cid' in first) {
      const cid = (first as DiagnosticoDiferencial).cid;
      if (typeof cid === 'string' && cid.trim().length > 0) return cid.trim();
    }
  }
  return null;
}

export function extractCidFromJson(json: string | null | undefined): string | null {
  return extractCid(parseAnamnesis(json));
}

export function extractAllergiesFromJson(json: string | null | undefined): string[] {
  return extractAllergies(parseAnamnesis(json));
}

// ── Display helpers ──

export function displayFieldValue(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === 'string') return val.trim() || null;
  if (Array.isArray(val)) {
    const items = val.map((v) => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object') return displayObjectSummary(v as Record<string, unknown>);
      return String(v);
    }).filter(Boolean);
    return items.length > 0 ? items.join('; ') : null;
  }
  if (typeof val === 'object') return displayObjectSummary(val as Record<string, unknown>);
  return String(val);
}

/**
 * Extrai uma representação legível de um objeto genérico da anamnese.
 * Prioriza campos descritivos conhecidos (hipotese, pergunta, nome, descricao, etc).
 */
function displayObjectSummary(obj: Record<string, unknown>): string {
  if (!obj) return '';
  // Diagnóstico diferencial
  if ('hipotese' in obj) {
    const parts = [obj.hipotese, obj.cid ? `(${obj.cid})` : null, obj.probabilidade ? `— ${obj.probabilidade}` : null].filter(Boolean);
    return parts.join(' ');
  }
  // Pergunta sugerida
  if ('pergunta' in obj) {
    const p = String(obj.pergunta);
    return obj.objetivo ? `${p} (${obj.objetivo})` : p;
  }
  // Interação cruzada
  if ('medicamento_a' in obj && 'medicamento_b' in obj) {
    return `${obj.medicamento_a} × ${obj.medicamento_b}: ${obj.descricao ?? obj.tipo ?? ''}`.trim();
  }
  // Medicamento
  if ('nome' in obj) {
    const parts = [obj.nome, obj.dose, obj.posologia].filter(Boolean);
    return parts.join(' ');
  }
  // Fallback: pegar os valores mais relevantes
  const keys = ['name', 'title', 'description', 'text', 'label', 'value'];
  for (const k of keys) {
    if (obj[k] && typeof obj[k] === 'string') return obj[k] as string;
  }
  // Último fallback: valores não-nulos concatenados
  const vals = Object.values(obj).filter(v => v != null && typeof v !== 'object').map(String).filter(Boolean);
  return vals.slice(0, 3).join(' — ');
}

export function displayMedicamento(m: MedicamentoSugerido | string): string {
  if (typeof m === 'string') return m;
  const parts = [m.nome, m.dose, m.via, m.posologia, m.duracao].filter(Boolean);
  const base = parts.join(' ');
  return m.indicacao ? `${base} (${m.indicacao})` : base;
}

export function displayExame(e: ExameSugerido | string): string {
  if (typeof e === 'string') return e;
  return e.nome ?? '';
}

/**
 * Resolve antecedentes unificados: prioriza pessoais+familiares separados,
 * falls back para 'antecedentes_relevantes' (campo legacy).
 */
export function getAntecedentes(data: AnamnesisData): {
  pessoais: string | null;
  familiares: string | null;
} {
  const pessoais = data.antecedentes_pessoais?.trim() || data.antecedentes_relevantes?.trim() || null;
  const familiares = data.antecedentes_familiares?.trim() || null;
  return { pessoais, familiares };
}

/**
 * Gera texto copiável da anamnese completa.
 */
export function anamnesisToText(data: AnamnesisData, fields: AnaFieldDef[] = ANA_FIELDS): string {
  const lines: string[] = [];

  for (const { key, label } of fields) {
    const val = data[key];
    const display = displayFieldValue(val);
    if (display) lines.push(`${label}: ${display}`);
  }

  if (data.alertas_vermelhos?.length) {
    lines.push('');
    data.alertas_vermelhos.forEach((a) => lines.push(`ALERTA: ${a}`));
  }

  if (data.medicamentos_sugeridos?.length) {
    lines.push('');
    lines.push('Medicamentos Sugeridos:');
    data.medicamentos_sugeridos.forEach((m, i) => {
      lines.push(`${i + 1}. ${displayMedicamento(m)}`);
    });
  }

  if (data.exames_sugeridos?.length) {
    lines.push('');
    lines.push('Exames Sugeridos:');
    data.exames_sugeridos.forEach((e, i) => {
      lines.push(`${i + 1}. ${displayExame(e)}`);
    });
  }

  return lines.join('\n');
}
