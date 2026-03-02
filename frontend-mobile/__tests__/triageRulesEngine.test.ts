/**
 * triageRulesEngine.test.ts — Testes unitários do motor de regras
 */

import { evaluateTriageRules } from '../lib/triage/triageRulesEngine';
import type { TriageInput } from '../lib/triage/triage.types';

function input(overrides: Partial<TriageInput>): TriageInput {
  return {
    context: 'home',
    step: 'idle',
    role: 'patient',
    ...overrides,
  };
}

describe('triageRulesEngine', () => {
  // ── Role filtering ────────────────────────────────────────
  describe('role filtering', () => {
    it('returns null for doctor role', () => {
      const result = evaluateTriageRules(input({ role: 'doctor', context: 'prescription', step: 'entry' }));
      expect(result).toBeNull();
    });

    it('returns message for patient role', () => {
      const result = evaluateTriageRules(input({ context: 'prescription', step: 'entry' }));
      expect(result).not.toBeNull();
    });
  });

  // ── Blocked steps (momento crítico) ───────────────────────
  describe('blocked steps', () => {
    it('returns null during payment', () => {
      const result = evaluateTriageRules(input({ context: 'prescription', step: 'payment' }));
      expect(result).toBeNull();
    });

    it('returns null during signing', () => {
      const result = evaluateTriageRules(input({ context: 'prescription', step: 'signing' }));
      expect(result).toBeNull();
    });
  });

  // ── Home context ──────────────────────────────────────────
  describe('home', () => {
    it('shows welcome for first-time user', () => {
      const result = evaluateTriageRules(input({ context: 'home', totalRequests: 0 }));
      expect(result?.key).toBe('home:welcome');
      expect(result?.severity).toBe('positive');
    });

    it('warns about frequent renewals', () => {
      const result = evaluateTriageRules(input({
        context: 'home', totalRequests: 10, recentPrescriptionCount: 3,
      }));
      expect(result?.key).toBe('home:many_renewals');
      expect(result?.severity).toBe('attention');
      expect(result?.cta).toBe('teleconsulta');
    });

    it('suggests follow-up for recent exams', () => {
      const result = evaluateTriageRules(input({
        context: 'home', totalRequests: 5, recentExamCount: 2,
      }));
      expect(result?.key).toBe('home:pending_results');
    });

    it('returns null when no insights available', () => {
      const result = evaluateTriageRules(input({
        context: 'home', totalRequests: 2, recentPrescriptionCount: 1,
      }));
      expect(result).toBeNull();
    });
  });

  // ── Prescription context ──────────────────────────────────
  describe('prescription', () => {
    it('shows entry message', () => {
      const result = evaluateTriageRules(input({ context: 'prescription', step: 'entry' }));
      expect(result?.key).toBe('rx:entry');
    });

    it('shows controlled warning for controlado', () => {
      const result = evaluateTriageRules(input({
        context: 'prescription', step: 'type_selected', prescriptionType: 'controlado',
      }));
      expect(result?.key).toBe('rx:controlled:controlado');
      expect(result?.severity).toBe('attention');
      expect(result?.cta).toBe('consulta_breve');
    });

    it('shows blue warning for azul', () => {
      const result = evaluateTriageRules(input({
        context: 'prescription', step: 'type_selected', prescriptionType: 'azul',
      }));
      expect(result?.key).toBe('rx:controlled:azul');
      expect(result?.text).toContain('vigilância rigorosa');
    });

    it('shows simple tip for simples', () => {
      const result = evaluateTriageRules(input({
        context: 'prescription', step: 'type_selected', prescriptionType: 'simples',
      }));
      expect(result?.key).toBe('rx:simple');
      expect(result?.severity).toBe('positive');
    });

    it('shows high risk warning', () => {
      const result = evaluateTriageRules(input({
        context: 'prescription', step: 'result', aiRiskLevel: 'high',
      }));
      expect(result?.key).toBe('rx:high_risk');
      expect(result?.analyticsEvent).toBe('triage.rx.high_risk');
    });

    it('shows AI message when available', () => {
      const result = evaluateTriageRules(input({
        context: 'prescription', step: 'result', aiMessageToUser: 'Verifique a dosagem com seu médico.',
      }));
      expect(result?.key).toBe('rx:ai_message');
      expect(result?.text).toContain('dosagem');
    });

    it('shows success on clean result', () => {
      const result = evaluateTriageRules(input({ context: 'prescription', step: 'result' }));
      expect(result?.key).toBe('rx:success');
      expect(result?.severity).toBe('positive');
    });
  });

  // ── Exam context ──────────────────────────────────────────
  describe('exam', () => {
    it('detects complex exams', () => {
      const result = evaluateTriageRules(input({
        context: 'exam', step: 'result', exams: ['Hemograma', 'Ressonância magnética de crânio'],
      }));
      expect(result?.key).toBe('exam:complex');
      expect(result?.cta).toBe('teleconsulta');
    });

    it('detects many exams', () => {
      const result = evaluateTriageRules(input({
        context: 'exam', step: 'result',
        exams: ['HbA1c', 'Glicemia', 'Colesterol', 'HDL', 'LDL', 'Triglicerídeos'],
      }));
      expect(result?.key).toBe('exam:many');
    });

    it('shows ok for routine exams', () => {
      const result = evaluateTriageRules(input({
        context: 'exam', step: 'result', exams: ['Hemograma'],
      }));
      expect(result?.key).toBe('exam:ok');
    });
  });

  // ── Consultation context ──────────────────────────────────
  describe('consultation', () => {
    it('shows entry message', () => {
      const result = evaluateTriageRules(input({ context: 'consultation', step: 'entry' }));
      expect(result?.key).toBe('consult:entry');
    });

    it('suggests more details for short symptoms', () => {
      const result = evaluateTriageRules(input({
        context: 'consultation', step: 'symptoms_entered', symptoms: 'Dor de cabeça',
      }));
      expect(result?.key).toBe('consult:short_symptoms');
    });
  });

  // ── Detail context ────────────────────────────────────────
  describe('detail', () => {
    it('highlights doctor conduct when available', () => {
      const result = evaluateTriageRules(input({
        context: 'detail', step: 'idle', doctorConductNotes: 'Retorno em 30 dias',
      }));
      expect(result?.key).toBe('detail:conduct_available');
    });

    it('shows completed message for signed requests', () => {
      const result = evaluateTriageRules(input({
        context: 'detail', step: 'idle', status: 'signed',
      }));
      expect(result?.key).toBe('detail:completed');
    });
  });

  // ── Message quality ───────────────────────────────────────
  describe('message quality', () => {
    it('all messages have unique keys', () => {
      const contexts = ['home', 'prescription', 'exam', 'consultation', 'detail'] as const;
      const steps = ['entry', 'type_selected', 'result', 'idle'] as const;
      const keys = new Set<string>();

      for (const context of contexts) {
        for (const step of steps) {
          const result = evaluateTriageRules(input({ context, step }));
          if (result) {
            expect(keys.has(result.key)).toBe(false);
            keys.add(result.key);
          }
        }
      }
    });

    it('all messages are under 120 chars', () => {
      const cases: Partial<TriageInput>[] = [
        { context: 'home', totalRequests: 0 },
        { context: 'home', totalRequests: 5, recentPrescriptionCount: 3 },
        { context: 'prescription', step: 'entry' },
        { context: 'prescription', step: 'type_selected', prescriptionType: 'controlado' },
        { context: 'prescription', step: 'result', aiRiskLevel: 'high' },
        { context: 'exam', step: 'entry' },
        { context: 'consultation', step: 'entry' },
      ];

      for (const c of cases) {
        const result = evaluateTriageRules(input(c));
        if (result) {
          expect(result.text.length).toBeLessThanOrEqual(140); // ~2 lines
        }
      }
    });

    it('no message contains diagnostic language', () => {
      const forbidden = ['diagnóstico', 'você tem', 'você está com', 'prescrevo', 'tome'];
      const allInputs: Partial<TriageInput>[] = [
        { context: 'home', totalRequests: 0 },
        { context: 'prescription', step: 'entry' },
        { context: 'prescription', step: 'type_selected', prescriptionType: 'controlado' },
        { context: 'prescription', step: 'result', aiRiskLevel: 'high' },
        { context: 'exam', step: 'result', exams: ['Ressonância'] },
        { context: 'consultation', step: 'entry' },
      ];

      for (const inp of allInputs) {
        const result = evaluateTriageRules(input(inp));
        if (result) {
          for (const word of forbidden) {
            expect(result.text.toLowerCase()).not.toContain(word);
          }
        }
      }
    });
  });
});
