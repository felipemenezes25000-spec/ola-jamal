/**
 * triageRulesEngine.full.test.ts
 * Cobertura: lib/triage/triageRulesEngine.ts (775 linhas, 60% → ~92%)
 *
 * Testa todos os contextos e branches não cobertos pelo test existente:
 * - rulesHome (todos os branches proativos)
 * - rulesPrescription (todos os steps)
 * - rulesExam (todos os steps + hasComplexExams)
 * - rulesConsultation
 * - rulesDetail
 * - rulesRequests
 * - rulesRecord
 * - rulesProfile / rulesHelp
 * - rulesDoctorDashboard / rulesDoctorDetail / rulesDoctorProntuario
 * - BLOCKED_STEPS
 * - role=doctor fora de contexto próprio → null
 * - companionFallback para contexto desconhecido
 */

import { evaluateTriageRules } from '../lib/triage/triageRulesEngine';
import type { TriageInput } from '../lib/triage/triage.types';

// ── base input factory ───────────────────────────────────────────────────

function base(overrides: Partial<TriageInput> = {}): TriageInput {
  return {
    context: 'home',
    step: 'entry',
    role: 'patient',
    totalRequests: 0,
    ...overrides,
  } as TriageInput;
}

// ── BLOCKED STEPS ────────────────────────────────────────────────────────

describe('evaluateTriageRules — blocked steps', () => {
  it('retorna null em step=signing', () => {
    expect(evaluateTriageRules(base({ step: 'signing' }))).toBeNull();
  });
});

// ── ROLE GUARD ────────────────────────────────────────────────────────────

describe('evaluateTriageRules — doctor fora de contexto médico', () => {
  it('retorna null para doctor em context=home', () => {
    expect(evaluateTriageRules(base({ role: 'doctor', context: 'home' }))).toBeNull();
  });
  it('retorna null para doctor em context=prescription', () => {
    expect(evaluateTriageRules(base({ role: 'doctor', context: 'prescription' }))).toBeNull();
  });
  it('NÃO retorna null para doctor em context=doctor_dashboard', () => {
    const r = evaluateTriageRules(base({ role: 'doctor', context: 'doctor_dashboard' }));
    // pode ser companion ou mensagem real, mas não null
    expect(r).not.toBeNull();
  });
  it('NÃO retorna null para doctor em context=help', () => {
    const r = evaluateTriageRules(base({ role: 'doctor', context: 'help' }));
    expect(r).not.toBeNull();
  });
});

// ── HOME ─────────────────────────────────────────────────────────────────

describe('rulesHome', () => {
  it('sem requests → welcome (key home:welcome)', () => {
    const r = evaluateTriageRules(base({ totalRequests: 0 }));
    expect(r?.key).toBe('home:welcome');
    expect(r?.severity).toBe('positive');
  });

  it('receita com ≥25 dias → home:renew_prescription', () => {
    const r = evaluateTriageRules(base({
      totalRequests: 2,
      lastPrescriptionDaysAgo: 25,
      recentPrescriptionCount: 1,
    }));
    expect(r?.key).toBe('home:renew_prescription');
    expect(r?.cta).toBe('renovar_receita');
  });

  it('exame com ≥180 dias → home:renew_exam', () => {
    const r = evaluateTriageRules(base({
      totalRequests: 2,
      lastExamDaysAgo: 180,
      recentExamCount: 1,
    }));
    expect(r?.key).toBe('home:renew_exam');
  });

  it('paciente ≥40 anos sem exame recente → home:routine_exams_age', () => {
    const r = evaluateTriageRules(base({
      totalRequests: 1,
      patientAge: 40,
      lastExamDaysAgo: 400,
    }));
    expect(r?.key).toBe('home:routine_exams_age');
  });

  it('≥3 prescrições recentes → home:many_renewals (atenção)', () => {
    const r = evaluateTriageRules(base({
      totalRequests: 5,
      recentPrescriptionCount: 3,
    }));
    expect(r?.key).toBe('home:many_renewals');
    expect(r?.severity).toBe('attention');
    expect(r?.cta).toBe('teleconsulta');
  });

  it('≥5 medicamentos únicos sem consulta recente → home:medication_review', () => {
    const r = evaluateTriageRules(base({
      totalRequests: 4,
      recentMedications: ['Losartana', 'Metformina', 'Atorvastatina', 'AAS', 'Omeprazol'],
      lastConsultationDays: 61,
    }));
    expect(r?.key).toBe('home:medication_review');
  });

  it('≥2 exames recentes → home:pending_results', () => {
    const r = evaluateTriageRules(base({
      totalRequests: 3,
      recentExamCount: 2,
    }));
    expect(r?.key).toBe('home:pending_results');
  });

  it('sem consulta há >180 dias → home:long_no_consult', () => {
    const r = evaluateTriageRules(base({
      totalRequests: 2,
      lastConsultationDays: 181,
    }));
    expect(r?.key).toBe('home:long_no_consult');
  });

  it('usuário sem dados relevantes → companion fallback', () => {
    const r = evaluateTriageRules(base({ totalRequests: 1 }));
    expect(r?.key).toBe('home:companion');
  });
});

// ── PRESCRIPTION ──────────────────────────────────────────────────────────

describe('rulesPrescription', () => {
  const ctx = (step: string, extra: Partial<TriageInput> = {}) =>
    base({ context: 'prescription', step: step as TriageInput['step'], totalRequests: 1, ...extra });

  it('step=entry → rx:entry', () => {
    expect(evaluateTriageRules(ctx('entry'))?.key).toBe('rx:entry');
  });

  it('step=type_selected + receita simples → rx:simple', () => {
    const r = evaluateTriageRules(ctx('type_selected', { prescriptionType: 'receita_simples' }));
    expect(r?.key).toBe('rx:simple');
    expect(r?.severity).toBe('positive');
  });

  it('step=type_selected + controlado → rx:controlled:controlado (attention)', () => {
    const r = evaluateTriageRules(ctx('type_selected', { prescriptionType: 'controlado' }));
    expect(r?.key).toContain('controlled');
    expect(r?.severity).toBe('attention');
  });

  it('step=type_selected + azul → rx:controlled:azul', () => {
    const r = evaluateTriageRules(ctx('type_selected', { prescriptionType: 'azul' }));
    expect(r?.key).toContain('controlled');
    expect(r?.text).toContain('azul');
  });

  it('step=photos_added com 1 foto → texto singular', () => {
    const r = evaluateTriageRules(ctx('photos_added', { imagesCount: 1 }));
    expect(r?.key).toBe('rx:photos');
    expect(r?.text).toContain('Foto adicionada');
  });

  it('step=photos_added com 3 fotos → texto plural', () => {
    const r = evaluateTriageRules(ctx('photos_added', { imagesCount: 3 }));
    expect(r?.text).toContain('3 fotos');
  });

  it('step=photos_added com 0 fotos → null', () => {
    expect(evaluateTriageRules(ctx('photos_added', { imagesCount: 0 }))).toBeNull();
  });

  it('step=analyzing → rx:analyzing (thinking)', () => {
    const r = evaluateTriageRules(ctx('analyzing'));
    expect(r?.key).toBe('rx:analyzing');
    expect(r?.avatarState).toBe('thinking');
  });

  it('step=result + aiRiskLevel=high → rx:high_risk', () => {
    const r = evaluateTriageRules(ctx('result', { aiRiskLevel: 'high' }));
    expect(r?.key).toBe('rx:high_risk');
    expect(r?.severity).toBe('attention');
  });

  it('step=result + sintomas red_flag → rx:red_flags_symptoms', () => {
    const r = evaluateTriageRules(ctx('result', { symptoms: 'dor no peito intensa' }));
    expect(r?.key).toBe('rx:red_flags_symptoms');
  });

  it('step=result + aiReadabilityOk=false → rx:unreadable', () => {
    const r = evaluateTriageRules(ctx('result', { aiReadabilityOk: false }));
    expect(r?.key).toBe('rx:unreadable');
  });

  it('step=result + aiMessageToUser → rx:ai_message com até 120 chars', () => {
    const long = 'A'.repeat(200);
    const r = evaluateTriageRules(ctx('result', { aiMessageToUser: long }));
    expect(r?.key).toBe('rx:ai_message');
    expect(r?.text.length).toBeLessThanOrEqual(120);
  });

  it('step=result sem flags → rx:success', () => {
    const r = evaluateTriageRules(ctx('result'));
    expect(r?.key).toBe('rx:success');
    expect(r?.severity).toBe('positive');
  });

  it('step desconhecido → companion prescription', () => {
    const r = evaluateTriageRules(ctx('unknown_step_xyz'));
    expect(r?.key).toBe('prescription:companion');
  });
});

// ── EXAM ─────────────────────────────────────────────────────────────────

describe('rulesExam', () => {
  const ctx = (step: string, extra: Partial<TriageInput> = {}) =>
    base({ context: 'exam', step: step as TriageInput['step'], totalRequests: 1, ...extra });

  it('step=entry → exam:entry', () => {
    expect(evaluateTriageRules(ctx('entry'))?.key).toBe('exam:entry');
  });

  it('step=type_selected + imagem → exam:imagem', () => {
    const r = evaluateTriageRules(ctx('type_selected', { examType: 'imagem' }));
    expect(r?.key).toBe('exam:imagem');
  });

  it('step=result + aiRiskLevel=high → exam:high_risk', () => {
    const r = evaluateTriageRules(ctx('result', { aiRiskLevel: 'high' }));
    expect(r?.key).toBe('exam:high_risk');
  });

  it('step=result + ressonância → exam:complex', () => {
    const r = evaluateTriageRules(ctx('result', { exams: ['ressonância magnética', 'hemograma'] }));
    expect(r?.key).toBe('exam:complex');
  });

  it('step=result + tomografia (sem acento) → exam:complex', () => {
    const r = evaluateTriageRules(ctx('result', { exams: ['tomografia de torax'] }));
    expect(r?.key).toBe('exam:complex');
  });

  it('step=result + >5 exames → exam:many com count no texto', () => {
    const r = evaluateTriageRules(ctx('result', {
      exams: ['a', 'b', 'c', 'd', 'e', 'f'],
    }));
    expect(r?.key).toBe('exam:many');
    expect(r?.text).toContain('6');
  });

  it('step=result + red flag symptom → exam:red_flags_symptoms', () => {
    const r = evaluateTriageRules(ctx('result', { symptoms: 'falta de ar grave' }));
    expect(r?.key).toBe('exam:red_flags_symptoms');
  });

  it('step=result sem flags → exam:ok', () => {
    const r = evaluateTriageRules(ctx('result', { exams: ['hemograma'] }));
    expect(r?.key).toBe('exam:ok');
  });
});

// ── CONSULTATION ──────────────────────────────────────────────────────────

describe('rulesConsultation', () => {
  const ctx = (step: string, extra: Partial<TriageInput> = {}) =>
    base({ context: 'consultation', step: step as TriageInput['step'], ...extra });

  it('step=entry → consult:entry', () => {
    expect(evaluateTriageRules(ctx('entry'))?.key).toBe('consult:entry');
  });

  it('step=symptoms_entered + red flag → consult:red_flags', () => {
    const r = evaluateTriageRules(ctx('symptoms_entered', { symptoms: 'desmaio súbito' }));
    expect(r?.key).toBe('consult:red_flags');
    expect(r?.severity).toBe('attention');
  });

  it('step=symptoms_entered + sintomas curtos → consult:short_symptoms', () => {
    const r = evaluateTriageRules(ctx('symptoms_entered', { symptoms: 'dor' }));
    expect(r?.key).toBe('consult:short_symptoms');
  });

  it('step=symptoms_entered + sintomas longos sem red flag → companion', () => {
    const r = evaluateTriageRules(ctx('symptoms_entered', {
      symptoms: 'Tenho dor de cabeça há três dias que piora com luz',
    }));
    expect(r?.key).toBe('consultation:companion');
  });
});

// ── DETAIL ────────────────────────────────────────────────────────────────

describe('rulesDetail', () => {
  const ctx = (extra: Partial<TriageInput> = {}) =>
    base({ context: 'detail', step: 'entry', ...extra });

  it('status=approved + prescription → detail:awaiting_signature_prescription', () => {
    const r = evaluateTriageRules(ctx({ status: 'approved', requestType: 'prescription' }));
    expect(r?.key).toBe('detail:awaiting_signature_prescription');
  });

  it('status=approved + exam → detail:awaiting_signature_exam', () => {
    const r = evaluateTriageRules(ctx({ status: 'approved', requestType: 'exam' }));
    expect(r?.key).toBe('detail:awaiting_signature_exam');
  });

  it('status=approved + consultation → detail:consultation_ready', () => {
    const r = evaluateTriageRules(ctx({ status: 'approved', requestType: 'consultation' }));
    expect(r?.key).toBe('detail:consultation_ready');
  });

  it('doctorConductNotes preenchido → detail:conduct_available', () => {
    const r = evaluateTriageRules(ctx({ doctorConductNotes: 'Repouso e hidratação.' }));
    expect(r?.key).toBe('detail:conduct_available');
  });

  it('status=signed → detail:completed', () => {
    const r = evaluateTriageRules(ctx({ status: 'signed' }));
    expect(r?.key).toBe('detail:completed');
  });

  it('status=delivered → detail:completed', () => {
    const r = evaluateTriageRules(ctx({ status: 'delivered' }));
    expect(r?.key).toBe('detail:completed');
  });

  it('sem condições especiais → companion detail', () => {
    const r = evaluateTriageRules(ctx());
    expect(r?.key).toBe('detail:companion');
  });
});

// ── REQUESTS ──────────────────────────────────────────────────────────────

describe('rulesRequests', () => {
  it('step=entry + 0 requests → requests:empty', () => {
    const r = evaluateTriageRules(base({ context: 'requests', step: 'entry', totalRequests: 0 }));
    expect(r?.key).toBe('requests:empty');
  });

  it('step=entry + requests → companion requests', () => {
    const r = evaluateTriageRules(base({ context: 'requests', step: 'entry', totalRequests: 2 }));
    expect(r?.key).toBe('requests:companion');
  });

  it('step!=entry → companion requests', () => {
    const r = evaluateTriageRules(base({ context: 'requests', step: 'result', totalRequests: 1 }));
    expect(r?.key).toBe('requests:companion');
  });
});

// ── RECORD ────────────────────────────────────────────────────────────────

describe('rulesRecord', () => {
  const ctx = (extra: Partial<TriageInput> = {}) =>
    base({ context: 'record', step: 'entry', totalRequests: 2, ...extra });

  it('receita ≥25 dias → record:renew_prescription', () => {
    const r = evaluateTriageRules(ctx({ lastPrescriptionDaysAgo: 30, recentPrescriptionCount: 1 }));
    expect(r?.key).toBe('record:renew_prescription');
  });

  it('≥40 anos sem exame há >365 dias → record:routine_exams', () => {
    const r = evaluateTriageRules(ctx({ patientAge: 42, lastExamDaysAgo: 400 }));
    expect(r?.key).toBe('record:routine_exams');
  });

  it('≥5 medicamentos sem consulta recente → record:medication_review', () => {
    const r = evaluateTriageRules(ctx({
      recentMedications: ['A', 'B', 'C', 'D', 'E'],
      lastConsultationDays: 90,
    }));
    expect(r?.key).toBe('record:medication_review');
  });

  it('sem condições especiais → record:entry', () => {
    const r = evaluateTriageRules(ctx());
    expect(r?.key).toBe('record:entry');
  });

  it('step!=entry → null', () => {
    expect(evaluateTriageRules(base({ context: 'record', step: 'result' }))).toBeNull();
  });
});

// ── PROFILE / HELP ────────────────────────────────────────────────────────

describe('rulesProfile e rulesHelp', () => {
  it('profile step=entry → profile:entry', () => {
    expect(evaluateTriageRules(base({ context: 'profile', step: 'entry' }))?.key).toBe('profile:entry');
  });

  it('help step=entry → help:entry', () => {
    expect(evaluateTriageRules(base({ context: 'help', step: 'entry' }))?.key).toBe('help:entry');
  });

  it('help step!=entry → companion help', () => {
    expect(evaluateTriageRules(base({ context: 'help', step: 'result' }))?.key).toBe('help:companion');
  });
});

// ── DOCTOR DASHBOARD ─────────────────────────────────────────────────────

describe('rulesDoctorDashboard', () => {
  const ctx = (extra: Partial<TriageInput> = {}) =>
    base({ context: 'doctor_dashboard', role: 'doctor', step: 'entry', ...extra });

  it('sem certificado → doctor:dashboard:no_certificate (attention)', () => {
    const r = evaluateTriageRules(ctx({ doctorHasCertificate: false }));
    expect(r?.key).toBe('doctor:dashboard:no_certificate');
    expect(r?.severity).toBe('attention');
  });

  it('doctorToSignCount>0 → doctor:dashboard:to_sign com count', () => {
    const r = evaluateTriageRules(ctx({ doctorHasCertificate: true, doctorToSignCount: 3 }));
    expect(r?.key).toBe('doctor:dashboard:to_sign');
    expect(r?.text).toContain('3');
  });

  it('doctorPendingCount>0 → doctor:dashboard:pending com count', () => {
    const r = evaluateTriageRules(ctx({ doctorHasCertificate: true, doctorToSignCount: 0, doctorPendingCount: 5 }));
    expect(r?.key).toBe('doctor:dashboard:pending');
    expect(r?.text).toContain('5');
  });

  it('sem condições → companion doctor_dashboard', () => {
    const r = evaluateTriageRules(ctx({ doctorHasCertificate: true }));
    expect(r?.key).toBe('doctor_dashboard:companion');
  });
});

// ── DOCTOR DETAIL ─────────────────────────────────────────────────────────

describe('rulesDoctorDetail', () => {
  const ctx = (extra: Partial<TriageInput> = {}) =>
    base({ context: 'doctor_detail', role: 'doctor', step: 'entry', ...extra });

  it('aiRiskLevel=high → doctor:detail:high_risk', () => {
    const r = evaluateTriageRules(ctx({ aiRiskLevel: 'high' }));
    expect(r?.key).toBe('doctor:detail:high_risk');
    expect(r?.severity).toBe('attention');
  });

  it('status=paid + prescription → doctor:detail:paid:prescription', () => {
    const r = evaluateTriageRules(ctx({ status: 'paid', requestType: 'prescription' }));
    expect(r?.key).toBe('doctor:detail:paid:prescription');
  });

  it('status=paid + consultation → doctor:detail:paid', () => {
    const r = evaluateTriageRules(ctx({ status: 'paid', requestType: 'consultation' }));
    expect(r?.key).toBe('doctor:detail:paid');
  });

  it('sem aiSummary → doctor:detail:no_ai_summary', () => {
    const r = evaluateTriageRules(ctx({ aiSummaryForDoctor: undefined }));
    expect(r?.key).toBe('doctor:detail:no_ai_summary');
    expect(r?.avatarState).toBe('thinking');
  });

  it('com aiSummary e sem condições → null', () => {
    const r = evaluateTriageRules(ctx({ aiSummaryForDoctor: 'Resumo clínico...' }));
    expect(r).toBeNull();
  });
});

// ── DOCTOR PRONTUÁRIO ─────────────────────────────────────────────────────

describe('rulesDoctorProntuario', () => {
  const ctx = (extra: Partial<TriageInput> = {}) =>
    base({ context: 'doctor_prontuario', role: 'doctor', step: 'entry', ...extra });

  it('≥3 prescrições + sem consulta há >90 dias → doctor:prontuario:many_renewals', () => {
    const r = evaluateTriageRules(ctx({ recentPrescriptionCount: 3, lastConsultationDays: 91 }));
    expect(r?.key).toBe('doctor:prontuario:many_renewals');
    expect(r?.text).toContain('3');
  });

  it('≥2 exames + sem consulta há >180 dias → doctor:prontuario:exams_no_consult', () => {
    const r = evaluateTriageRules(ctx({ recentExamCount: 2, lastConsultationDays: 190 }));
    expect(r?.key).toBe('doctor:prontuario:exams_no_consult');
    expect(r?.text).toContain('190');
  });

  it('sem condições → companion doctor_prontuario', () => {
    const r = evaluateTriageRules(ctx());
    expect(r?.key).toBe('doctor_prontuario:companion');
  });
});

// ── CONTEXT DESCONHECIDO ──────────────────────────────────────────────────

describe('context desconhecido', () => {
  it('retorna companion fallback de home', () => {
    const r = evaluateTriageRules(base({ context: 'unknown_context_xyz' as TriageInput['context'] }));
    expect(r?.key).toBe('home:companion');
  });
});
