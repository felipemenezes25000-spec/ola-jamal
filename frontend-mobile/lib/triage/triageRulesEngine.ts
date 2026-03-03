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
  STEP:      5 * 60_000,       // 5min – dicas de etapa (novato)
  STEP_NOVICE: 60 * 60_000,    // 1h – 3–9 pedidos
  STEP_VET:  24 * 3600_000,    // 24h – veteranos
  INSIGHT:   24 * 3600_000,    // 24h  – insights de histórico
  PROACTIVE: 12 * 3600_000,    // 12h  – proativas na home
  WELCOME:   7 * 24 * 3600_000, // 7d  – boas-vindas
} as const;

/** Cooldown dinâmico: novatos 5min, intermediários 1h, veteranos 24h. */
function getStepCooldown(totalRequests?: number): number {
  if (!totalRequests || totalRequests < 3) return MS.STEP;
  if (totalRequests < 10) return MS.STEP_NOVICE;
  return MS.STEP_VET;
}

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
  // 1. Doctor só recebe mensagens em contextos próprios (fluxo do médico)
  const isDoctorContext = input.context === 'doctor_dashboard' || input.context === 'doctor_detail' || input.context === 'doctor_prontuario';
  if (input.role === 'doctor' && !isDoctorContext) return null;

  // 2. Bloqueia em momentos críticos
  if (BLOCKED_STEPS.has(input.step)) return null;

  // 3. Dispatch por contexto
  switch (input.context) {
    case 'home':         return rulesHome(input);
    case 'prescription': return rulesPrescription(input);
    case 'exam':         return rulesExam(input);
    case 'consultation': return rulesConsultation(input);
    case 'detail':       return rulesDetail(input);
    case 'doctor_dashboard':  return rulesDoctorDashboard(input);
    case 'doctor_detail':     return rulesDoctorDetail(input);
    case 'doctor_prontuario': return rulesDoctorProntuario(input);
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
        cooldownMs: getStepCooldown(i.totalRequests),
        canMute: true,
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
          cooldownMs: getStepCooldown(i.totalRequests),
          analyticsEvent: `triage.rx.${i.prescriptionType}`,
        };
      }
      return {
        key: 'rx:simple',
        text: 'Tire uma foto nítida da receita com boa iluminação.',
        severity: 'positive', avatarState: 'positive', cta: null,
        cooldownMs: getStepCooldown(i.totalRequests),
        canMute: true,
      };

    case 'photos_added':
      if (i.imagesCount === 0) return null;
      return {
        key: 'rx:photos',
        text: `${i.imagesCount} foto${i.imagesCount === 1 ? '' : 's'} adicionada${i.imagesCount === 1 ? '' : 's'}. Verifique se está legível antes de enviar.`,
        severity: 'positive', avatarState: 'positive', cta: null,
        cooldownMs: getStepCooldown(i.totalRequests),
        canMute: true,
      };

    case 'analyzing':
      return {
        key: 'rx:analyzing',
        text: 'Verificando legibilidade e conteúdo da receita...',
        severity: 'info', avatarState: 'thinking', cta: null,
        cooldownMs: getStepCooldown(i.totalRequests),
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
        cooldownMs: getStepCooldown(i.totalRequests),
        canMute: true,
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
        cooldownMs: getStepCooldown(i.totalRequests),
        canMute: true,
      };

    case 'type_selected':
      if (i.examType === 'imagem') {
        return {
          key: 'exam:imagem',
          text: 'Exames de imagem geralmente requerem preparo. Verifique com o laboratório.',
          severity: 'info', avatarState: 'neutral', cta: null,
          cooldownMs: getStepCooldown(i.totalRequests),
          canMute: true,
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
      // Suprimir mensagem genérica quando paciente já fez tudo (foto + exames)
      if (i.imagesCount && i.imagesCount > 0 && i.exams && i.exams.length > 0) {
        return null;
      }
      return {
        key: 'exam:ok',
        text: 'Pedido de exames recebido! Leve os resultados ao seu médico — ele vai indicar a melhor conduta.',
        severity: 'positive', avatarState: 'positive', cta: null,
        cooldownMs: getStepCooldown(i.totalRequests),
        canMute: true,
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
      cooldownMs: getStepCooldown(i.totalRequests),
      canMute: true,
    };
  }
  if (i.step === 'symptoms_entered' && i.symptoms && i.symptoms.length < 20) {
    return {
      key: 'consult:short_symptoms',
      text: 'Quanto mais detalhes, melhor o atendimento. Inclua quando começou.',
      severity: 'info', avatarState: 'neutral', cta: null,
      cooldownMs: getStepCooldown(i.totalRequests),
      canMute: true,
    };
  }
  return null;
}

// ── REQUEST DETAIL ──────────────────────────────────────────

function rulesDetail(i: TriageInput): TriageMessage | null {
  // Antes do pagamento: pedido aprovado aguardando pagamento
  if (
    i.step === 'entry' &&
    i.status &&
    ['approved_pending_payment', 'pending_payment', 'consultation_ready'].includes(i.status)
  ) {
    const kind = i.requestType ?? 'generic';
    if (kind === 'consultation') {
      return {
        key: 'detail:pay_consultation',
        text: 'Na próxima tela você escolhe como pagar a consulta. Após a aprovação, liberamos o acesso para entrar na videochamada.',
        severity: 'info', avatarState: 'neutral', cta: null,
        cooldownMs: MS.STEP,
        canMute: true,
      };
    }
    return {
      key: kind === 'exam' ? 'detail:pay_exam' : 'detail:pay_prescription',
      text: 'Na próxima tela você escolhe como pagar. Assim que o pagamento for aprovado, o documento fica disponível neste pedido.',
      severity: 'info', avatarState: 'neutral', cta: null,
      cooldownMs: MS.STEP,
      canMute: true,
    };
  }

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

// ── DOCTOR DASHBOARD (uso da plataforma) ────────────────────

function rulesDoctorDashboard(i: TriageInput): TriageMessage | null {
  // Sem certificado digital → bloqueia assinatura
  if (i.doctorHasCertificate === false) {
    return {
      key: 'doctor:dashboard:no_certificate',
      text: 'Você ainda não fez upload do certificado digital. Sem ele, não é possível assinar receitas e exames neste painel.',
      severity: 'attention',
      avatarState: 'alert',
      cta: null,
      cooldownMs: MS.INSIGHT,
      canMute: true,
    };
  }

  // Muitos documentos pagos aguardando assinatura
  if (i.doctorToSignCount && i.doctorToSignCount > 0) {
    return {
      key: 'doctor:dashboard:to_sign',
      text: `Há ${i.doctorToSignCount} documento(s) pagos aguardando assinatura digital. Abra a lista para concluir e liberar para os pacientes.`,
      severity: 'info',
      avatarState: 'neutral',
      cta: null,
      cooldownMs: MS.INSIGHT,
      canMute: true,
    };
  }

  // Fila com atendimentos pendentes
  if (i.doctorPendingCount && i.doctorPendingCount > 0) {
    return {
      key: 'doctor:dashboard:pending',
      text: `Você tem ${i.doctorPendingCount} atendimento(s) pendente(s) na fila. Priorize os mais antigos na aba Painel.`,
      severity: 'info',
      avatarState: 'neutral',
      cta: null,
      cooldownMs: MS.PROACTIVE,
      canMute: true,
    };
  }

  return null;
}

// ── DOCTOR DETAIL (pedido específico) ───────────────────────

function rulesDoctorDetail(i: TriageInput): TriageMessage | null {
  // Pedido já pago, aguardando ação do médico
  if (i.status === 'paid' && i.requestType && i.requestType !== 'consultation') {
    return {
      key: `doctor:detail:paid:${i.requestType}`,
      text: 'Este pedido já está pago. Revise as imagens e o resumo e, se estiver de acordo, assine o documento para liberar ao paciente.',
      severity: 'info',
      avatarState: 'neutral',
      cta: null,
      cooldownMs: MS.INSIGHT,
      canMute: true,
    };
  }

  // Consulta pronta para iniciar
  if (i.requestType === 'consultation' && i.status === 'consultation_ready') {
    return {
      key: 'doctor:detail:consultation_ready',
      text: 'Consulta pronta para iniciar. Ao terminar, lembre-se de registrar a conduta e o resumo no prontuário.',
      severity: 'info',
      avatarState: 'neutral',
      cta: null,
      cooldownMs: MS.INSIGHT,
      canMute: true,
    };
  }

  // Pedido sem leitura IA ainda (útil, mas opcional)
  if (!i.aiSummaryForDoctor) {
    return {
      key: 'doctor:detail:no_ai_summary',
      text: 'Este pedido ainda não passou pela leitura da IA. Se achar útil, use o botão “Reanalisar com IA” como apoio à sua revisão.',
      severity: 'info',
      avatarState: 'thinking',
      cta: null,
      cooldownMs: MS.PROACTIVE,
      canMute: true,
    };
  }

  return null;
}

// ── DOCTOR PRONTUÁRIO (histórico do paciente) ───────────────

function rulesDoctorProntuario(i: TriageInput): TriageMessage | null {
  // Fatos de uso do app pelo paciente, para orientar a conversa
  if (i.recentPrescriptionCount && i.recentPrescriptionCount >= 3 && (!i.lastConsultationDays || i.lastConsultationDays > 90)) {
    return {
      key: 'doctor:prontuario:many_renewals',
      text: `Este paciente renovou receitas ${i.recentPrescriptionCount} vez(es) nos últimos meses nesta plataforma. Considere explorar a adesão e necessidade de ajuste terapêutico.`,
      severity: 'info',
      avatarState: 'neutral',
      cta: null,
      cooldownMs: MS.INSIGHT,
      canMute: true,
    };
  }

  if (i.recentExamCount && i.recentExamCount >= 2 && i.lastConsultationDays && i.lastConsultationDays > 180) {
    return {
      key: 'doctor:prontuario:exams_no_consult',
      text: `Fez exames recentemente, mas não há consulta registrada aqui há ${i.lastConsultationDays} dia(s). Pode ser útil investigar se houve acompanhamento presencial ou por outro serviço.`,
      severity: 'info',
      avatarState: 'neutral',
      cta: null,
      cooldownMs: MS.INSIGHT,
      canMute: true,
    };
  }

  return null;
}
