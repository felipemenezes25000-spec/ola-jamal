/**
 * Pacotes de protocolo por CID-10 para pré-preenchimento pós-consulta.
 * Fonte: protocolos clínicos MS / RENAME / CFM.
 * A IA da consulta sobrescreve com sugestões específicas ao paciente;
 * estes pacotes servem como fallback e seleção manual pelo médico.
 */

import type { CidPackage } from '../../types/postConsultation';

export const CID_PACKAGES: Record<string, CidPackage> = {
  J11: {
    code: 'J11',
    name: 'Gripe (Influenza)',
    defaultLeaveDays: 3,
    defaultCertificateBody: 'Paciente apresenta síndrome gripal com febre, necessitando repouso domiciliar.',
    medications: [
      { drug: 'Dipirona 500mg', posology: 'VO 6/6h por 5 dias', indication: 'Febre e dor' },
      { drug: 'Loratadina 10mg', posology: 'VO 1x/dia por 7 dias', indication: 'Congestão nasal' },
      { drug: 'Oseltamivir 75mg', posology: 'VO 12/12h por 5 dias', indication: 'Antiviral (se <48h)' },
    ],
    exams: ['Hemograma completo', 'PCR (proteína C reativa)', 'VHS'],
    examJustification: 'Investigação de quadro gripal febril.',
  },
  J06: {
    code: 'J06',
    name: 'IVAS (Resfriado)',
    defaultLeaveDays: 2,
    defaultCertificateBody: 'Infecção aguda de vias aéreas superiores, necessitando repouso.',
    medications: [
      { drug: 'Paracetamol 750mg', posology: 'VO 6/6h SOS', indication: 'Febre e dor' },
      { drug: 'Cloreto de sódio 0,9% nasal', posology: '3 gotas cada narina 4x/dia', indication: 'Lavagem nasal' },
      { drug: 'Loratadina 10mg', posology: 'VO 1x/dia por 5 dias', indication: 'Congestão' },
    ],
    exams: ['Hemograma completo'],
    examJustification: 'Quadro clínico compatível com IVAS viral.',
  },
  I10: {
    code: 'I10',
    name: 'Hipertensão arterial',
    defaultLeaveDays: 0,
    defaultCertificateBody: '',
    medications: [
      { drug: 'Losartana 50mg', posology: 'VO 1x/dia contínuo', indication: 'BRA — anti-hipertensivo' },
      { drug: 'Hidroclorotiazida 25mg', posology: 'VO 1x/dia contínuo', indication: 'Diurético' },
      { drug: 'Anlodipino 5mg', posology: 'VO 1x/dia contínuo', indication: 'Bloqueador canal de cálcio' },
    ],
    exams: [
      'Creatinina', 'Ureia', 'Sódio e potássio', 'Perfil lipídico completo',
      'Glicemia de jejum', 'HbA1c', 'Ácido úrico', 'Urina tipo I',
      'ECG (eletrocardiograma)', 'Microalbuminúria',
    ],
    examJustification: 'Avaliação laboratorial para acompanhamento de hipertensão arterial.',
  },
  E11: {
    code: 'E11',
    name: 'Diabetes mellitus tipo 2',
    defaultLeaveDays: 0,
    defaultCertificateBody: '',
    medications: [
      { drug: 'Metformina 850mg', posology: 'VO 2x/dia contínuo', indication: '1ª linha DM2' },
      { drug: 'Glicazida 60mg', posology: 'VO 1x/dia contínuo', indication: 'Sulfonilureia' },
    ],
    exams: [
      'Glicemia de jejum', 'Hemoglobina glicada (HbA1c)', 'Perfil lipídico completo',
      'Creatinina', 'Ureia', 'Microalbuminúria', 'Potássio', 'Sódio',
      'TGO/TGP', 'Urina tipo I', 'Fundo de olho',
    ],
    examJustification: 'Controle metabólico e rastreio de complicações DM2.',
  },
  F32: {
    code: 'F32',
    name: 'Episódio depressivo',
    defaultLeaveDays: 5,
    defaultCertificateBody: 'Paciente em tratamento de episódio depressivo, necessitando afastamento para estabilização clínica.',
    medications: [
      { drug: 'Sertralina 50mg', posology: 'VO 1x/dia manhã contínuo', indication: 'ISRS' },
      { drug: 'Clonazepam 0,5mg', posology: 'VO à noite SOS por 14 dias', indication: 'Ansiedade/insônia' },
    ],
    exams: [
      'TSH', 'T4 livre', 'Hemograma completo', 'Glicemia de jejum',
      'Vitamina D (25-OH)', 'Vitamina B12', 'Ferro sérico', 'Ferritina',
    ],
    examJustification: 'Avaliação complementar para diagnóstico diferencial de episódio depressivo.',
  },
  M54: {
    code: 'M54',
    name: 'Dorsalgia (Dor lombar)',
    defaultLeaveDays: 3,
    defaultCertificateBody: 'Dorsalgia aguda limitando atividades habituais, necessitando repouso relativo.',
    medications: [
      { drug: 'Ibuprofeno 600mg', posology: 'VO 8/8h por 5 dias (após refeição)', indication: 'Anti-inflamatório' },
      { drug: 'Ciclobenzaprina 5mg', posology: 'VO à noite por 7 dias', indication: 'Relaxante muscular' },
      { drug: 'Dipirona 1g', posology: 'VO 6/6h SOS', indication: 'Dor intensa' },
    ],
    exams: ['Hemograma completo', 'PCR', 'VHS', 'Rx coluna lombar AP e perfil'],
    examJustification: 'Investigação de dorsalgia aguda. Descartar causas inflamatórias ou estruturais.',
  },
  N39: {
    code: 'N39',
    name: 'Infecção urinária',
    defaultLeaveDays: 2,
    defaultCertificateBody: 'Infecção urinária em tratamento antibiótico.',
    medications: [
      { drug: 'Norfloxacino 400mg', posology: 'VO 12/12h por 7 dias', indication: 'Antibiótico' },
      { drug: 'Fenazopiridina 200mg', posology: 'VO 8/8h por 3 dias', indication: 'Analgesia urinária' },
    ],
    exams: ['Urina tipo I (EAS)', 'Urocultura com antibiograma', 'Creatinina', 'Hemograma completo'],
    examJustification: 'Confirmação e acompanhamento de infecção urinária.',
  },
  K21: {
    code: 'K21',
    name: 'Refluxo gastroesofágico',
    defaultLeaveDays: 0,
    defaultCertificateBody: '',
    medications: [
      { drug: 'Omeprazol 20mg', posology: 'VO 1x/dia em jejum por 30 dias', indication: 'IBP' },
      { drug: 'Domperidona 10mg', posology: 'VO 3x/dia antes refeições por 14 dias', indication: 'Procinético' },
    ],
    exams: ['Hemograma completo', 'H. pylori (sorologia ou teste respiratório)'],
    examJustification: 'Investigação de DRGE. Pesquisa de H. pylori.',
  },
  J45: {
    code: 'J45',
    name: 'Asma',
    defaultLeaveDays: 2,
    defaultCertificateBody: 'Crise asmática leve necessitando repouso e tratamento domiciliar.',
    medications: [
      { drug: 'Salbutamol spray 100mcg', posology: '2 jatos 4/4h SOS', indication: 'Broncodilatador resgate' },
      { drug: 'Budesonida 200mcg', posology: '2 jatos 12/12h contínuo', indication: 'Corticoide inalatório' },
      { drug: 'Prednisolona 20mg', posology: 'VO 1x/dia por 5 dias', indication: 'Crise' },
    ],
    exams: ['Hemograma completo', 'IgE total', 'Rx tórax PA e perfil', 'Espirometria'],
    examJustification: 'Avaliação de crise asmática. Espirometria para estadiamento.',
  },
};

/** Pacotes de exames extras (não vinculados a CID específico). */
export interface ExamPackage {
  key: string;
  name: string;
  exams: string[];
  justification: string;
}

export const EXAM_PACKAGES: ExamPackage[] = [
  {
    key: 'checkup',
    name: 'Check-up completo',
    exams: [
      'Hemograma completo', 'Glicemia de jejum', 'Hemoglobina glicada (HbA1c)',
      'Colesterol total e frações (HDL, LDL, VLDL)', 'Triglicerídeos',
      'TGO (AST)', 'TGP (ALT)', 'Gama GT (GGT)', 'Bilirrubinas (total, direta, indireta)',
      'Ureia', 'Creatinina', 'Ácido úrico',
      'TSH', 'T4 livre', 'Vitamina D (25-OH)', 'Vitamina B12',
      'Ferro sérico', 'Ferritina', 'PCR (proteína C reativa)', 'VHS',
      'Sódio, potássio, cálcio', 'Urina tipo I (EAS)', 'Parasitológico de fezes',
    ],
    justification: 'Check-up laboratorial de rotina preventiva.',
  },
  {
    key: 'ist',
    name: 'IST / Sorologias',
    exams: [
      'VDRL (sífilis)', 'Anti-HIV 1 e 2', 'HBsAg (hepatite B)',
      'Anti-HCV (hepatite C)', 'Anti-HBs (imunidade hepatite B)',
      'Toxoplasmose IgG/IgM', 'CMV IgG/IgM', 'Rubéola IgG/IgM',
    ],
    justification: 'Rastreamento completo de ISTs e sorologias.',
  },
  {
    key: 'prenatal',
    name: 'Pré-natal',
    exams: [
      'Hemograma completo', 'Tipagem sanguínea (ABO/Rh)', 'Coombs indireto',
      'Glicemia de jejum', 'TOTG 75g', 'VDRL', 'Anti-HIV', 'HBsAg', 'Anti-HCV',
      'Toxoplasmose IgG/IgM', 'Rubéola IgG/IgM', 'CMV IgG/IgM',
      'TSH', 'T4 livre', 'Urina tipo I', 'Urocultura', 'Parasitológico de fezes',
    ],
    justification: 'Rotina pré-natal conforme protocolos ministeriais.',
  },
  {
    key: 'cardiovascular',
    name: 'Risco cardiovascular',
    exams: [
      'Perfil lipídico completo', 'Glicemia de jejum', 'HbA1c',
      'PCR ultrassensível', 'Homocisteína', 'Lipoproteína(a)',
      'CPK total', 'Troponina', 'BNP ou NT-proBNP', 'Ácido úrico', 'Sódio e potássio',
    ],
    justification: 'Avaliação de risco cardiovascular e marcadores cardíacos.',
  },
  {
    key: 'renal',
    name: 'Função renal',
    exams: [
      'Creatinina', 'Ureia', 'Ácido úrico', 'Sódio', 'Potássio',
      'Cálcio', 'Fósforo', 'TFG estimada', 'Urina tipo I',
      'Microalbuminúria', 'Proteinúria 24h',
    ],
    justification: 'Avaliação completa da função renal e eletrólitos.',
  },
  {
    key: 'hepatico',
    name: 'Perfil hepático',
    exams: [
      'TGO (AST)', 'TGP (ALT)', 'Gama GT (GGT)', 'Fosfatase alcalina',
      'Bilirrubinas (total, direta, indireta)', 'Albumina',
      'Proteínas totais e frações', 'TAP/INR', 'LDH',
    ],
    justification: 'Perfil hepático completo — avaliação de função e integridade do fígado.',
  },
  {
    key: 'tireoide',
    name: 'Tireoide',
    exams: ['TSH', 'T4 livre', 'T3 total', 'Anti-TPO', 'Anti-tireoglobulina'],
    justification: 'Avaliação de função tireoidiana e pesquisa de autoimunidade.',
  },
];

/** Retorna o CID package ou undefined se não encontrar. */
export function getCidPackage(code: string): CidPackage | undefined {
  return CID_PACKAGES[code.toUpperCase()];
}

/** Lista todos os CIDs disponíveis (para o picker). */
export function getAllCidCodes(): { code: string; name: string }[] {
  return Object.values(CID_PACKAGES).map((p) => ({ code: p.code, name: p.name }));
}
