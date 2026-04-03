import type { RequestResponseDto } from '../../types/database';
import { normalizeRequestStatus } from './requestUiModel';

export type NextActionIntent = 'pay' | 'download' | 'track' | 'wait' | 'support' | 'none';

export interface NextBestAction {
  title: string;
  statusSummary: string;
  whatToDo: string;
  eta: string;
  ctaLabel?: string;
  intent: NextActionIntent;
}

export interface CompletenessItem {
  id: string;
  label: string;
  required: boolean;
  done: boolean;
}

export interface CompletenessResult {
  score: number;
  doneCount: number;
  totalCount: number;
  items: CompletenessItem[];
  missingRequired: CompletenessItem[];
}

export interface RedFlagResult {
  isUrgent: boolean;
  matchedSignals: string[];
  guidance: string;
  category: 'physical' | 'psychological' | null;
}

/** Converte resultado local para o formato da API (fallback quando API falha). */
export function toAssistantCompleteApiShape(
  completeness: CompletenessResult,
  redFlags?: RedFlagResult
): {
  score: number;
  doneCount: number;
  totalCount: number;
  missingFields: string[];
  checks: CompletenessItem[];
  hasUrgencyRisk: boolean;
  urgencySignals: string[];
  urgencyMessage: string | null;
} {
  return {
    score: completeness.score,
    doneCount: completeness.doneCount,
    totalCount: completeness.totalCount,
    missingFields: completeness.missingRequired.map((i) => i.id),
    checks: completeness.items,
    hasUrgencyRisk: redFlags?.isUrgent ?? false,
    urgencySignals: redFlags?.matchedSignals ?? [],
    urgencyMessage: redFlags?.isUrgent ? redFlags.guidance : null,
  };
}

function calculateCompleteness(items: CompletenessItem[]): CompletenessResult {
  const totalWeight = items.reduce((acc, item) => acc + (item.required ? 2 : 1), 0);
  const completedWeight = items.reduce((acc, item) => acc + (item.done ? (item.required ? 2 : 1) : 0), 0);
  const missingRequired = items.filter((item) => item.required && !item.done);
  const doneCount = items.filter((item) => item.done).length;
  const totalCount = items.length;
  const score = totalWeight === 0 ? 0 : Math.round((completedWeight / totalWeight) * 100);

  return {
    score,
    doneCount,
    totalCount,
    items,
    missingRequired,
  };
}

export function evaluatePrescriptionCompleteness(input: {
  prescriptionType?: string | null;
  imagesCount: number;
}): CompletenessResult {
  const items: CompletenessItem[] = [
    { id: 'prescription_type', label: 'Selecionar o tipo de receita', required: true, done: !!input.prescriptionType },
    { id: 'main_photo', label: 'Anexar ao menos 1 foto legível', required: true, done: input.imagesCount > 0 },
    { id: 'extra_photo', label: 'Adicionar 2a foto para aumentar legibilidade', required: false, done: input.imagesCount > 1 },
  ];

  return calculateCompleteness(items);
}

export function evaluateExamCompleteness(input: {
  examType?: string | null;
  examsCount: number;
  symptoms: string;
  imagesCount: number;
}): CompletenessResult {
  const symptomLength = input.symptoms.trim().length;
  const hasClinicalContext = symptomLength >= 10;
  const hasExamDescription = input.examsCount > 0 || input.imagesCount > 0;
  const items: CompletenessItem[] = [
    { id: 'exam_type', label: 'Selecionar o tipo de exame', required: true, done: !!input.examType },
    { id: 'exam_or_image', label: 'Informar exame desejado ou anexar pedido', required: true, done: hasExamDescription },
    { id: 'symptoms', label: 'Descrever sintomas/indicação clínica', required: true, done: hasClinicalContext },
    { id: 'detailed_symptoms', label: 'Adicionar contexto detalhado (40+ caracteres)', required: false, done: symptomLength >= 40 },
  ];

  return calculateCompleteness(items);
}

export function evaluateConsultationCompleteness(input: {
  consultationType?: string | null;
  durationMinutes: number;
  symptoms: string;
}): CompletenessResult {
  const symptomLength = input.symptoms.trim().length;
  const items: CompletenessItem[] = [
    { id: 'professional_type', label: 'Escolher o profissional', required: true, done: !!input.consultationType },
    { id: 'main_reason', label: 'Descrever sintomas ou dúvida principal', required: true, done: symptomLength >= 10 },
    { id: 'details', label: 'Adicionar detalhes (quando começou, frequência, intensidade)', required: false, done: symptomLength >= 40 },
  ];

  return calculateCompleteness(items);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export type EmergencyCategory = 'physical' | 'psychological';

interface RedFlagRule {
  keyword: string;
  patterns: RegExp[];
  category: EmergencyCategory;
}

const RED_FLAG_RULES: RedFlagRule[] = [
  // ── Emergências físicas ──
  { keyword: 'dor no peito', category: 'physical', patterns: [/\bdor no peito\b/, /\bpressao no peito\b/, /\bdor no cora(c|ç)(a|ã)o\b/] },
  { keyword: 'taquicardia', category: 'physical', patterns: [/\btaquicardia\b/, /\bcora(c|ç)(a|ã)o acelerado\b/, /\bcora(c|ç)(a|ã)o disparado\b/] },
  { keyword: 'falta de ar', category: 'physical', patterns: [/\bfalta de ar\b/, /\bn(a|ã)o consigo respirar\b/, /\bdificuldade para respirar\b/, /\bfalta de ar intensa\b/] },
  { keyword: 'desmaio', category: 'physical', patterns: [/\bdesmaio\b/, /\bdesmaiei\b/, /\bvou desmaiar\b/] },
  { keyword: 'confusao mental', category: 'physical', patterns: [/\bconfus(a|ã)o mental\b/, /\bestou confuso\b/, /\bdesorienta(c|ç)(a|ã)o\b/] },
  { keyword: 'sinais neurologicos', category: 'physical', patterns: [/\bfraqueza de um lado\b/, /\brosto torto\b/, /\bfala enrolada\b/, /\bconvuls(a|ã)o\b/] },
  { keyword: 'sangramento intenso', category: 'physical', patterns: [/\bsangramento intenso\b/, /\bsangue em grande quantidade\b/] },
  { keyword: 'sinais de AVC/derrame', category: 'physical', patterns: [/\bavc\b/, /\bderrame\b/, /\bparalisia subit/, /\bdor de cabe(c|ç)a subit/, /\bperda de vis(a|ã)o\b/] },
  // ── Crise psicológica / risco de suicídio ──
  { keyword: 'risco de suicidio', category: 'psychological', patterns: [
    /\bquero me matar\b/, /\bvou me matar\b/, /\bpensar em me matar\b/, /\bpensando em me matar\b/,
    /\bn(a|ã)o aguento mais viver\b/, /\bn(a|ã)o quero mais viver\b/,
    /\bvou fazer algo contra mim\b/, /\bvou acabar com tudo\b/,
    /\bidea(c|ç)(a|ã)o suicida\b/, /\bsuicid/, /\bme machucar\b/,
    /\bvou tirar minha vida\b/, /\btentei me matar\b/,
  ]},
  { keyword: 'autolesao', category: 'psychological', patterns: [
    /\bestou me cortando\b/, /\bme corto\b/, /\bautolesao\b/, /\bauto( |-)?les(a|ã)o\b/,
    /\bme machuco de proposito\b/, /\bme machucar de proposito\b/,
  ]},
];

const EMERGENCY_GUIDANCE: Record<EmergencyCategory, string> = {
  physical:
    'Seus sintomas podem indicar uma emergência médica. Procure imediatamente um pronto-atendimento ou ligue para o SAMU (192).',
  psychological:
    'Sinto muito que você esteja passando por isso. Você não precisa lidar com isso sozinho(a). Procure ajuda agora — ligue para o CVV (188) ou vá até um pronto-atendimento. Se puder, fale com alguém de confiança neste momento.',
};

export function detectRedFlags(symptoms?: string | null): RedFlagResult {
  const text = normalizeText(symptoms ?? '');
  if (!text) {
    return { isUrgent: false, matchedSignals: [], guidance: '', category: null };
  }

  const matchedSignals: string[] = [];
  let detectedCategory: EmergencyCategory | null = null;
  for (const rule of RED_FLAG_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      matchedSignals.push(rule.keyword);
      // Psychological takes priority for guidance tone
      if (!detectedCategory || rule.category === 'psychological') {
        detectedCategory = rule.category;
      }
    }
  }

  if (matchedSignals.length === 0) {
    return { isUrgent: false, matchedSignals: [], guidance: '', category: null };
  }

  return {
    isUrgent: true,
    matchedSignals,
    guidance: EMERGENCY_GUIDANCE[detectedCategory!],
    category: detectedCategory,
  };
}

export function getNextBestActionForRequest(
  request: Pick<RequestResponseDto, 'status' | 'requestType' | 'signedDocumentUrl'>
): NextBestAction {
  const rawStatus = request.status;
  const status = normalizeRequestStatus(rawStatus);

  if (status === 'submitted') {
    return {
      title: 'Pedido recebido',
      statusSummary: 'Seu pedido entrou na fila de análise clínica.',
      whatToDo: 'Aguarde. Se precisar, você pode abrir o detalhe para acompanhar em tempo real.',
      eta: 'Normalmente em 3 a 10 minutos.',
      intent: 'track',
    };
  }

  if (status === 'in_review') {
    return {
      title: 'Em análise médica',
      statusSummary: 'Um profissional está revisando as informações enviadas.',
      whatToDo: 'Mantenha notificações ativas. Se houver pendência, você será avisado.',
      eta: 'Geralmente conclui em até 10 minutos.',
      intent: 'wait',
    };
  }

  if (rawStatus === 'approved_pending_payment') {
    return {
      title: 'Solicitação aprovada',
      statusSummary: 'Seu pedido foi aprovado e está aguardando assinatura do médico.',
      whatToDo: 'Aguarde. O médico está preparando e assinando seu documento.',
      eta: 'Normalmente em 3 a 10 minutos.',
      intent: 'wait',
    };
  }

  if (rawStatus === 'paid') {
    if (request.requestType === 'consultation') {
      return {
        title: 'Consulta liberada',
        statusSummary: 'Consulta aceita. Aguardando o médico iniciar o atendimento.',
        whatToDo: 'Fique no app. Você será levado automaticamente para a consulta quando iniciar.',
        eta: 'Normalmente em poucos minutos.',
        intent: 'wait',
      };
    }

    return {
      title: 'Documento aprovado',
      statusSummary: 'Solicitação aprovada.',
      whatToDo: 'O médico está preparando e assinando seu documento.',
      eta: 'Tempo médio de assinatura: 3 a 10 minutos.',
      intent: 'wait',
    };
  }

  if (status === 'signed' || status === 'delivered') {
    return {
      title: 'Documento pronto',
      statusSummary: 'Seu documento já está disponível para uso.',
      whatToDo: 'Baixe o PDF e apresente em farmácia/laboratório quando necessário.',
      eta: 'Disponível agora.',
      ctaLabel: request.signedDocumentUrl ? 'Baixar documento' : undefined,
      intent: request.signedDocumentUrl ? 'download' : 'none',
    };
  }

  if (status === 'consultation_finished') {
    return {
      title: 'Consulta finalizada',
      statusSummary: 'Seu atendimento foi concluído com sucesso.',
      whatToDo: 'Revise as orientações no detalhe e acesse o documento quando disponível.',
      eta: 'Disponível agora.',
      intent: 'track',
    };
  }

  if (status === 'rejected') {
    return {
      title: 'Pedido não aprovado',
      statusSummary: 'Seu pedido foi rejeitado nesta etapa.',
      whatToDo: 'Revise o motivo no detalhe e reenvie com os ajustes.',
      eta: 'Reenvio imediato.',
      intent: 'support',
    };
  }

  if (status === 'cancelled') {
    return {
      title: 'Pedido cancelado',
      statusSummary: 'Este pedido foi encerrado.',
      whatToDo: 'Se ainda precisar, crie um novo pedido guiado pela Dra. Renoveja.',
      eta: 'Você pode iniciar agora.',
      intent: 'none',
    };
  }

  return {
    title: 'Acompanhando seu pedido',
    statusSummary: 'Estamos monitorando o fluxo.',
    whatToDo: 'Abra o detalhe para ver a etapa atual.',
    eta: 'Atualização em tempo real.',
    intent: 'track',
  };
}
