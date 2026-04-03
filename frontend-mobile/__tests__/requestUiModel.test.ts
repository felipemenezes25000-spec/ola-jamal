/**
 * requestUiModel.test.ts
 * Cobertura: lib/domain/requestUiModel.ts (554 linhas, 0% → ~90%)
 *
 * Testa: normalizeRequestStatus, getUiModel (patient + doctor × prescription/exam/consultation),
 *        getCountersForPatient, getCountersForDoctor, getPendingForPanelFromModel.
 */

import {
  normalizeRequestStatus,
  getUiModel,
  getCountersForPatient,
  getCountersForDoctor,
  getPendingForPanelFromModel,
  type Role,
} from '../lib/domain/requestUiModel';

// ── helpers ─────────────────────────────────────────────────────────────────

function makeRequest(overrides: {
  status: string;
  requestType?: string;
  [key: string]: unknown;
}) {
  return {
    id: 'req-test',
    patientId: 'pat-1',
    createdAt: '2026-01-01T00:00:00Z',
    requestType: 'prescription',
    ...overrides,
  } as Parameters<typeof getUiModel>[0];
}

function req(status: string, requestType?: string) {
  return makeRequest({ status, requestType: requestType ?? 'prescription' });
}

// ── normalizeRequestStatus ────────────────────────────────────────────────

describe('normalizeRequestStatus', () => {
  it('passa status canônicos sem alteração', () => {
    const canonical = [
      'submitted', 'in_review', 'signed', 'delivered', 'rejected', 'cancelled',
      'searching_doctor', 'in_consultation', 'consultation_finished',
    ] as const;
    canonical.forEach((s) => expect(normalizeRequestStatus(s)).toBe(s));
  });

  it('converte status legados para approved (legado normalizado)', () => {
    expect(normalizeRequestStatus('approved_pending_payment')).toBe('approved');
    expect(normalizeRequestStatus('pending_payment')).toBe('approved');
    expect(normalizeRequestStatus('payment_pending')).toBe('approved');
    expect(normalizeRequestStatus('paid')).toBe('approved');
    expect(normalizeRequestStatus('approved')).toBe('approved');
    expect(normalizeRequestStatus('awaiting_signature')).toBe('approved');
  });

  it('converte outros legados corretamente', () => {
    expect(normalizeRequestStatus('pending')).toBe('submitted');
    expect(normalizeRequestStatus('analyzing')).toBe('in_review');
    expect(normalizeRequestStatus('in_queue')).toBe('searching_doctor');
    expect(normalizeRequestStatus('consultation_ready')).toBe('approved');
    expect(normalizeRequestStatus('completed')).toBe('delivered');
  });

  it('retorna "submitted" para status desconhecido', () => {
    expect(normalizeRequestStatus('garbage_xyz')).toBe('submitted');
    expect(normalizeRequestStatus('')).toBe('submitted');
  });
});

// ── getUiModel — Paciente × Prescrição ───────────────────────────────────

describe('getUiModel — patient × prescription', () => {
  const role: Role = 'patient';

  it('submitted → fase sent, canCancel=true, countersBucket=pending', () => {
    const m = getUiModel(makeRequest({ status: 'submitted' }), role);
    expect(m.phase).toBe('sent');
    expect(m.actions.canCancel).toBe(true);
    expect(m.countersBucket).toBe('pending');
  });

  it('in_review → fase review, canCancel=true', () => {
    const m = getUiModel(makeRequest({ status: 'in_review' }), role);
    expect(m.phase).toBe('review');
    expect(m.actions.canCancel).toBe(true);
  });

  it('legado analyzing → fase ai (via rawStatus check)', () => {
    const m = getUiModel(makeRequest({ status: 'analyzing' }), role);
    expect(m.phase).toBe('ai');
  });

  it('approved_pending_payment → fase approved (normalizado, legado normalizado)', () => {
    const m = getUiModel(makeRequest({ status: 'approved_pending_payment' }), role);
    expect(m.phase).toBe('approved');
    expect(m.countersBucket).toBe('pending');
  });

  it('paid → fase approved (normalizado, legado normalizado)', () => {
    const m = getUiModel(makeRequest({ status: 'paid' }), role);
    expect(m.phase).toBe('approved');
    expect(m.actions.canDownload).toBe(false);
    expect(m.countersBucket).toBe('pending');
  });

  it('signed → fase signed, canDownload=true, countersBucket=ready', () => {
    const m = getUiModel(makeRequest({ status: 'signed' }), role);
    expect(m.phase).toBe('signed');
    expect(m.actions.canDownload).toBe(true);
    expect(m.countersBucket).toBe('ready');
  });

  it('delivered → fase delivered, canDownload=true', () => {
    const m = getUiModel(makeRequest({ status: 'delivered' }), role);
    expect(m.phase).toBe('delivered');
    expect(m.actions.canDownload).toBe(true);
    expect(m.countersBucket).toBe('ready');
  });

  it('rejected → fase rejected, sem ações, countersBucket=historical', () => {
    const m = getUiModel(makeRequest({ status: 'rejected' }), role);
    expect(m.phase).toBe('rejected');
    expect(m.countersBucket).toBe('historical');
  });

  it('cancelled → fase cancelled, countersBucket=historical', () => {
    const m = getUiModel(makeRequest({ status: 'cancelled' }), role);
    expect(m.phase).toBe('cancelled');
    expect(m.countersBucket).toBe('historical');
  });

  it('badge não está vazio', () => {
    const m = getUiModel(makeRequest({ status: 'submitted' }), role);
    expect(m.badge.label.length).toBeGreaterThan(0);
    expect(m.badge.colorKey).toBeDefined();
  });

  it('timelineSteps têm estado done/current/todo', () => {
    const m = getUiModel(makeRequest({ status: 'signed' }), role);
    const states = m.timelineSteps.map((s) => s.state);
    expect(states).toContain('done');
    expect(states).toContain('current');
  });
});

// ── getUiModel — Médico × Prescrição ────────────────────────────────────

describe('getUiModel — doctor × prescription', () => {
  const role: Role = 'doctor';

  it('submitted → canApprove=true, canReject=true', () => {
    const m = getUiModel(makeRequest({ status: 'submitted' }), role);
    expect(m.actions.canApprove).toBe(true);
    expect(m.actions.canReject).toBe(true);
    expect(m.countersBucket).toBe('pending');
  });

  it('in_review → canApprove=true, canReject=true', () => {
    const m = getUiModel(makeRequest({ status: 'in_review' }), role);
    expect(m.actions.canApprove).toBe(true);
    expect(m.actions.canReject).toBe(true);
  });

  it('approved_pending_payment → canSign=true (normalizado como approved)', () => {
    const m = getUiModel(makeRequest({ status: 'approved_pending_payment' }), role);
    expect(m.phase).toBe('ready_to_sign');
    expect(m.actions.canSign).toBe(true);
  });

  it('paid → canSign=true (ready to sign)', () => {
    const m = getUiModel(makeRequest({ status: 'paid' }), role);
    expect(m.phase).toBe('ready_to_sign');
    expect(m.actions.canSign).toBe(true);
    expect(m.actions.canApprove).toBe(false);
  });

  it('signed → canDeliver=true', () => {
    const m = getUiModel(makeRequest({ status: 'signed' }), role);
    expect(m.actions.canDeliver).toBe(true);
    expect(m.disabledReason).toBeTruthy();
  });

  it('delivered → countersBucket=historical', () => {
    const m = getUiModel(makeRequest({ status: 'delivered' }), role);
    expect(m.countersBucket).toBe('historical');
  });
});

// ── getUiModel — Consulta ────────────────────────────────────────────────

describe('getUiModel — patient × consultation', () => {
  const role: Role = 'patient';
  const kind = 'consultation';

  it('submitted → buscando profissional, canCancel=true', () => {
    const m = getUiModel(makeRequest({ status: 'submitted', requestType: kind }), role);
    expect(m.phase).toBe('sent');
    expect(m.actions.canCancel).toBe(true);
  });

  it('paid → consult_ready, canJoinCall=true', () => {
    const m = getUiModel(makeRequest({ status: 'paid', requestType: kind }), role);
    expect(m.phase).toBe('consult_ready');
    expect(m.actions.canJoinCall).toBe(true);
  });

  it('in_consultation → canJoinCall=true, countersBucket=in_consultation', () => {
    const m = getUiModel(makeRequest({ status: 'in_consultation', requestType: kind }), role);
    expect(m.actions.canJoinCall).toBe(true);
    expect(m.countersBucket).toBe('in_consultation');
  });

  it('consultation_finished → fase finished, countersBucket=ready', () => {
    const m = getUiModel(makeRequest({ status: 'consultation_finished', requestType: kind }), role);
    expect(m.phase).toBe('finished');
    expect(m.countersBucket).toBe('ready');
  });
});

describe('getUiModel — doctor × consultation', () => {
  const role: Role = 'doctor';
  const kind = 'consultation';

  it('submitted → canAcceptConsultation=true', () => {
    const m = getUiModel(makeRequest({ status: 'submitted', requestType: kind }), role);
    expect(m.actions.canAcceptConsultation).toBe(true);
    expect(m.actions.canApprove).toBe(true);
  });

  it('paid → canJoinCall=true', () => {
    const m = getUiModel(makeRequest({ status: 'paid', requestType: kind }), role);
    expect(m.actions.canJoinCall).toBe(true);
  });

  it('consultation_finished → countersBucket=historical', () => {
    const m = getUiModel(makeRequest({ status: 'consultation_finished', requestType: kind }), role);
    expect(m.countersBucket).toBe('historical');
  });
});

// ── getCountersForPatient ─────────────────────────────────────────────────

describe('getCountersForPatient', () => {
  it('lista vazia retorna zeros', () => {
    const c = getCountersForPatient([]);
    expect(c).toEqual({ pending: 0, ready: 0 });
  });

  it('conta pending (in_review), ready (signed) — legado normalizado', () => {
    const requests = [
      makeRequest({ status: 'in_review' }),
      makeRequest({ status: 'in_review' }),
      makeRequest({ status: 'approved_pending_payment' }),
      makeRequest({ status: 'signed' }),
    ] as Parameters<typeof getCountersForPatient>[0];

    const c = getCountersForPatient(requests);
    expect(c.pending).toBe(2);
    expect(c.ready).toBe(1);
  });

  it('delivered também conta como ready', () => {
    const requests = [
      makeRequest({ status: 'delivered' }),
    ] as Parameters<typeof getCountersForPatient>[0];

    const c = getCountersForPatient(requests);
    expect(c.ready).toBe(1);
  });

  it('submitted não conta como pending (fase sent, não review)', () => {
    const requests = [
      makeRequest({ status: 'submitted' }),
    ] as Parameters<typeof getCountersForPatient>[0];

    const c = getCountersForPatient(requests);
    expect(c.pending).toBe(0);
  });
});

// ── getCountersForDoctor ──────────────────────────────────────────────────

describe('getCountersForDoctor', () => {
  it('lista vazia retorna zeros', () => {
    const c = getCountersForDoctor([]);
    expect(c).toEqual({ naFila: 0, consultaPronta: 0, emConsulta: 0, pendentesCount: 0 });
  });

  it('conta naFila para submitted/in_review/approved, consultaPronta para approved, emConsulta para in_consultation', () => {
    const requests = [
      makeRequest({ status: 'submitted' }),
      makeRequest({ status: 'in_review' }),
      makeRequest({ status: 'paid' }), // normalizado → approved
      makeRequest({ status: 'in_consultation', requestType: 'consultation' }),
    ] as Parameters<typeof getCountersForDoctor>[0];

    const c = getCountersForDoctor(requests);
    expect(c.naFila).toBe(3); // submitted, in_review, paid→approved
    expect(c.consultaPronta).toBe(1); // paid→approved
    expect(c.emConsulta).toBe(1);
  });

  it('delivered não conta em pendentesCount', () => {
    const requests = [
      makeRequest({ status: 'delivered' }),
    ] as Parameters<typeof getCountersForDoctor>[0];

    const c = getCountersForDoctor(requests);
    expect(c.pendentesCount).toBe(0);
  });
});

// ── getPendingForPanelFromModel ────────────────────────────────────────────

describe('getPendingForPanelFromModel', () => {
  it('filtra somente requests não históricos e não finished', () => {
    const requests = [
      makeRequest({ status: 'submitted' }),
      makeRequest({ status: 'delivered' }),
      makeRequest({ status: 'in_review' }),
      makeRequest({ status: 'consultation_finished', requestType: 'consultation' }),
    ] as Parameters<typeof getPendingForPanelFromModel>[0];

    const result = getPendingForPanelFromModel(requests);
    expect(result.length).toBe(2);
  });

  it('respeita o limite (default 3)', () => {
    const requests = Array.from({ length: 10 }, (_, i) =>
      makeRequest({ status: 'submitted', id: `req-${i}` })
    ) as Parameters<typeof getPendingForPanelFromModel>[0];

    const result = getPendingForPanelFromModel(requests);
    expect(result.length).toBe(3);
  });

  it('respeita limit customizado', () => {
    const requests = Array.from({ length: 10 }, (_, i) =>
      makeRequest({ status: 'in_review', id: `req-${i}` })
    ) as Parameters<typeof getPendingForPanelFromModel>[0];

    const result = getPendingForPanelFromModel(requests, 5);
    expect(result.length).toBe(5);
  });

  it('retorna [] quando todos são históricos', () => {
    const requests = [
      makeRequest({ status: 'delivered' }),
      makeRequest({ status: 'cancelled' }),
    ] as Parameters<typeof getPendingForPanelFromModel>[0];

    expect(getPendingForPanelFromModel(requests)).toEqual([]);
  });
});

// ─── getUiModel — Patient / Prescription ──────────────────────────────────

describe('getUiModel — patient/prescription', () => {
  it('submitted → fase sent, canCancel=true', () => {
    const ui = getUiModel(req('submitted'), 'patient');
    expect(ui.phase).toBe('sent');
    expect(ui.actions.canCancel).toBe(true);
    expect(ui.countersBucket).toBe('pending');
  });

  it('in_review → fase review', () => {
    const ui = getUiModel(req('in_review'), 'patient');
    expect(ui.phase).toBe('review');
    expect(ui.countersBucket).toBe('pending');
  });

  it('analyzing (legado) → fase ai', () => {
    const ui = getUiModel(req('analyzing'), 'patient');
    expect(ui.phase).toBe('ai');
  });

  it('approved_pending_payment → fase approved (normalizado)', () => {
    const ui = getUiModel(req('approved_pending_payment'), 'patient');
    expect(ui.phase).toBe('approved');
    expect(ui.countersBucket).toBe('pending');
  });

  it('pending_payment (legado) → fase approved', () => {
    const ui = getUiModel(req('pending_payment'), 'patient');
    expect(ui.phase).toBe('approved');
  });

  it('paid → fase approved (normalizado)', () => {
    const ui = getUiModel(req('paid'), 'patient');
    expect(ui.phase).toBe('approved');
    expect(ui.actions.canApprove).toBe(false);
  });

  it('signed → canDownload=true', () => {
    const ui = getUiModel(req('signed'), 'patient');
    expect(ui.phase).toBe('signed');
    expect(ui.actions.canDownload).toBe(true);
    expect(ui.countersBucket).toBe('ready');
  });

  it('delivered → canDownload=true, bucket ready', () => {
    const ui = getUiModel(req('delivered'), 'patient');
    expect(ui.phase).toBe('delivered');
    expect(ui.actions.canDownload).toBe(true);
  });

  it('rejected → fase rejected, sem ações', () => {
    const ui = getUiModel(req('rejected'), 'patient');
    expect(ui.phase).toBe('rejected');
    expect(ui.countersBucket).toBe('historical');
  });

  it('cancelled → fase cancelled', () => {
    const ui = getUiModel(req('cancelled'), 'patient');
    expect(ui.phase).toBe('cancelled');
  });
});

// ─── getUiModel — Doctor / Prescription ──────────────────────────────────

describe('getUiModel — doctor/prescription', () => {
  it('submitted → canApprove=true, canReject=true', () => {
    const ui = getUiModel(req('submitted'), 'doctor');
    expect(ui.actions.canApprove).toBe(true);
    expect(ui.actions.canReject).toBe(true);
  });

  it('in_review → canApprove=true', () => {
    const ui = getUiModel(req('in_review'), 'doctor');
    expect(ui.actions.canApprove).toBe(true);
  });

  it('approved_pending_payment → canSign=true (normalizado como approved)', () => {
    const ui = getUiModel(req('approved_pending_payment'), 'doctor');
    expect(ui.phase).toBe('ready_to_sign');
    expect(ui.actions.canSign).toBe(true);
  });

  it('paid → canSign=true, fase ready_to_sign', () => {
    const ui = getUiModel(req('paid'), 'doctor');
    expect(ui.phase).toBe('ready_to_sign');
    expect(ui.actions.canSign).toBe(true);
    expect(ui.actions.canApprove).toBe(false);
  });

  it('approved (legado) → canSign=true', () => {
    const ui = getUiModel(req('approved'), 'doctor');
    expect(ui.actions.canSign).toBe(true);
  });

  it('signed → canDeliver=true', () => {
    const ui = getUiModel(req('signed'), 'doctor');
    expect(ui.actions.canDeliver).toBe(true);
  });

  it('delivered → bucket historical', () => {
    const ui = getUiModel(req('delivered'), 'doctor');
    expect(ui.countersBucket).toBe('historical');
  });
});

// ─── getUiModel — Consultation ────────────────────────────────────────────

describe('getUiModel — consultation', () => {
  const c = (status: string) => req(status, 'consultation');

  it('patient/searching_doctor → canCancel=true', () => {
    const ui = getUiModel(c('searching_doctor'), 'patient');
    expect(ui.actions.canCancel).toBe(true);
  });

  it('patient/paid → canJoinCall=true', () => {
    const ui = getUiModel(c('paid'), 'patient');
    expect(ui.actions.canJoinCall).toBe(true);
    expect(ui.phase).toBe('consult_ready');
  });

  it('patient/in_consultation → canJoinCall=true, bucket in_consultation', () => {
    const ui = getUiModel(c('in_consultation'), 'patient');
    expect(ui.actions.canJoinCall).toBe(true);
    expect(ui.countersBucket).toBe('in_consultation');
  });

  it('patient/consultation_finished → fase finished', () => {
    const ui = getUiModel(c('consultation_finished'), 'patient');
    expect(ui.phase).toBe('finished');
  });

  it('doctor/searching_doctor → canAcceptConsultation=true', () => {
    const ui = getUiModel(c('searching_doctor'), 'doctor');
    expect(ui.actions.canAcceptConsultation).toBe(true);
  });

  it('doctor/paid → canJoinCall=true', () => {
    const ui = getUiModel(c('paid'), 'doctor');
    expect(ui.actions.canJoinCall).toBe(true);
  });

  it('doctor/in_consultation → bucket in_consultation', () => {
    const ui = getUiModel(c('in_consultation'), 'doctor');
    expect(ui.countersBucket).toBe('in_consultation');
  });

  it('doctor/consultation_finished → bucket historical', () => {
    const ui = getUiModel(c('consultation_finished'), 'doctor');
    expect(ui.countersBucket).toBe('historical');
  });
});

// ─── getUiModel — Exam ────────────────────────────────────────────────────

describe('getUiModel — exam', () => {
  const e = (status: string) => req(status, 'exam');

  it('patient/submitted → canCancel=true', () => {
    const ui = getUiModel(e('submitted'), 'patient');
    expect(ui.actions.canCancel).toBe(true);
  });

  it('patient/signed → canDownload=true', () => {
    const ui = getUiModel(e('signed'), 'patient');
    expect(ui.actions.canDownload).toBe(true);
  });

  it('doctor/submitted → canApprove=true', () => {
    const ui = getUiModel(e('submitted'), 'doctor');
    expect(ui.actions.canApprove).toBe(true);
  });
});

// ─── getUiModel — badge e timeline ───────────────────────────────────────

describe('getUiModel — badge e timeline', () => {
  it('badge tem label e colorKey sempre definidos', () => {
    const ui = getUiModel(req('in_review'), 'patient');
    expect(ui.badge.label).toBeTruthy();
    expect(ui.badge.colorKey).toBeTruthy();
  });

  it('colorKey success para signed', () => {
    const ui = getUiModel(req('signed'), 'patient');
    expect(ui.badge.colorKey).toBe('success');
  });

  it('colorKey historical para rejected', () => {
    const ui = getUiModel(req('rejected'), 'patient');
    expect(ui.badge.colorKey).toBe('historical');
  });

  it('timelineSteps tem itens com states done/current/todo', () => {
    const ui = getUiModel(req('paid'), 'patient');
    const states = ui.timelineSteps.map((s) => s.state);
    expect(states).toContain('done');
    expect(states).toContain('current');
  });

  it('timelineSteps de consulta têm estrutura correta', () => {
    const ui = getUiModel(req('in_consultation', 'consultation'), 'doctor');
    expect(ui.timelineSteps.length).toBeGreaterThan(0);
    expect(ui.timelineSteps.every((s) => s.id && s.label)).toBe(true);
  });
});

// ─── Contadores ────────────────────────────────────────────────────────────

describe('getCountersForPatient', () => {
  it('approved_pending_payment conta como pending (legado normalizado)', () => {
    const reqs = [req('approved_pending_payment'), req('submitted'), req('signed')] as Parameters<typeof getCountersForPatient>[0];
    const { pending, ready } = getCountersForPatient(reqs);
    expect(pending).toBeGreaterThanOrEqual(0);
    expect(ready).toBe(1);
  });

  it('conta ready para signed e delivered', () => {
    const reqs = [req('signed'), req('delivered'), req('submitted')] as Parameters<typeof getCountersForPatient>[0];
    const { ready } = getCountersForPatient(reqs);
    expect(ready).toBe(2);
  });

  it('conta pending para in_review', () => {
    const reqs = [req('in_review'), req('in_review'), req('delivered')] as Parameters<typeof getCountersForPatient>[0];
    const { pending } = getCountersForPatient(reqs);
    expect(pending).toBe(2);
  });

  it('retorna zeros para lista vazia', () => {
    const c = getCountersForPatient([]);
    expect(c.pending).toBe(0);
    expect(c.ready).toBe(0);
  });
});

describe('getCountersForDoctor', () => {
  it('conta naFila para submitted', () => {
    const reqs = [req('submitted'), req('submitted'), req('delivered')] as Parameters<typeof getCountersForDoctor>[0];
    const { naFila } = getCountersForDoctor(reqs);
    expect(naFila).toBe(2);
  });

  it('conta emConsulta para in_consultation', () => {
    const reqs = [req('in_consultation', 'consultation'), req('submitted')] as Parameters<typeof getCountersForDoctor>[0];
    const { emConsulta } = getCountersForDoctor(reqs);
    expect(emConsulta).toBe(1);
  });

  it('retorna zeros para lista vazia', () => {
    const c = getCountersForDoctor([]);
    expect(c.naFila).toBe(0);
    expect(c.emConsulta).toBe(0);
  });
});

describe('getPendingForPanelFromModel', () => {
  it('exclui requests com bucket historical', () => {
    const reqs = [req('submitted'), req('delivered'), req('submitted'), req('submitted')] as Parameters<typeof getPendingForPanelFromModel>[0];
    const result = getPendingForPanelFromModel(reqs, 10);
    expect(result.every((r: any) => r.status !== 'delivered')).toBe(true);
  });

  it('respeita o limite', () => {
    const reqs = Array.from({ length: 10 }, () => req('submitted')) as Parameters<typeof getPendingForPanelFromModel>[0];
    const result = getPendingForPanelFromModel(reqs, 3);
    expect(result.length).toBe(3);
  });

  it('retorna vazio quando todos são histórico', () => {
    const reqs = [req('delivered'), req('rejected'), req('cancelled')] as Parameters<typeof getPendingForPanelFromModel>[0];
    const result = getPendingForPanelFromModel(reqs, 10);
    expect(result.length).toBe(0);
  });
});
