/**
 * Tipos para o painel de IA da videoconsulta.
 * Estrutura do JSON de anamnesis (AnamnesisUpdate via SignalR).
 */

export interface DiagDiferencial {
  cid: string;
  descricao: string;
  probabilidade: string;
  hipotese?: string;
}

export interface MedicamentoSugerido {
  nome: string;
  dose?: string;
  via?: string;
  frequencia?: string;
  duracao?: string;
  observacoes?: string;
  posologia?: string;
}

export interface ExameSugerido {
  nome: string;
  justificativa?: string;
  urgencia?: string;
}

export interface InteracaoCruzada {
  medicamentos: string[];
  medicamento_a?: string;
  medicamento_b?: string;
  tipo: string;
  gravidade?: string;
  descricao: string;
  conduta?: string;
}

export interface ParsedAnamnesisAi {
  classificacao_gravidade?: string;
  diagnostico_diferencial?: DiagDiferencial[];
  medicamentos_sugeridos?: MedicamentoSugerido[];
  exames_sugeridos?: ExameSugerido[];
  interacoes_cruzadas?: InteracaoCruzada[];
  perguntas_sugeridas?: string[];
  red_flags?: string[];
}
