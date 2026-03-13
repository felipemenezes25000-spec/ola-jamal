/**
 * Referências públicas do SUS para uso interno — não requerem autorização.
 *
 * - SIGTAP: Tabela de procedimentos SUS (códigos + valores)
 * - CATMAT: Catálogo de medicamentos RENAME
 * - CNES: Validação de estabelecimentos
 * - CNS: Validação de Cartão Nacional de Saúde
 */

// ══════════════════════════════════════════════════════════════
// SIGTAP — Procedimentos mais comuns na APS
// Ref: http://sigtap.datasus.gov.br
// ══════════════════════════════════════════════════════════════

export interface SigtapProcedimento {
  codigo: string;
  nome: string;
  grupo: string;
  valor?: number; // valor SUS em R$
}

export const SIGTAP_APS: SigtapProcedimento[] = [
  // Consultas
  { codigo: '0301010064', nome: 'Consulta médica em atenção básica', grupo: 'Consultas', valor: 10.00 },
  { codigo: '0301010072', nome: 'Consulta de profissionais de nível superior na atenção básica', grupo: 'Consultas', valor: 6.30 },
  { codigo: '0301010080', nome: 'Consulta/atendimento domiciliar na atenção básica', grupo: 'Consultas', valor: 10.00 },
  { codigo: '0301010110', nome: 'Consulta pré-natal', grupo: 'Consultas', valor: 10.00 },
  { codigo: '0301010129', nome: 'Consulta puerperal', grupo: 'Consultas', valor: 10.00 },

  // Procedimentos de enfermagem
  { codigo: '0301060029', nome: 'Aferição de pressão arterial', grupo: 'Enfermagem', valor: 1.00 },
  { codigo: '0301060037', nome: 'Glicemia capilar', grupo: 'Enfermagem', valor: 1.00 },
  { codigo: '0301060045', nome: 'Administração de medicamentos via oral', grupo: 'Enfermagem', valor: 0.60 },
  { codigo: '0301060053', nome: 'Administração de medicamentos via IM', grupo: 'Enfermagem', valor: 1.00 },
  { codigo: '0301060061', nome: 'Curativo simples', grupo: 'Enfermagem', valor: 1.00 },
  { codigo: '0301060070', nome: 'Nebulização', grupo: 'Enfermagem', valor: 1.45 },
  { codigo: '0301060088', nome: 'Retirada de pontos', grupo: 'Enfermagem', valor: 1.00 },

  // Procedimentos médicos
  { codigo: '0301010196', nome: 'Atendimento de urgência em atenção básica', grupo: 'Médicos', valor: 10.00 },
  { codigo: '0301010200', nome: 'Teleconsulta na atenção primária', grupo: 'Médicos', valor: 10.00 },

  // Coleta e exames
  { codigo: '0201010569', nome: 'Hemograma completo', grupo: 'Exames', valor: 4.11 },
  { codigo: '0202010503', nome: 'Glicose', grupo: 'Exames', valor: 1.85 },
  { codigo: '0202010295', nome: 'Colesterol total', grupo: 'Exames', valor: 1.85 },
  { codigo: '0202010635', nome: 'Creatinina', grupo: 'Exames', valor: 1.85 },
  { codigo: '0202050017', nome: 'Urina tipo 1 (EAS)', grupo: 'Exames', valor: 3.70 },
  { codigo: '0202010678', nome: 'TSH', grupo: 'Exames', valor: 8.96 },
  { codigo: '0202010686', nome: 'T4 livre', grupo: 'Exames', valor: 11.60 },
  { codigo: '0202030300', nome: 'Teste rápido HIV', grupo: 'Exames', valor: 10.00 },

  // Vacinação
  { codigo: '0301060096', nome: 'Administração de vacina', grupo: 'Vacinação', valor: 4.35 },

  // Saúde bucal
  { codigo: '0301010137', nome: 'Consulta odontológica', grupo: 'Odontologia', valor: 8.00 },
  { codigo: '0307010015', nome: 'Restauração dentária', grupo: 'Odontologia', valor: 17.27 },
  { codigo: '0307020037', nome: 'Extração dentária simples', grupo: 'Odontologia', valor: 8.34 },
  { codigo: '0301010145', nome: 'Aplicação de flúor', grupo: 'Odontologia', valor: 3.12 },

  // Atividades coletivas
  { codigo: '0101010010', nome: 'Atividade educativa / orientação em grupo', grupo: 'Coletivas', valor: 1.50 },
  { codigo: '0101010028', nome: 'Prática corporal / atividade física em grupo', grupo: 'Coletivas', valor: 1.50 },
];

// ══════════════════════════════════════════════════════════════
// CATMAT — Medicamentos RENAME mais comuns na APS
// Ref: https://www.gov.br/saude/pt-br/composicao/sectics/daf
// ══════════════════════════════════════════════════════════════

export interface CatmatMedicamento {
  codigo: string;
  nome: string;
  forma: string;
  concentracao: string;
  grupo: string;
}

export const CATMAT_APS: CatmatMedicamento[] = [
  // Analgésicos
  { codigo: 'BR0267554', nome: 'Dipirona sódica', forma: 'Comprimido', concentracao: '500mg', grupo: 'Analgésicos' },
  { codigo: 'BR0272270', nome: 'Paracetamol', forma: 'Comprimido', concentracao: '500mg', grupo: 'Analgésicos' },
  { codigo: 'BR0271350', nome: 'Ibuprofeno', forma: 'Comprimido', concentracao: '600mg', grupo: 'Anti-inflamatórios' },
  { codigo: 'BR0264950', nome: 'AAS', forma: 'Comprimido', concentracao: '100mg', grupo: 'Analgésicos' },

  // Anti-hipertensivos
  { codigo: 'BR0271130', nome: 'Hidroclorotiazida', forma: 'Comprimido', concentracao: '25mg', grupo: 'Anti-hipertensivos' },
  { codigo: 'BR0268050', nome: 'Enalapril', forma: 'Comprimido', concentracao: '10mg', grupo: 'Anti-hipertensivos' },
  { codigo: 'BR0271932', nome: 'Losartana', forma: 'Comprimido', concentracao: '50mg', grupo: 'Anti-hipertensivos' },
  { codigo: 'BR0264563', nome: 'Anlodipino', forma: 'Comprimido', concentracao: '5mg', grupo: 'Anti-hipertensivos' },
  { codigo: 'BR0264725', nome: 'Atenolol', forma: 'Comprimido', concentracao: '50mg', grupo: 'Anti-hipertensivos' },

  // Antidiabéticos
  { codigo: 'BR0272060', nome: 'Metformina', forma: 'Comprimido', concentracao: '850mg', grupo: 'Antidiabéticos' },
  { codigo: 'BR0270220', nome: 'Glibenclamida', forma: 'Comprimido', concentracao: '5mg', grupo: 'Antidiabéticos' },
  { codigo: 'BR0271700', nome: 'Insulina NPH', forma: 'Injetável', concentracao: '100UI/mL', grupo: 'Antidiabéticos' },

  // Antibióticos
  { codigo: 'BR0264531', nome: 'Amoxicilina', forma: 'Cápsula', concentracao: '500mg', grupo: 'Antibióticos' },
  { codigo: 'BR0264870', nome: 'Azitromicina', forma: 'Comprimido', concentracao: '500mg', grupo: 'Antibióticos' },
  { codigo: 'BR0265950', nome: 'Cefalexina', forma: 'Cápsula', concentracao: '500mg', grupo: 'Antibióticos' },

  // Aparelho digestivo
  { codigo: 'BR0272250', nome: 'Omeprazol', forma: 'Cápsula', concentracao: '20mg', grupo: 'Digestivo' },

  // Sistema nervoso
  { codigo: 'BR0269860', nome: 'Fluoxetina', forma: 'Cápsula', concentracao: '20mg', grupo: 'Antidepressivos' },
  { codigo: 'BR0264530', nome: 'Amitriptilina', forma: 'Comprimido', concentracao: '25mg', grupo: 'Antidepressivos' },
  { codigo: 'BR0267600', nome: 'Diazepam', forma: 'Comprimido', concentracao: '5mg', grupo: 'Ansiolíticos' },

  // Respiratório
  { codigo: 'BR0273060', nome: 'Salbutamol', forma: 'Aerossol', concentracao: '100mcg/dose', grupo: 'Respiratório' },

  // Vitaminas
  { codigo: 'BR0273330', nome: 'Sulfato ferroso', forma: 'Comprimido', concentracao: '40mg Fe', grupo: 'Vitaminas' },
  { codigo: 'BR0264920', nome: 'Ácido fólico', forma: 'Comprimido', concentracao: '5mg', grupo: 'Vitaminas' },

  // Hormônios
  { codigo: 'BR0271838', nome: 'Anticoncepcional oral', forma: 'Comprimido', concentracao: '0,15mg+0,03mg', grupo: 'Contracepção' },
  { codigo: 'BR0271850', nome: 'Levotiroxina', forma: 'Comprimido', concentracao: '50mcg', grupo: 'Tireoide' },

  // Cardiovascular
  { codigo: 'BR0273230', nome: 'Sinvastatina', forma: 'Comprimido', concentracao: '20mg', grupo: 'Estatinas' },
  { codigo: 'BR0269950', nome: 'Furosemida', forma: 'Comprimido', concentracao: '40mg', grupo: 'Diuréticos' },
];

// ══════════════════════════════════════════════════════════════
// Funções de busca
// ══════════════════════════════════════════════════════════════

export function searchSigtap(query: string): SigtapProcedimento[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return SIGTAP_APS.filter(p =>
    p.nome.toLowerCase().includes(q) ||
    p.codigo.includes(q) ||
    p.grupo.toLowerCase().includes(q)
  ).slice(0, 10);
}

export function searchCatmat(query: string): CatmatMedicamento[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return CATMAT_APS.filter(m =>
    m.nome.toLowerCase().includes(q) ||
    m.codigo.includes(q) ||
    m.grupo.toLowerCase().includes(q)
  ).slice(0, 10);
}

/** Grupos únicos do SIGTAP */
export function getSigtapGrupos(): string[] {
  return [...new Set(SIGTAP_APS.map(p => p.grupo))];
}

/** Grupos únicos do CATMAT */
export function getCatmatGrupos(): string[] {
  return [...new Set(CATMAT_APS.map(m => m.grupo))];
}

// ══════════════════════════════════════════════════════════════
// Status das integrações SUS
// ══════════════════════════════════════════════════════════════

export interface SusIntegrationStatus {
  id: string;
  nome: string;
  descricao: string;
  status: 'ativo' | 'local' | 'pendente';
  tipo: 'consulta' | 'envio' | 'referencia';
  icone: string;
}

export const SUS_INTEGRATIONS: SusIntegrationStatus[] = [
  {
    id: 'ledi',
    nome: 'e-SUS APS (LEDI)',
    descricao: 'Exportação de fichas para o PEC municipal',
    status: 'ativo',
    tipo: 'envio',
    icone: 'cloud-upload-outline',
  },
  {
    id: 'rnds',
    nome: 'RNDS (FHIR R4)',
    descricao: 'Rede Nacional de Dados em Saúde',
    status: 'ativo',
    tipo: 'envio',
    icone: 'globe-outline',
  },
  {
    id: 'cns',
    nome: 'CNS — Validação',
    descricao: 'Algoritmo oficial de validação do Cartão Nacional de Saúde',
    status: 'local',
    tipo: 'referencia',
    icone: 'card-outline',
  },
  {
    id: 'cnes',
    nome: 'CNES — Referência',
    descricao: 'Códigos de estabelecimentos de saúde',
    status: 'local',
    tipo: 'referencia',
    icone: 'business-outline',
  },
  {
    id: 'sigtap',
    nome: 'SIGTAP — Procedimentos',
    descricao: 'Tabela de procedimentos SUS com códigos e valores',
    status: 'local',
    tipo: 'referencia',
    icone: 'list-outline',
  },
  {
    id: 'catmat',
    nome: 'CATMAT / RENAME',
    descricao: 'Catálogo de medicamentos essenciais do SUS',
    status: 'local',
    tipo: 'referencia',
    icone: 'medical-outline',
  },
];

export const INTEGRATION_STATUS_MAP = {
  ativo: { label: 'Ativo', color: '#16A34A', bg: '#DCFCE7' },
  local: { label: 'Integrado', color: '#3B82F6', bg: '#E0F2FE' },
  pendente: { label: 'Pendente', color: '#F59E0B', bg: '#FEF3C7' },
} as const;
