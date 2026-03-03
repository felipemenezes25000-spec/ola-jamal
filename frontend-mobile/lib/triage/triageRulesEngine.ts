/**
 * triageRulesEngine.ts — Motor de regras da Dra. Renova
 *
 * Pure function: TriageInput → TriageMessage | null
 * Nenhuma chamada de API. Nenhum side-effect. 100% testável.
 *
 * Regras:
 *  - NUNCA mostrar em steps: payment, signing (momento crítico)
 *  - NUNCA diagnosticar ou prescrever
 *  - Max 2 linhas (~120 chars) por mensagem
 *  - CTA somente quando realmente acionável
 */

import type { TriageInput, TriageMessage, TriageStep } from './triage.types';

// ── Cooldown constants ──────────────────────────────────────

const MS = {
  STEP:      5 * 60_000,       // 5min – dicas de etapa
  INSIGHT:   24 * 3600_000,    // 24h  – insights de histórico
  PROACTIVE: 12 * 3600_000,    // 12h  – proativas na home
  WELCOME:   7 * 24 * 3600_000, // 7d  – boas-vindas
} as const;

// ── Blocked steps (momento crítico) ─────────────────────────

const BLOCKED_STEPS: Set<TriageStep> = new Set(['payment', 'signing']);

// ── Complex exam detection ──────────────────────────────────

const COMPLEX_EXAM_RE = /ressonancia|rnm|tomografia|pet.scan|cintilografia|marcadores?\s*tumorais?|ca[\s-]?12[5-9]|ca[\s-]?19|cea|psa|afp|biopsia|eletroneuromiografia|cateterismo|angiografia|densitometria|mamografia|colonoscopia|endoscopia|ecocardiograma|holter|mapa/i;

function hasComplexExams(exams: string[]): boolean {
  return exams.some(e =>
    COMPLEX_EXAM_RE.test(e.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );
}

// ── Main entry point ────────────────────────────────────────

export function evaluateTriageRules(input: TriageInput): TriageMessage | null {
  // 1. Doctor nunca recebe mensagens de triagem (tem sua própria UI)
  if (input.role === 'doctor') return null;

  // 2. Bloqueia em momentos críticos
  if (BLOCKED_STEPS.has(input.step)) return null;

  // 3. Dispatch por contexto
  switch (input.context) {
    case 'home':         return rulesHome(input);
    case 'prescription': return rulesPrescription(input);
    case 'exam':         return rulesExam(input);
    case 'consultation': return rulesConsultation(input);
    case 'detail':       return rulesDetail(input);
    default:             return null;
  }
}

// ── HOME ────────────────────────────────────────────────────

function rulesHome(i: TriageInput): TriageMessage | null {
  // Welcome (first-time user)
  if (!i.totalRequests || i.totalRequests === 0) {
    return {
      key: 'home:welcome',
      text: 'Bem-vindo ao RenoveJá+! Aqui você renova receitas, solicita exames e faz teleconsultas.',
      severity: 'positive', avatarState: 'positive',
      cta: 'ver_servicos', ctaLabel: 'Conhecer',
      cooldownMs: MS.WELCOME, canMute: true,
    };
  }

  // Muitas renovações recentes → sugerir consulta
  if (i.recentPrescriptionCount && i.recentPrescriptionCount >= 3) {
    return {
      key: 'home:many_renewals',
      text: 'Percebi que você tem renovado receitas com frequência. Já alinhou o tratamento com seu médico de origem? É muito importante manter esse acompanhamento.',
      severity: 'attention', avatarState: 'alert',
      cta: 'teleconsulta', ctaLabel: 'Tirar Dúvidas no Plantão',
      cooldownMs: MS.PROACTIVE, canMute: true,
      analyticsEvent: 'triage.home.many_renewals',
    };
  }

  // Exames recentes sem retorno
  if (i.recentExamCount && i.recentExamCount >= 2) {
    return {
      key: 'home:pending_results',
      text: 'Que bom que você cuida da saúde! Lembre-se de levar os resultados dos exames ao seu médico — é ele quem define a melhor conduta.',
      severity: 'info', avatarState: 'positive',
      cta: 'consulta_breve', ctaLabel: 'Agendar Retorno',
      cooldownMs: MS.PROACTIVE, canMute: true,
    };
  }

  // Muito tempo sem consulta
  if (i.lastConsultationDays && i.lastConsultationDays > 180) {
    return {
      key: 'home:long_no_consult',
      text: 'Faz um tempinho que não nos vemos! Manter consultas regulares é fundamental para um tratamento seguro. Posso te ajudar a agendar.',
      severity: 'info', avatarState: 'neutral',
      cta: 'teleconsulta', ctaLabel: 'Agendar Consulta',
      cooldownMs: MS.PROACTIVE, canMute: true,
    };
  }

  return null;
}

// ── PRESCRIPTION ────────────────────────────────────────────

function rulesPrescription(i: TriageInput): TriageMessage | null {
  const isControlled = i.prescriptionType === 'controlado' || i.prescriptionType === 'azul';

  switch (i.step) {
    case 'entry':
      return {
        key: 'rx:entry',
        text: 'Escolha o tipo de receita. Se tiver dúvidas, prefira uma teleconsulta.',
        severity: 'info', avatarState: 'neutral', cta: null,
        cooldownMs: MS.STEP,
      };

    case 'type_selected':
      if (isControlled) {
        return {
          key: `rx:controlled:${i.prescriptionType}`,
          text: i.prescriptionType === 'azul'
            ? 'Receita azul exige vigilância rigorosa. Confirme os documentos e dosagens.'
            : 'Receita controlada. Certifique-se de que a receita original está legível.',
          severity: 'attention', avatarState: 'alert',
          cta: 'consulta_breve', ctaLabel: 'Falar com Médico',
          cooldownMs: MS.STEP,
          analyticsEvent: `triage.rx.${i.prescriptionType}`,
        };
      }
      return {
        key: 'rx:simple',
        text: 'Tire uma foto nítida da receita com boa iluminação.',
        severity: 'positive', avatarState: 'positive', cta: null,
        cooldownMs: MS.STEP,
      };

    case 'photos_added':
      if (i.imagesCount === 0) return null;
      return {
        key: 'rx:photos',
        text: `${i.imagesCount} foto${i.imagesCount === 1 ? '' : 's'} adicionada${i.imagesCount === 1 ? '' : 's'}. Verifique se está legível antes de enviar.`,
        severity: 'positive', avatarState: 'positive', cta: null,
        cooldownMs: MS.STEP,
      };

    case 'analyzing':
      return {
        key: 'rx:analyzing',
        text: 'Verificando legibilidade e conteúdo da receita...',
        severity: 'info', avatarState: 'thinking', cta: null,
        cooldownMs: MS.STEP,
      };

    case 'result':
      // IA flagged risk
      if (i.aiRiskLevel === 'high') {
        return {
          key: 'rx:high_risk',
          text: 'Percebi que essa medicação exige cuidado especial. Tem passado com regularidade pelo seu médico? Estou aqui se precisar de orientação.',
          severity: 'attention', avatarState: 'alert',
          cta: 'consulta_breve', ctaLabel: 'Falar com Médico',
          cooldownMs: MS.INSIGHT,
          analyticsEvent: 'triage.rx.high_risk',
        };
      }
      // IA returned readability issue
      if (i.aiReadabilityOk === false) {
        return {
          key: 'rx:unreadable',
          text: 'A foto da receita pode estar um pouco difícil de ler. Que tal enviar outra com mais luz? Isso ajuda o médico a analisar mais rapidamente!',
          severity: 'attention', avatarState: 'alert', cta: null,
          cooldownMs: MS.STEP,
          analyticsEvent: 'triage.rx.unreadable',
        };
      }
      // Custom AI message
      if (i.aiMessageToUser) {
        return {
          key: 'rx:ai_message',
          text: i.aiMessageToUser.substring(0, 120),
          severity: 'info', avatarState: 'neutral', cta: null,
          cooldownMs: MS.STEP,
        };
      }
      return {
        key: 'rx:success',
        text: 'Receita recebida com sucesso! Em breve um médico vai analisar e aprovar. Qualquer dúvida, estou aqui.',
        severity: 'positive', avatarState: 'positive', cta: null,
        cooldownMs: MS.STEP,
      };

    default: return null;
  }
}

// ── EXAM ────────────────────────────────────────────────────

function rulesExam(i: TriageInput): TriageMessage | null {
  switch (i.step) {
    case 'entry':
      return {
        key: 'exam:entry',
        text: 'Informe os exames que precisa. Se tiver pedido médico, tire uma foto.',
        severity: 'info', avatarState: 'neutral', cta: null,
        cooldownMs: MS.STEP,
      };

    case 'type_selected':
      if (i.examType === 'imagem') {
        return {
          key: 'exam:imagem',
          text: 'Exames de imagem geralmente requerem preparo. Verifique com o laboratório.',
          severity: 'info', avatarState: 'neutral', cta: null,
          cooldownMs: MS.STEP,
        };
      }
      return null;

    case 'result':
      if (i.exams && hasComplexExams(i.exams)) {
        return {
          key: 'exam:complex',
          text: 'Que legal que você está se cuidando! Percebi que esses exames investigam condições importantes. Você tem retornado ao seu médico com os resultados? Estamos aqui se precisar conversar.',
          severity: 'attention', avatarState: 'alert',
          cta: 'teleconsulta', ctaLabel: 'Conversar no Plantão',
          cooldownMs: MS.INSIGHT,
          analyticsEvent: 'triage.exam.complex',
        };
      }
      if (i.exams && i.exams.length > 5) {
        return {
          key: 'exam:many',
          text: `Uau, ${i.exams.length} exames! Você está bem cuidada(o). Lembre de levar todos os resultados ao seu médico para ele orientar o próximo passo.`,
          severity: 'info', avatarState: 'positive',
          cta: 'consulta_breve', ctaLabel: 'Agendar Retorno',
          cooldownMs: MS.INSIGHT,
        };
      }
      return {
        key: 'exam:ok',
        text: 'Pedido de exames recebido! Leve os resultados ao seu médico — ele vai indicar a melhor conduta.',
        severity: 'positive', avatarState: 'positive', cta: null,
        cooldownMs: MS.STEP,
      };

    default: return null;
  }
}

// ── CONSULTATION ────────────────────────────────────────────

function rulesConsultation(i: TriageInput): TriageMessage | null {
  if (i.step === 'entry') {
    return {
      key: 'consult:entry',
      text: 'Descreva seus sintomas: o que sente, há quanto tempo e medicamentos que toma.',
      severity: 'info', avatarState: 'neutral', cta: null,
      cooldownMs: MS.STEP,
    };
  }
  if (i.step === 'symptoms_entered' && i.symptoms && i.symptoms.length < 20) {
    return {
      key: 'consult:short_symptoms',
      text: 'Quanto mais detalhes, melhor o atendimento. Inclua quando começou.',
      severity: 'info', avatarState: 'neutral', cta: null,
      cooldownMs: MS.STEP,
    };
  }
  return null;
}

// ── REQUEST DETAIL ──────────────────────────────────────────

function rulesDetail(i: TriageInput): TriageMessage | null {
  // Has doctor conduct → highlight
  if (i.doctorConductNotes) {
    return {
      key: 'detail:conduct_available',
      text: 'O médico deixou recomendações especiais para você aqui. Leia com atenção — são orientações personalizadas para o seu cuidado!',
      severity: 'info', avatarState: 'positive', cta: null,
      cooldownMs: MS.INSIGHT,
    };
  }

  // Signed/delivered → remind follow-up
  if (i.status === 'signed' || i.status === 'delivered') {
    return {
      key: 'detail:completed',
      text: 'Tudo certo! Documento pronto. Lembre de manter o retorno ao seu médico — o acompanhamento contínuo faz toda a diferença.',
      severity: 'positive', avatarState: 'positive', cta: null,
      cooldownMs: MS.INSIGHT,
    };
  }

  return null;
}
