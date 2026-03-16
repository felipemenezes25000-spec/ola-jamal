/**
 * homeStats.test.ts
 *
 * Testa a lógica de derivação de stats e followUpRequest da tela home do paciente.
 * Essa lógica está no useMemo `derived` de home.tsx — extraída aqui como funções
 * puras para ser testada sem render.
 */

import type { RequestResponseDto } from '../types/database';

// ── Funções extraídas do useMemo `derived` em home.tsx ───────────────────────
// (Testar aqui evita dependência de render e permite cobertura isolada)

function isSignedOrDelivered(r: RequestResponseDto): boolean {
  return r.status === 'signed' || r.status === 'delivered';
}

const TERMINAL_STATUSES = ['delivered', 'consultation_finished', 'rejected', 'cancelled'];

const PRIORITY_MAP: Record<string, number> = {
  approved: 100,
  signed: 90,
  in_review: 80,
  submitted: 70,
  searching_doctor: 65,
  in_consultation: 50,
};

function deriveStats(requests: RequestResponseDto[]) {
  let pending = 0, ready = 0;
  let prescriptionCount = 0, examCount = 0;
  let lastConsultation: RequestResponseDto | null = null;
  let lastSignedPrescription: RequestResponseDto | null = null;
  const medsSet = new Set<string>();
  let followUpRequest: RequestResponseDto | null = null;
  let followUpPriority = -1;
  const msDay = 24 * 60 * 60 * 1000;

  for (const r of requests) {
    if (r.status === 'in_review' || r.status === 'submitted') pending++;
    if (isSignedOrDelivered(r)) ready++;

    if (r.requestType === 'prescription') {
      prescriptionCount++;
      r.medications?.forEach((m: unknown) => m && medsSet.add(String(m)));
      if (isSignedOrDelivered(r)) {
        const d = new Date(r.signedAt ?? r.updatedAt).getTime();
        if (!lastSignedPrescription || d > new Date(lastSignedPrescription.signedAt ?? lastSignedPrescription.updatedAt).getTime()) {
          lastSignedPrescription = r;
        }
      }
    }
    if (r.requestType === 'exam') examCount++;
    if (r.requestType === 'consultation') {
      if (!lastConsultation || new Date(r.createdAt).getTime() > new Date(lastConsultation.createdAt).getTime()) {
        lastConsultation = r;
      }
    }

    if (!TERMINAL_STATUSES.includes(r.status)) {
      const p = PRIORITY_MAP[r.status] ?? 0;
      if (p > followUpPriority) {
        followUpPriority = p;
        followUpRequest = r;
      }
    }
  }

  const daysAgo = (r: RequestResponseDto | null) => {
    if (!r) return undefined;
    const ref = r.signedAt ?? r.updatedAt ?? r.createdAt;
    return Math.floor((Date.now() - new Date(ref).getTime()) / msDay);
  };

  return {
    stats: { pending, ready },
    recentPrescriptionCount: prescriptionCount,
    recentExamCount: examCount,
    lastConsultation,
    lastPrescriptionDaysAgo: daysAgo(lastSignedPrescription),
    recentMedications: [...medsSet].slice(0, 10),
    followUpRequest,
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<RequestResponseDto>): RequestResponseDto {
  return {
    id: 'req-' + Math.random().toString(36).slice(2),
    patientId: 'patient-1',
    requestType: 'prescription',
    status: 'submitted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    medications: [],
    exams: [],
    ...overrides,
  } as RequestResponseDto;
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('homeStats — derivação de stats', () => {
  describe('contadores', () => {
    it('lista vazia retorna todos os contadores zerados', () => {
      const { stats } = deriveStats([]);
      expect(stats.pending).toBe(0);
      expect(stats.ready).toBe(0);
    });

    it('conta pedidos em revisão como pending', () => {
      const requests = [
        makeReq({ status: 'submitted' }),
        makeReq({ status: 'in_review' }),
      ];
      const { stats } = deriveStats(requests);
      expect(stats.pending).toBe(2);
    });

    it('conta pedidos assinados e entregues em ready', () => {
      const requests = [
        makeReq({ status: 'signed' }),
        makeReq({ status: 'delivered' }),
        makeReq({ status: 'submitted' }),
      ];
      const { stats } = deriveStats(requests);
      expect(stats.ready).toBe(2);
    });

    it('pedidos terminais (rejected/cancelled) não afetam contadores de ação', () => {
      const requests = [
        makeReq({ status: 'rejected' }),
        makeReq({ status: 'cancelled' }),
      ];
      const { stats } = deriveStats(requests);
      expect(stats.pending).toBe(0);
      expect(stats.ready).toBe(0);
    });
  });

  describe('followUpRequest — pedido de maior prioridade', () => {
    it('retorna null quando lista está vazia', () => {
      const { followUpRequest } = deriveStats([]);
      expect(followUpRequest).toBeNull();
    });

    it('prioriza approved (100) sobre submitted (70)', () => {
      const high = makeReq({ id: 'high', status: 'approved' });
      const low = makeReq({ id: 'low', status: 'submitted' });
      const { followUpRequest } = deriveStats([low, high]);
      expect(followUpRequest?.id).toBe('high');
    });

    it('prioriza signed (90) sobre in_review (80)', () => {
      const signed = makeReq({ id: 'signed', status: 'signed' });
      const inReview = makeReq({ id: 'review', status: 'in_review' });
      const { followUpRequest } = deriveStats([inReview, signed]);
      expect(followUpRequest?.id).toBe('signed');
    });

    it('ignora pedidos com status terminal (delivered, rejected, cancelled)', () => {
      const delivered = makeReq({ id: 'done', status: 'delivered' });
      const active = makeReq({ id: 'active', status: 'submitted' });
      const { followUpRequest } = deriveStats([delivered, active]);
      expect(followUpRequest?.id).toBe('active');
    });

    it('retorna null quando todos os pedidos são terminais', () => {
      const requests = [
        makeReq({ status: 'delivered' }),
        makeReq({ status: 'consultation_finished' }),
        makeReq({ status: 'rejected' }),
      ];
      const { followUpRequest } = deriveStats(requests);
      expect(followUpRequest).toBeNull();
    });

    it('prioriza in_consultation (50) sobre searching_doctor (65) — ERRADO, deve priorizar searching_doctor', () => {
      const searching = makeReq({ id: 'searching', status: 'searching_doctor' });
      const inCall = makeReq({ id: 'in_call', status: 'in_consultation' });
      const { followUpRequest } = deriveStats([inCall, searching]);
      // searching_doctor tem prioridade 65, in_consultation tem 50 — searching ganha
      expect(followUpRequest?.id).toBe('searching');
    });
  });

  describe('contagem por tipo', () => {
    it('conta receitas corretamente', () => {
      const requests = [
        makeReq({ requestType: 'prescription' }),
        makeReq({ requestType: 'prescription' }),
        makeReq({ requestType: 'exam' }),
      ];
      const { recentPrescriptionCount, recentExamCount } = deriveStats(requests);
      expect(recentPrescriptionCount).toBe(2);
      expect(recentExamCount).toBe(1);
    });

    it('coleta medicamentos únicos de receitas', () => {
      const requests = [
        makeReq({ requestType: 'prescription', medications: ['Losartana', 'Metformina'] }),
        makeReq({ requestType: 'prescription', medications: ['Losartana', 'Omeprazol'] }),
      ];
      const { recentMedications } = deriveStats(requests);
      // Losartana aparece 2x mas deve ser contada 1x (Set)
      expect(recentMedications).toContain('Losartana');
      expect(recentMedications).toContain('Metformina');
      expect(recentMedications).toContain('Omeprazol');
      expect(recentMedications.filter(m => m === 'Losartana')).toHaveLength(1);
    });

    it('limita medicamentos a 10 itens', () => {
      const meds = Array.from({ length: 15 }, (_, i) => `Med-${i}`);
      const requests = [makeReq({ requestType: 'prescription', medications: meds })];
      const { recentMedications } = deriveStats(requests);
      expect(recentMedications.length).toBeLessThanOrEqual(10);
    });
  });

  describe('lastPrescriptionDaysAgo', () => {
    it('retorna undefined quando não há receitas assinadas', () => {
      const requests = [makeReq({ status: 'submitted' })];
      const { lastPrescriptionDaysAgo } = deriveStats(requests);
      expect(lastPrescriptionDaysAgo).toBeUndefined();
    });

    it('calcula dias desde a última receita assinada', () => {
      const signedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const requests = [makeReq({ status: 'delivered', signedAt })];
      const { lastPrescriptionDaysAgo } = deriveStats(requests);
      expect(lastPrescriptionDaysAgo).toBe(10);
    });

    it('usa a receita assinada mais recente', () => {
      const older = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
      const newer = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const requests = [
        makeReq({ status: 'delivered', signedAt: older }),
        makeReq({ status: 'signed', signedAt: newer }),
      ];
      const { lastPrescriptionDaysAgo } = deriveStats(requests);
      expect(lastPrescriptionDaysAgo).toBe(5);
    });
  });
});
