/**
 * ai-panel/types.ts — Shared types for DoctorAIPanel (web).
 * Aligned with mobile ai-panel for parity.
 */

export type MedSugerido =
  | string
  | {
      nome: string;
      classe_terapeutica?: string;
      dose?: string;
      via?: string;
      posologia?: string;
      duracao?: string;
      indicacao?: string;
      melhora_esperada?: string;
      contraindicacoes?: string;
      interacoes?: string;
      mecanismo_acao?: string;
      ajuste_renal?: string;
      ajuste_hepatico?: string;
      alerta_faixa_etaria?: string;
      alternativa?: string;
    };

export type ExameSugerido =
  | string
  | {
      nome: string;
      codigo_tuss?: string;
      descricao?: string;
      o_que_afere?: string;
      indicacao?: string;
      interpretacao_esperada?: string;
      preparo_paciente?: string;
      prazo_resultado?: string;
      urgencia?: string;
    };

export type DiagDiferencial = {
  hipotese: string;
  cid: string;
  probabilidade: string;
  argumentos_a_favor?: string;
  argumentos_contra?: string;
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
  title?: string;
  abstract?: string;
  source?: string;
  translatedAbstract?: string;
  relevantExcerpts?: string[];
  clinicalRelevance?: string;
  provider?: string;
  url?: string;
  conexaoComPaciente?: string;
  nivelEvidencia?: string;
  motivoSelecao?: string;
};

export interface DoctorAIPanelProps {
  anamnesis: Record<string, unknown> | null;
  suggestions: (string | { text?: string; suggestion?: string })[];
  evidence: EvidenceItem[];
}

export type TabKey = 'consulta' | 'perguntas' | 'historico' | 'evidencias';

export const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'consulta', label: 'Consulta', icon: 'document-text' },
  { key: 'perguntas', label: 'Perguntas', icon: 'help-circle' },
  { key: 'historico', label: 'Sugestões', icon: 'bulb' },
  { key: 'evidencias', label: 'Evidências', icon: 'library' },
];

export const ANA_FIELDS: { key: string; label: string; icon: string }[] = [
  { key: 'queixa_principal', label: 'Queixa Principal', icon: 'chatbubble' },
  { key: 'historia_doenca_atual', label: 'História da Doença Atual', icon: 'time' },
  { key: 'sintomas', label: 'Sintomas', icon: 'thermometer' },
  { key: 'revisao_sistemas', label: 'Revisão de Sistemas', icon: 'body' },
  { key: 'medicamentos_em_uso', label: 'Medicamentos em Uso', icon: 'medical' },
  { key: 'alergias', label: 'Alergias', icon: 'warning' },
  { key: 'antecedentes_pessoais', label: 'Antecedentes Pessoais', icon: 'document' },
  { key: 'antecedentes_familiares', label: 'Antecedentes Familiares', icon: 'people' },
  { key: 'habitos_vida', label: 'Hábitos de Vida', icon: 'fitness' },
  { key: 'outros', label: 'Outras Informações', icon: 'ellipsis' },
];

export function getGravityConfig(): Record<string, { color: string; label: string; icon: string }> {
  return {
    verde: { color: 'text-emerald-500', label: 'Não Urgente', icon: 'shield-check' },
    amarelo: { color: 'text-amber-500', label: 'Pouco Urgente', icon: 'alert-circle' },
    laranja: { color: 'text-orange-500', label: 'Urgente', icon: 'alert-triangle' },
    vermelho: { color: 'text-red-500', label: 'Emergência', icon: 'x-circle' },
  };
}

export function getConfidenceConfig(): Record<string, { color: string; label: string }> {
  return {
    alta: { color: 'text-emerald-500', label: 'Confiança Alta' },
    media: { color: 'text-amber-500', label: 'Confiança Média' },
    baixa: { color: 'text-red-500', label: 'Confiança Baixa' },
  };
}

export function parseMed(m: MedSugerido): Record<string, string> {
  if (typeof m === 'string') {
    return {
      nome: m,
      classe_terapeutica: '',
      dose: '',
      via: '',
      posologia: '',
      duracao: '',
      indicacao: '',
      contraindicacoes: '',
      interacoes: '',
      alerta_faixa_etaria: '',
      alternativa: '',
    };
  }
  return m as Record<string, string>;
}

export function parseExam(ex: ExameSugerido): Record<string, string> {
  if (typeof ex === 'string') {
    return {
      nome: ex,
      codigo_tuss: '',
      descricao: '',
      o_que_afere: '',
      indicacao: '',
      preparo_paciente: '',
      prazo_resultado: '',
      urgencia: 'rotina',
    };
  }
  return ex as Record<string, string>;
}
