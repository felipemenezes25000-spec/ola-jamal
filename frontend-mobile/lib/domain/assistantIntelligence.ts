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
    { id: 'duration', label: 'Definir duração da consulta', required: true, done: input.durationMinutes >= 5 },
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

const RED_FLAG_RULES: { keyword: string; patterns: RegExp[] }[] = [
  { keyword: 'dor no peito', patterns: [/\bdor no peito\b/, /\bpressao no peito\b/] },
  { keyword: 'falta de ar', patterns: [/\bfalta de ar\b/, /\bnao consigo respirar\b/, /\bdificuldade para respirar\b/] },
  { keyword: 'desmaio', patterns: [/\bdesmaio\b/, /\bdesmaiei\b/] },
  { keyword: 'confusao mental', patterns: [/\bconfusao mental\b/, /\bestou confuso\b/, /\bdesorienta(c|ç)ao\b/] },
  { keyword: 'sinais neurologicos', patterns: [/\bfraqueza de um lado\b/, /\brosto torto\b/, /\bfala enrolada\b/, /\bconvuls(a|ã)o\b/] },
  { keyword: 'sangramento intenso', patterns: [/\bsangramento intenso\b/, /\bsangue em grande quantidade\b/] },
];

export function detectRedFlags(symptoms?: string | null): RedFlagResult {
  const text = normalizeText(symptoms ?? '');
  if (!text) {
    return {
      isUrgent: false,
      matchedSignals: [],
      guidance: '',
    };
  }

  const matchedSignals: string[] = [];
  for (const rule of RED_FLAG_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      matchedSignals.push(rule.keyword);
    }
  }

  if (matchedSignals.length === 0) {
    return {
      isUrgent: false,
      matchedSignals: [],
      guidance: '',
    };
  }

  return {
    isUrgent: true,
    matchedSignals,
    guidance:
      'Isso pode ser urgente. Procure emergencia ou ligue 192 agora. Se quiser, eu te ajudo a registrar o ocorrido para o medico.',
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
      statusSummary: 'Seu pedido entrou na fila de analise clinica.',
      whatToDo: 'Aguarde. Se precisar, voce pode abrir o detalhe para acompanhar em tempo real.',
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
      title: 'Solicitação aprovada — pagamento pendente',
      statusSummary: 'Seu pedido foi aprovado pelo médico. Realize o pagamento para continuar.',
      whatToDo: 'Toque no botão abaixo para pagar via PIX ou cartão.',
      eta: 'Após o pagamento, o médico assina seu documento em minutos.',
      ctaLabel: 'Pagar agora',
      intent: 'pay',
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
      eta: 'Tempo medio de assinatura: 3 a 10 minutos.',
      intent: 'wait',
    };
  }

  if (status === 'signed' || status === 'delivered') {
    return {
      title: 'Documento pronto',
      statusSummary: 'Seu documento ja esta disponivel para uso.',
      whatToDo: 'Baixe o PDF e apresente em farmacia/laboratorio quando necessario.',
      eta: 'Disponivel agora.',
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
      eta: 'Voce pode iniciar agora.',
      intent: 'none',
    };
  }

  return {
    title: 'Acompanhando seu pedido',
    statusSummary: 'Estamos monitorando o fluxo.',
    whatToDo: 'Abra o detalhe para ver a etapa atual.',
    eta: 'Atualizacao em tempo real.',
    intent: 'track',
  };
}
