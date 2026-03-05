/**
 * triageRulesEngine.ts — Motor de regras da Dra. Renoveja
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

// ── Cooldown constants (equilibrado: assistido sem spam) ───────

const MS = {
  STEP:      30 * 1000,       // 30s – dicas de etapa ao voltar (ex.: tire foto nítida)
  STEP_NOVICE: 30 * 1000,     // 30s – mesmo para intermediários
  STEP_VET:  60 * 1000,       // 1min – veteranos, menos intrusivo
  INSIGHT:   15 * 60_000,     // 15min – insights de histórico (não repetir demais)
  PROACTIVE: 2 * 60_000,      // 2min – proativas na home (presente sem cansar)
  WELCOME:   30 * 60_000,     // 30min – boas-vindas (não a cada 15s)
  COMPANION: 45 * 1000,       // 45s – dicas de fallback (evita tela passiva)
} as const;

/** Cooldown dinâmico por experiência do usuário. */
function getStepCooldown(totalRequests?: number): number {
  if (!totalRequests || totalRequests < 3) return MS.STEP;
  if (totalRequests < 10) return MS.STEP_NOVICE;
  return MS.STEP_VET;
}

// ── Blocked steps (momento crítico) ─────────────────────────

const BLOCKED_STEPS: Set<TriageStep> = new Set(['payment', 'signing']);

// ── Companion fallbacks (evita tela passiva — Dra. Renoveja sempre interagindo) ─

const COMPANION_TIPS: Record<string, Omit<TriageMessage, 'key' | 'cooldownMs'>> = {
  home: {
    text: 'Renove receitas, peça exames ou agende consultas. Toque em mim para tirar dúvidas ou ver orientações.',
    severity: 'info', avatarState: 'neutral',
    cta: 'tire_duvidas', ctaLabel: 'Tirar dúvidas',
    canMute: true,
  },
  prescription: {
    text: 'Estou aqui para orientar. Tire uma foto nítida da receita e siga o passo a passo.',
    severity: 'info', avatarState: 'neutral',
    cta: 'tire_duvidas', ctaLabel: 'Tirar dúvidas',
    canMute: true,
  },
  exam: {
    text: 'Informe os exames que precisa ou tire foto do pedido médico. Posso ajudar com dúvidas.',
    severity: 'info', avatarState: 'neutral',
    cta: 'tire_duvidas', ctaLabel: 'Tirar dúvidas',
    canMute: true,
  },
  consultation: {
    text: 'Conte ao médico o que sente, há quanto tempo e quais medicamentos usa. Isso ajuda no atendimento.',
    severity: 'info', avatarState: 'neutral',
    cta: 'tire_duvidas', ctaLabel: 'Tirar dúvidas',
    canMute: true,
  },
  detail: {
    text: 'Acompanhe seu pedido aqui. Se tiver dúvidas sobre o processo, toque em mim.',
    severity: 'info', avatarState: 'neutral',
    cta: 'tire_duvidas', ctaLabel: 'Tirar dúvidas',
    canMute: true,
  },
  requests: {
    text: 'Seus pedidos aparecem aqui. Use o botão Início para renovar receitas ou agendar consultas.',
    severity: 'info', avatarState: 'neutral',
    cta: 'ver_servicos', ctaLabel: 'Ver serviços',
    canMute: true,
  },
  record: {
    text: 'Seu histórico de atendimentos está aqui. Mantenha o acompanhamento com seu médico.',
    severity: 'info', avatarState: 'neutral',
    cta: 'teleconsulta', ctaLabel: 'Falar com médico',
    canMute: true,
  },
  profile: {
    text: 'Gerencie sua conta e configurações. Toque em mim se precisar de ajuda.',
    severity: 'info', avatarState: 'neutral',
    cta: 'tire_duvidas', ctaLabel: 'Tirar dúvidas',
    canMute: true,
  },
  help: {
    text: 'Aqui estão as respostas mais comuns. Não encontrou? Entre em contato conosco.',
    severity: 'info', avatarState: 'positive',
    cta: null,
    canMute: true,
  },
  doctor_dashboard: {
    text: 'Painel do médico. Revise atendimentos pendentes e documentos para assinar.',
    severity: 'info', avatarState: 'neutral',
    cta: null,
    canMute: true,
  },
  doctor_detail: {
    text: 'Revise o pedido, as imagens e o resumo. A decisão clínica é sempre sua.',
    severity: 'info', avatarState: 'neutral',
    cta: null,
    canMute: true,
  },
  doctor_prontuario: {
    text: 'Histórico do paciente. Use para orientar a conversa e a conduta.',
    severity: 'info', avatarState: 'neutral',
    cta: null,
    canMute: true,
  },
};

function companionFallback(context: string): TriageMessage {
  const tip = COMPANION_TIPS[context] ?? COMPANION_TIPS.home;
  return {
    key: `${context}:companion`,
    ...tip,
    cooldownMs: MS.COMPANION,
  };
}

// ── Complex exam detection ──────────────────────────────────

const COMPLEX_EXAM_RE = /ressonancia|rnm|tomografia|pet.scan|cintilografia|marcadores?\s*tumorais?|ca[\s-]?12[5-9]|ca[\s-]?19|cea|psa|afp|biopsia|eletroneuromiografia|cateterismo|angiografia|densitometria|mamografia|colonoscopia|endoscopia|ecocardiograma|holter|mapa/i;
const RED_FLAG_SYMPTOMS_RE = /dor no peito|falta de ar|desmaio|convuls|sangramento intenso|perda de consciencia|fraqueza de um lado|confusao mental|ideacao suicida|pensamentos suicidas|febre alta persistente|rigidez na nuca|dor de cabeca súbita|dor de cabeca subita/i;

function hasComplexExams(exams: string[]): boolean {
  return exams.some(e =>
    COMPLEX_EXAM_RE.test(e.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );
}

function hasRedFlagSymptoms(symptoms?: string | null): boolean {
  if (!symptoms) return false;
  const normalized = symptoms.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return RED_FLAG_SYMPTOMS_RE.test(normalized);
}

function hasHighMedicationBurden(medications?: string[]): boolean {
  if (!medications || medications.length < 5) return false;
  const unique = new Set(
    medications
      .map((m) => (m ?? '').trim().toLowerCase())
      .filter(Boolean)
  );
  return unique.size >= 5;
}

// ── Main entry point ────────────────────────────────────────

export function evaluateTriageRules(input: TriageInput): TriageMessage | null {
  // 1. Doctor só recebe mensagens em contextos próprios ou compartilhados (help)
  const isDoctorContext = input.context === 'doctor_dashboard' || input.context === 'doctor_detail' || input.context === 'doctor_prontuario';
  const isSharedContext = input.context === 'help';
  if (input.role === 'doctor' && !isDoctorContext && !isSharedContext) return null;

  // 2. Bloqueia em momentos críticos
  if (BLOCKED_STEPS.has(input.step)) return null;

  // 3. Dispatch por contexto
  switch (input.context) {
    case 'home':         return rulesHome(input);
    case 'prescription': return rulesPrescription(input);
    case 'exam':         return rulesExam(input);
    case 'consultation': return rulesConsultation(input);
    case 'detail':       return rulesDetail(input);
    case 'requests':    return rulesRequests(input);
    case 'record':      return rulesRecord(input);
    case 'profile':     return rulesProfile(input);
    case 'help':        return rulesHelp(input);
    case 'doctor_dashboard':  return rulesDoctorDashboard(input);
    case 'doctor_detail':     return rulesDoctorDetail(input);
    case 'doctor_prontuario': return rulesDoctorProntuario(input);
    default:             return companionFallback('home');
  }
}

// ── HOME ────────────────────────────────────────────────────

function rulesHome(i: TriageInput): TriageMessage | null {
  if (!i.totalRequests || i.totalRequests === 0) {
    return {
      key: 'home:welcome',
      text: 'Que bom ter você aqui! No RenoveJá+ você renova receitas, pede exames e faz teleconsultas — tudo com médicos de verdade.',
      severity: 'positive', avatarState: 'positive',
      cta: 'ver_servicos', ctaLabel: 'Conhecer serviços',
      cooldownMs: MS.WELCOME, canMute: true,
    };
  }

  // Sugestão proativa: tempo desde última receita — "pode ser hora de renovar"
  if (i.lastPrescriptionDaysAgo != null && i.lastPrescriptionDaysAgo >= 25 && i.recentPrescriptionCount && i.recentPrescriptionCount > 0) {
    return {
      key: 'home:renew_prescription',
      text: 'Pela sua última receita, pode ser hora de renovar. O médico avalia e aprova — você fica tranquilo.',
      severity: 'info', avatarState: 'neutral',
      cta: 'renovar_receita', ctaLabel: 'Renovar receita',
      cooldownMs: MS.PROACTIVE, canMute: true,
      analyticsEvent: 'triage.home.renew_prescription',
    };
  }

  // Sugestão proativa: tempo desde último exame — direcionar para pedir exames
  if (i.lastExamDaysAgo != null && i.lastExamDaysAgo >= 180 && i.recentExamCount && i.recentExamCount > 0) {
    return {
      key: 'home:renew_exam',
      text: 'Seus exames podem precisar de renovação. Solicite novos exames — o médico analisa e aprova.',
      severity: 'info', avatarState: 'neutral',
      cta: 'pedir_exames', ctaLabel: 'Pedir exames',
      cooldownMs: MS.PROACTIVE, canMute: true,
      analyticsEvent: 'triage.home.renew_exam',
    };
  }

  // Sugestão por idade: exames de rotina (40+)
  if (i.patientAge != null && i.patientAge >= 40 && (!i.lastExamDaysAgo || i.lastExamDaysAgo > 365)) {
    return {
      key: 'home:routine_exams_age',
      text: 'Exames de rotina são importantes para sua idade. O médico orienta o que fazer.',
      severity: 'info', avatarState: 'neutral',
      cta: 'pedir_exames', ctaLabel: 'Pedir exames',
      cooldownMs: MS.PROACTIVE, canMute: true,
      analyticsEvent: 'triage.home.routine_exams_age',
    };
  }

  if (i.recentPrescriptionCount && i.recentPrescriptionCount >= 3) {
    return {
      key: 'home:many_renewals',
      text: 'Notei que você renovou receitas algumas vezes recentemente. Que tal conversar com um médico para garantir que tudo está no caminho certo?',
      severity: 'attention', avatarState: 'alert',
      cta: 'teleconsulta', ctaLabel: 'Falar com médico',
      cooldownMs: MS.PROACTIVE, canMute: true,
      analyticsEvent: 'triage.home.many_renewals',
    };
  }

  if (hasHighMedicationBurden(i.recentMedications) && (!i.lastConsultationDays || i.lastConsultationDays > 60)) {
    return {
      key: 'home:medication_review',
      text: 'Vi que voce usa varios medicamentos. Uma revisao com medico pode aumentar seguranca e aderencia do tratamento.',
      severity: 'attention', avatarState: 'alert',
      cta: 'teleconsulta', ctaLabel: 'Revisar com medico',
      cooldownMs: MS.PROACTIVE, canMute: true,
      analyticsEvent: 'triage.home.medication_review',
    };
  }

  if (i.recentExamCount && i.recentExamCount >= 2) {
    return {
      key: 'home:pending_results',
      text: 'Parabéns por cuidar da sua saúde! Não esqueça de levar os resultados ao seu médico — ele vai orientar os próximos passos.',
      severity: 'info', avatarState: 'positive',
      cta: 'consulta_breve', ctaLabel: 'Agendar retorno',
      cooldownMs: MS.PROACTIVE, canMute: true,
    };
  }

  if (i.lastConsultationDays && i.lastConsultationDays > 180) {
    return {
      key: 'home:long_no_consult',
      text: 'Faz um tempinho que não conversamos! Consultas regulares fazem toda a diferença no seu tratamento. Posso te ajudar a agendar.',
      severity: 'info', avatarState: 'neutral',
      cta: 'teleconsulta', ctaLabel: 'Agendar consulta',
      cooldownMs: MS.PROACTIVE, canMute: true,
    };
  }

  return companionFallback('home');
}

// ── PRESCRIPTION ────────────────────────────────────────────

function rulesPrescription(i: TriageInput): TriageMessage | null {
  const isControlled = i.prescriptionType === 'controlado' || i.prescriptionType === 'azul';

  switch (i.step) {
    case 'entry':
      return {
        key: 'rx:entry',
        text: 'Vamos renovar sua receita! Escolha o tipo abaixo. Se tiver dúvidas, estou aqui.',
        severity: 'info', avatarState: 'neutral', cta: null,
        cooldownMs: getStepCooldown(i.totalRequests),
        canMute: true,
      };

    case 'type_selected':
      if (isControlled) {
        return {
          key: `rx:controlled:${i.prescriptionType}`,
          text: i.prescriptionType === 'azul'
            ? 'Receita azul requer atenção especial. Tenha a receita original em mãos e confira os dados.'
            : 'Receita controlada — garanta que a foto esteja bem legível para facilitar a análise.',
          severity: 'attention', avatarState: 'alert',
          cta: 'consulta_breve', ctaLabel: 'Falar com médico',
          cooldownMs: getStepCooldown(i.totalRequests),
          analyticsEvent: `triage.rx.${i.prescriptionType}`,
        };
      }
      return {
        key: 'rx:simple',
        text: 'Ótimo! Agora tire uma foto nítida da receita, com boa iluminação e sem sombras.',
        severity: 'positive', avatarState: 'positive', cta: null,
        cooldownMs: getStepCooldown(i.totalRequests),
        canMute: true,
      };

    case 'photos_added':
      if (i.imagesCount === 0) return null;
      return {
        key: 'rx:photos',
        text: `${i.imagesCount === 1 ? 'Foto adicionada' : `${i.imagesCount} fotos adicionadas`}! Confira se está tudo legível antes de enviar.`,
        severity: 'positive', avatarState: 'positive', cta: null,
        cooldownMs: getStepCooldown(i.totalRequests),
        canMute: true,
      };

    case 'analyzing':
      return {
        key: 'rx:analyzing',
        text: 'Analisando sua receita com IA... isso leva poucos segundos.',
        severity: 'info', avatarState: 'thinking', cta: null,
        cooldownMs: getStepCooldown(i.totalRequests),
      };

    case 'result':
      if (i.aiRiskLevel === 'high') {
        return {
          key: 'rx:high_risk',
          text: 'Essa medicação requer acompanhamento especial. Mantenha seu médico de confiança informado sobre o uso contínuo.',
          severity: 'attention', avatarState: 'alert',
          cta: 'consulta_breve', ctaLabel: 'Falar com médico',
          cooldownMs: MS.INSIGHT,
          analyticsEvent: 'triage.rx.high_risk',
        };
      }
      if (hasRedFlagSymptoms(i.symptoms)) {
        return {
          key: 'rx:red_flags_symptoms',
          text: 'Se houver piora ou sinais de alerta, procure atendimento de urgencia. Se preferir, agende teleconsulta agora.',
          severity: 'attention', avatarState: 'alert',
          cta: 'teleconsulta', ctaLabel: 'Agendar teleconsulta',
          cooldownMs: MS.INSIGHT,
          analyticsEvent: 'triage.rx.red_flags',
        };
      }
      if (i.aiReadabilityOk === false) {
        return {
          key: 'rx:unreadable',
          text: 'A foto ficou um pouco difícil de ler. Tente outra com mais luz — isso agiliza a análise do médico!',
          severity: 'attention', avatarState: 'alert', cta: null,
          cooldownMs: MS.STEP,
          analyticsEvent: 'triage.rx.unreadable',
        };
      }
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
        text: 'Receita recebida! Um médico vai analisar em breve. Pode ficar tranquilo, eu aviso quando estiver pronta.',
        severity: 'positive', avatarState: 'positive', cta: null,
        cooldownMs: getStepCooldown(i.totalRequests),
        canMute: true,
      };

    default: return companionFallback('prescription');
  }
}

// ── EXAM ────────────────────────────────────────────────────

function rulesExam(i: TriageInput): TriageMessage | null {
  switch (i.step) {
    case 'entry':
      return {
        key: 'exam:entry',
        text: 'Vamos solicitar seus exames! Informe quais precisa. Se tiver um pedido médico, tire uma foto.',
        severity: 'info', avatarState: 'neutral', cta: null,
        cooldownMs: getStepCooldown(i.totalRequests),
        canMute: true,
      };

    case 'type_selected':
      if (i.examType === 'imagem') {
        return {
          key: 'exam:imagem',
          text: 'Exames de imagem podem exigir preparo especial. Verifique as orientações com o laboratório antes.',
          severity: 'info', avatarState: 'neutral', cta: null,
          cooldownMs: getStepCooldown(i.totalRequests),
          canMute: true,
        };
      }
      return companionFallback('exam');

    case 'result':
      if (i.aiRiskLevel === 'high') {
        return {
          key: 'exam:high_risk',
          text: 'Este pedido parece exigir avaliacao prioritaria. Se puder, converse com um medico o quanto antes.',
          severity: 'attention', avatarState: 'alert',
          cta: 'teleconsulta', ctaLabel: 'Falar com medico',
          cooldownMs: MS.INSIGHT,
          analyticsEvent: 'triage.exam.high_risk',
        };
      }
      if (i.exams && hasComplexExams(i.exams)) {
        return {
          key: 'exam:complex',
          text: 'Esses exames investigam condições importantes. Lembre de levar os resultados ao seu médico para uma avaliação completa.',
          severity: 'attention', avatarState: 'alert',
          cta: 'teleconsulta', ctaLabel: 'Falar com médico',
          cooldownMs: MS.INSIGHT,
          analyticsEvent: 'triage.exam.complex',
        };
      }
      if (i.exams && i.exams.length > 5) {
        return {
          key: 'exam:many',
          text: `São ${i.exams.length} exames — que bom que você cuida da saúde! Leve todos os resultados ao seu médico para orientação.`,
          severity: 'info', avatarState: 'positive',
          cta: 'consulta_breve', ctaLabel: 'Agendar retorno',
          cooldownMs: MS.INSIGHT,
        };
      }
      if (hasRedFlagSymptoms(i.symptoms)) {
        return {
          key: 'exam:red_flags_symptoms',
          text: 'Se os sintomas estiverem intensos ou piorando, procure urgencia. Posso te ajudar a falar com medico agora.',
          severity: 'attention', avatarState: 'alert',
          cta: 'teleconsulta', ctaLabel: 'Falar com medico',
          cooldownMs: MS.INSIGHT,
          analyticsEvent: 'triage.exam.red_flags',
        };
      }
      if (i.imagesCount && i.imagesCount > 0 && i.exams && i.exams.length > 0) {
        return companionFallback('exam');
      }
      return {
        key: 'exam:ok',
        text: 'Pedido recebido! Quando tiver os resultados, leve ao seu médico — ele vai orientar a conduta.',
        severity: 'positive', avatarState: 'positive', cta: null,
        cooldownMs: getStepCooldown(i.totalRequests),
        canMute: true,
      };

    default: return companionFallback('exam');
  }
}

// ── CONSULTATION ────────────────────────────────────────────

function rulesConsultation(i: TriageInput): TriageMessage | null {
  if (i.step === 'entry') {
    return {
      key: 'consult:entry',
      text: 'Conte ao médico o que está sentindo, há quanto tempo e se toma algum medicamento. Isso ajuda muito no atendimento!',
      severity: 'info', avatarState: 'neutral', cta: null,
      cooldownMs: getStepCooldown(i.totalRequests),
      canMute: true,
    };
  }
  if (i.step === 'symptoms_entered' && hasRedFlagSymptoms(i.symptoms)) {
    return {
      key: 'consult:red_flags',
      text: 'Esses sintomas podem merecer avaliacao rapida. Se houver piora, procure urgencia e converse com um medico.',
      severity: 'attention', avatarState: 'alert', cta: 'teleconsulta', ctaLabel: 'Falar com medico',
      cooldownMs: MS.INSIGHT,
      analyticsEvent: 'triage.consult.red_flags',
    };
  }
  if (i.step === 'symptoms_entered' && i.symptoms && i.symptoms.length < 20) {
    return {
      key: 'consult:short_symptoms',
      text: 'Tente adicionar mais detalhes — quando começou, o que piora ou melhora. Isso faz diferença no atendimento!',
      severity: 'info', avatarState: 'neutral', cta: null,
      cooldownMs: getStepCooldown(i.totalRequests),
      canMute: true,
    };
  }
  return companionFallback('consultation');
}

// ── REQUESTS (lista de pedidos) ───────────────────────────────

function rulesRequests(i: TriageInput): TriageMessage | null {
  if (i.step !== 'entry') return companionFallback('requests');
  const count = i.totalRequests ?? 0;
  if (count === 0) {
    return {
      key: 'requests:empty',
      text: 'Seus pedidos aparecerão aqui. Use o botão Início para renovar receitas, pedir exames ou agendar consultas.',
      severity: 'info', avatarState: 'neutral',
      cta: 'ver_servicos', ctaLabel: 'Ver serviços',
      cooldownMs: MS.STEP,
      canMute: true,
    };
  }
  if (i.toPayCount && i.toPayCount > 0) {
    return {
      key: 'requests:to_pay',
      text: `Você tem ${i.toPayCount} pedido(s) aguardando pagamento. Após pagar, o documento fica disponível para download.`,
      severity: 'info', avatarState: 'neutral',
      cta: null,
      cooldownMs: MS.INSIGHT,
      canMute: true,
    };
  }
  return companionFallback('requests');
}

// ── RECORD (prontuário do paciente) ─────────────────────────

function rulesRecord(i: TriageInput): TriageMessage | null {
  if (i.step !== 'entry') return null;

  // Sugestão proativa no prontuário: renovar receita
  if (i.lastPrescriptionDaysAgo != null && i.lastPrescriptionDaysAgo >= 25 && i.recentPrescriptionCount && i.recentPrescriptionCount > 0) {
    return {
      key: 'record:renew_prescription',
      text: 'Pelo seu histórico, pode ser hora de renovar sua receita. O médico avalia e decide.',
      severity: 'info', avatarState: 'neutral',
      cta: 'renovar_receita', ctaLabel: 'Renovar receita',
      cooldownMs: MS.INSIGHT, canMute: true,
    };
  }

  // Sugestão: exames de rotina por idade
  if (i.patientAge != null && i.patientAge >= 40 && (!i.lastExamDaysAgo || i.lastExamDaysAgo > 365)) {
    return {
      key: 'record:routine_exams',
      text: 'Exames de rotina fazem parte do cuidado. O médico orienta o que solicitar.',
      severity: 'info', avatarState: 'neutral',
      cta: 'pedir_exames', ctaLabel: 'Pedir exames',
      cooldownMs: MS.INSIGHT, canMute: true,
    };
  }

  if (hasHighMedicationBurden(i.recentMedications) && (!i.lastConsultationDays || i.lastConsultationDays > 60)) {
    return {
      key: 'record:medication_review',
      text: 'Seu historico mostra varios medicamentos recentes. Vale revisar com medico para manter seguranca no tratamento.',
      severity: 'attention', avatarState: 'alert',
      cta: 'teleconsulta', ctaLabel: 'Revisar com medico',
      cooldownMs: MS.INSIGHT, canMute: true,
    };
  }

  return {
    key: 'record:entry',
    text: 'Aqui está seu histórico de atendimentos, receitas e exames. Tudo organizado para você acompanhar sua saúde.',
    severity: 'info', avatarState: 'neutral',
    cta: 'teleconsulta', ctaLabel: 'Falar com médico',
    cooldownMs: MS.INSIGHT,
    canMute: true,
  };
}

// ── PROFILE (perfil) ─────────────────────────────────────────

function rulesProfile(i: TriageInput): TriageMessage | null {
  if (i.step !== 'entry') return companionFallback('profile');
  return {
    key: 'profile:entry',
    text: 'Aqui você gerencia sua conta, dados pessoais e configurações. Se tiver dúvidas, toque em mim para ajuda.',
    severity: 'info', avatarState: 'neutral',
    cta: 'tire_duvidas', ctaLabel: 'Tirar dúvidas',
    cooldownMs: MS.INSIGHT,
    canMute: true,
  };
}

// ── HELP (ajuda/FAQ) ─────────────────────────────────────────

function rulesHelp(i: TriageInput): TriageMessage | null {
  if (i.step !== 'entry') return companionFallback('help');
  return {
    key: 'help:entry',
    text: 'Aqui estão as respostas para as dúvidas mais comuns. Se não encontrar o que precisa, entre em contato conosco.',
    severity: 'info', avatarState: 'positive',
    cta: null,
    cooldownMs: MS.INSIGHT,
    canMute: true,
  };
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
        text: 'Falta só o pagamento! Depois disso, você entra direto na videochamada com o médico.',
        severity: 'info', avatarState: 'neutral', cta: null,
        cooldownMs: MS.STEP,
        canMute: true,
      };
    }
    return {
      key: kind === 'exam' ? 'detail:pay_exam' : 'detail:pay_prescription',
      text: 'Quase lá! Após o pagamento, seu documento fica disponível aqui mesmo para download.',
      severity: 'info', avatarState: 'neutral', cta: null,
      cooldownMs: MS.STEP,
      canMute: true,
    };
  }

  if (i.doctorConductNotes) {
    return {
      key: 'detail:conduct_available',
      text: 'O médico deixou orientações personalizadas para você. Leia com atenção — foram feitas pensando no seu caso!',
      severity: 'info', avatarState: 'positive', cta: null,
      cooldownMs: MS.INSIGHT,
    };
  }

  if (i.status === 'signed' || i.status === 'delivered') {
    return {
      key: 'detail:completed',
      text: 'Documento pronto! Não esqueça de manter o acompanhamento com seu médico — faz toda a diferença.',
      severity: 'positive', avatarState: 'positive', cta: null,
      cooldownMs: MS.INSIGHT,
    };
  }

  return companionFallback('detail');
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

  return companionFallback('doctor_dashboard');
}

// ── DOCTOR DETAIL (pedido específico) ───────────────────────

function rulesDoctorDetail(i: TriageInput): TriageMessage | null {
  if (i.aiRiskLevel === 'high') {
    return {
      key: 'doctor:detail:high_risk',
      text: 'A IA sinalizou risco elevado neste caso. Priorize revisao clinica detalhada e registre conduta com clareza.',
      severity: 'attention',
      avatarState: 'alert',
      cta: null,
      cooldownMs: MS.INSIGHT,
      canMute: true,
    };
  }

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

  return companionFallback('doctor_prontuario');
}
